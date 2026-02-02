import {
  isMultiThreadSupported,
  validateThreadCount,
  copyToWasm,
} from "@dimkatet/jcodecs-core";
import type { AVIFDecodeOptions } from "./options";
import { DEFAULT_DECODE_OPTIONS } from "./options";
import type {
  AVIFImageData,
  AVIFImageInfo,
  AVIFMetadata,
  MasteringDisplay,
  ColorPrimaries,
  TransferFunction,
  MatrixCoefficients,
} from "./types";
import type {
  MainModule,
  ImageMetadata,
  MasteringDisplay as WASMMasteringDisplay,
} from "./wasm/avif_dec";


type WasmModule = typeof import("./wasm/avif_dec_mt");

let decoderModule: MainModule | null = null;
let isMultiThreadedModule = false;
let maxThreads = 1;
let initPromise: Promise<void> | null = null;

// Profiling
let profilingEnabled = false;

export interface DecodeProfile {
  inputSize: number;
  outputSize: number;
  dimensions: string;
  bitDepth: number;
  copyToWasm: number;
  wasmDecode: number;
  copyFromWasm: number;
  convertMetadata: number;
  total: number;
}

export function enableProfiling(enabled = true): void {
  profilingEnabled = enabled;
}

function logProfile(profile: DecodeProfile): void {
  if (!profilingEnabled) return;

  console.log(
    `[AVIF Decode Profile] ${profile.dimensions} @ ${profile.bitDepth}bit\n` +
      `  Input:          ${(profile.inputSize / 1024).toFixed(1)} KB\n` +
      `  Output:         ${(profile.outputSize / 1024 / 1024).toFixed(
        2,
      )} MB\n` +
      `  ─────────────────────────────\n` +
      `  Copy to WASM:   ${profile.copyToWasm.toFixed(2)} ms\n` +
      `  WASM decode:    ${profile.wasmDecode.toFixed(2)} ms\n` +
      `  Copy from WASM: ${profile.copyFromWasm.toFixed(2)} ms\n` +
      `  Convert meta:   ${profile.convertMetadata.toFixed(2)} ms\n` +
      `  ─────────────────────────────\n` +
      `  TOTAL:          ${profile.total.toFixed(2)} ms`,
  );
}


// Default URLs - auto-detect MT support (WASM is embedded via SINGLE_FILE)
const defaultMtJsUrl = new URL("./avif_dec_mt.js", import.meta.url).href;
const defaultStJsUrl = new URL("./avif_dec.js", import.meta.url).href;

export interface InitConfig {
  /** URL to the decoder JS file (avif_dec.js or avif_dec_mt.js). WASM is embedded. */
  jsUrl?: string;
  /** Prefer to use of multi-threaded decoder */
  preferMT?: boolean;
}

/**
 * Initialize the AVIF decoder module.
 * Auto-detects MT support when no URL provided.
 */
export async function init({ jsUrl, preferMT }: InitConfig = {}): Promise<void> {
  if (decoderModule) return;

  if (initPromise) {
    await initPromise;
    return;
  }

  const useMT = preferMT && isMultiThreadSupported();
  const url = jsUrl ?? (useMT ? defaultMtJsUrl : defaultStJsUrl);

  initPromise = (async () => {
    isMultiThreadedModule = jsUrl ? jsUrl.includes("_mt") : !!useMT;
    // mainScriptUrlOrBlob needed for pthread workers to find the main JS file
    const moduleConfig: Record<string, unknown> = {
      mainScriptUrlOrBlob: isMultiThreadedModule ? url : undefined,
    };

    const module: WasmModule = await import(/* @vite-ignore */ url);
    const createModule = module.default;
    decoderModule = await createModule(moduleConfig);
    maxThreads = decoderModule.MAX_THREADS ?? 1;
  })();

  await initPromise;
}


function convertMasteringDisplay(
  wasm: WASMMasteringDisplay,
): MasteringDisplay | undefined {
  if (!wasm.present) return undefined;

  return {
    primaries: {
      red: [wasm.redX, wasm.redY],
      green: [wasm.greenX, wasm.greenY],
      blue: [wasm.blueX, wasm.blueY],
    },
    whitePoint: [wasm.whiteX, wasm.whiteY],
    luminance: {
      min: wasm.minLuminance,
      max: wasm.maxLuminance,
    },
  };
}

function convertMetadata(
  wasm: ImageMetadata,
  module: MainModule,
): AVIFMetadata {
  // Copy ICC profile from WASM heap in one bulk operation
  let iccProfile: Uint8Array | undefined;
  if (wasm.iccProfileSize > 0 && wasm.iccProfilePtr !== 0) {
    iccProfile = module.HEAPU8.slice(
      wasm.iccProfilePtr,
      wasm.iccProfilePtr + wasm.iccProfileSize,
    );
    module._free(wasm.iccProfilePtr);
  }

  return {
    colorPrimaries: wasm.colorPrimaries as ColorPrimaries,
    transferFunction: wasm.transferFunction as TransferFunction,
    matrixCoefficients: wasm.matrixCoefficients as MatrixCoefficients,
    fullRange: wasm.fullRange,
    maxCLL: wasm.maxCLL,
    maxPALL: wasm.maxPALL,
    masteringDisplay: convertMasteringDisplay(wasm.masteringDisplay),
    iccProfile,
    isHDR: wasm.isHDR,
  };
}

/**
 * Decode AVIF image data
 */
export async function decode(
  input: Uint8Array | ArrayBuffer,
  options: AVIFDecodeOptions = {},
  config?: InitConfig,
): Promise<AVIFImageData> {
  await init(config);
  const t0 = profilingEnabled ? performance.now() : 0;

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const opts = { ...DEFAULT_DECODE_OPTIONS, ...options };
  const module = decoderModule!;

  // Validate maxThreads
  const validation = validateThreadCount(
    opts.maxThreads,
    maxThreads,
    isMultiThreadedModule,
    "jcodecs-avif",
  );
  if (validation.warning) {
    console.warn(validation.warning);
  }
  opts.maxThreads = validation.validatedCount;

  // Copy input data to WASM heap
  const t1 = profilingEnabled ? performance.now() : 0;
  const inputPtr = copyToWasm(module, data);
  const t2 = profilingEnabled ? performance.now() : 0;

  let result;
  try {
    result = module.decode(inputPtr, data.length, opts.bitDepth, opts.maxThreads);
  } finally {
    module._free(inputPtr);
  }
  const t3 = profilingEnabled ? performance.now() : 0;

  if (result.error) {
    throw new Error(`AVIF decode error: ${result.error}`);
  }

  const outputDepth = result.depth as 8 | 10 | 12 | 16;
  let pixelData: Uint8Array | Uint16Array;
  // Copy pixel data from WASM heap in one operation
  if (outputDepth > 8) {
    pixelData = new Uint16Array(result.dataSize / 2);
    pixelData.set(
      new Uint16Array(
        module.HEAPU16.buffer,
        result.dataPtr,
        result.dataSize / 2,
      ),
    );
  } else {
    pixelData = new Uint8Array(result.dataSize);
    pixelData.set(
      new Uint8Array(module.HEAPU8.buffer, result.dataPtr, result.dataSize),
    );
  }
  module._free(result.dataPtr);
  const t4 = profilingEnabled ? performance.now() : 0;

  const metadata = convertMetadata(result.metadata, module);
  const t5 = profilingEnabled ? performance.now() : 0;

  if (profilingEnabled) {
    logProfile({
      inputSize: data.length,
      outputSize: result.dataSize,
      dimensions: `${result.width}x${result.height}`,
      bitDepth: outputDepth,
      copyToWasm: t2 - t1,
      wasmDecode: t3 - t2,
      copyFromWasm: t4 - t3,
      convertMetadata: t5 - t4,
      total: t5 - t0,
    });
  }

  return {
    data: pixelData,
    width: result.width,
    height: result.height,
    bitDepth: outputDepth,
    channels: result.channels,
    metadata,
  };
}

/**
 * Decode AVIF to standard ImageData (8-bit RGBA)
 */
export async function decodeToImageData(
  input: Uint8Array | ArrayBuffer,
  options?: Omit<AVIFDecodeOptions, "bitDepth">,
): Promise<ImageData> {
  const result = await decode(input, { ...options, bitDepth: 8 });

  const pixelCount = result.width * result.height;
  const rgbaData = new Uint8ClampedArray(pixelCount * 4);

  if (result.channels === 4) {
    const src = result.data as Uint8Array;
    rgbaData.set(src);
  } else {
    const rgb = result.data as Uint8Array;
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
      rgbaData[j] = rgb[i];
      rgbaData[j + 1] = rgb[i + 1];
      rgbaData[j + 2] = rgb[i + 2];
      rgbaData[j + 3] = 255;
    }
  }

  return new ImageData(rgbaData, result.width, result.height);
}

/**
 * Get image info without full decoding
 */
export async function getImageInfo(
  input: Uint8Array | ArrayBuffer,
): Promise<AVIFImageInfo> {
  await init();

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const module = decoderModule!;

  // Copy input data to WASM heap
  const inputPtr = copyToWasm(module, data);

  let result;
  try {
    result = module.getImageInfo(inputPtr, data.length);
  } finally {
    module._free(inputPtr);
  }

  return {
    width: result.width,
    height: result.height,
    bitDepth: result.depth,
    channels: result.channels,
    metadata: convertMetadata(result.metadata, module),
  };
}

export function isInitialized(): boolean {
  return decoderModule !== null;
}

export function isMultiThreaded(): boolean {
  return isMultiThreadedModule;
}
