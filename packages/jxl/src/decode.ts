import {
  isMultiThreadSupported,
  validateThreadCount,
  copyToWasm,
  copyFromWasmByType,
} from "@dimkatet/jcodecs-core";
import type { JXLDecodeOptions } from "./options";
import { DEFAULT_DECODE_OPTIONS } from "./options";
import type {
  JXLImageData,
  JXLImageInfo,
  JXLMetadata,
  MasteringDisplay,
  ColorPrimaries,
  TransferFunction,
} from "./types";
import type {
  MainModule,
  ImageMetadata,
  MasteringDisplay as WASMMasteringDisplay,
} from "./wasm/jxl_dec";

type WasmModule = typeof import("./wasm/jxl_dec_mt");

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
    `[JXL Decode Profile] ${profile.dimensions} @ ${profile.bitDepth}bit\n` +
      `  Input:          ${(profile.inputSize / 1024).toFixed(1)} KB\n` +
      `  Output:         ${(profile.outputSize / 1024 / 1024).toFixed(2)} MB\n` +
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
const defaultMtJsUrl = new URL("./jxl_dec_mt.js", import.meta.url).href;
const defaultStJsUrl = new URL("./jxl_dec.js", import.meta.url).href;

export interface InitConfig {
  /** URL to the decoder JS file (jxl_dec.js or jxl_dec_mt.js). WASM is embedded. */
  jsUrl?: string;
  /** Prefer to use of multi-threaded decoder */
  preferMT?: boolean;
}

/**
 * Initialize the JXL decoder module.
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
): JXLMetadata {
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
    matrixCoefficients: "identity", // JXL always decodes to RGB
    fullRange: wasm.fullRange,
    maxCLL: wasm.maxCLL,
    maxPALL: wasm.maxPALL,
    masteringDisplay: convertMasteringDisplay(wasm.masteringDisplay),
    iccProfile,
    isHDR: wasm.isHDR,
    isAnimated: wasm.isAnimated,
    frameCount: wasm.frameCount,
  };
}

/**
 * Decode JXL image data
 */
export async function decode(
  input: Uint8Array | ArrayBuffer,
  options: JXLDecodeOptions = {},
  config?: InitConfig,
): Promise<JXLImageData> {
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
    "jcodecs-jxl",
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
    result = module.decode(inputPtr, data.length, opts.maxThreads);
  } finally {
    module._free(inputPtr);
  }
  const t3 = profilingEnabled ? performance.now() : 0;

  if (result.error) {
    throw new Error(`JXL decode error: ${result.error}`);
  }

  const outputDepth = result.depth as 8 | 10 | 12 | 16 | 32;

  // dataType is auto-detected from file format (returned from WASM)
  const outputDataType = result.dataType as 'uint8' | 'uint16' | 'float16' | 'float32';

  // Calculate element count based on data type
  const bytesPerElement = outputDataType === 'float32' ? 4 :
                          outputDataType === 'uint16' || outputDataType === 'float16' ? 2 : 1;
  const elementCount = result.dataSize / bytesPerElement;

  // Copy pixel data from WASM heap using type-safe helper
  const pixelData = copyFromWasmByType(module, result.dataPtr, elementCount, outputDataType);
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
    dataType: outputDataType,
    width: result.width,
    height: result.height,
    bitDepth: outputDepth,
    channels: result.channels,
    metadata,
  };
}

/**
 * Decode JXL to standard ImageData (8-bit RGBA)
 *
 * TODO: Move ImageData conversion to @jcodecs/core as a shared utility
 * that works with any ExtendedImageData (uint8/uint16/float16/float32) → ImageData
 */
export async function decodeToImageData(
  input: Uint8Array | ArrayBuffer,
  options?: JXLDecodeOptions,
): Promise<ImageData> {
  const result = await decode(input, options);

  const pixelCount = result.width * result.height;
  const rgbaData = new Uint8ClampedArray(pixelCount * 4);

  if (result.channels === 4) {
    const src = result.data as Uint8Array;
    rgbaData.set(src);
  } else if (result.channels === 3) {
    const rgb = result.data as Uint8Array;
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
      rgbaData[j] = rgb[i];
      rgbaData[j + 1] = rgb[i + 1];
      rgbaData[j + 2] = rgb[i + 2];
      rgbaData[j + 3] = 255;
    }
  } else if (result.channels === 1) {
    // Grayscale
    const gray = result.data as Uint8Array;
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
      rgbaData[j] = gray[i];
      rgbaData[j + 1] = gray[i];
      rgbaData[j + 2] = gray[i];
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
): Promise<JXLImageInfo> {
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
