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
  AVIFDecoderModule,
  WASMImageMetadata,
  WASMMasteringDisplay,
} from "./wasm/avif_dec";

type ModuleFactory = (
  config?: Record<string, unknown>,
) => Promise<AVIFDecoderModule>;

let decoderModule: AVIFDecoderModule | null = null;
let decoderModuleMT: AVIFDecoderModule | null = null;
let initPromise: Promise<void> | null = null;

// Profiling
let profilingEnabled = true;

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

function isSharedArrayBufferAvailable(): boolean {
  try {
    return typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}

export async function init(wasmUrl?: string): Promise<void> {
  if (decoderModule) return;

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const moduleConfig: Record<string, unknown> = {};

    if (wasmUrl) {
      moduleConfig.locateFile = (path: string) => {
        if (path.endsWith(".wasm")) return wasmUrl;
        return path;
      };
    }

    if (isSharedArrayBufferAvailable()) {
      try {
        console.log("Initializing AVIF multi-threaded decoder");
        const createMTModule = (await import("./wasm/avif_dec_mt.js"))
          .default as ModuleFactory;
        decoderModuleMT = await createMTModule(moduleConfig);
      } catch (e) {
        console.error("Failed to initialize AVIF multi-threaded decoder:", e);
        console.warn("AVIF multi-threaded decoder not available");
      }
    } else {
      console.log("Initializing AVIF single-threaded decoder");
      const createModule = (await import("./wasm/avif_dec.js"))
        .default as ModuleFactory;
      decoderModule = await createModule(moduleConfig);
    }
  })();

  await initPromise;
}

/**
 * Copy data to WASM heap and return pointer
 */
function copyToWasm(module: AVIFDecoderModule, data: Uint8Array): number {
  const ptr = module._malloc(data.length);
  module.HEAPU8.set(data, ptr);
  return ptr;
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
  wasm: WASMImageMetadata,
  module: AVIFDecoderModule,
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
): Promise<AVIFImageData> {
  await init();
  const t0 = profilingEnabled ? performance.now() : 0;

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const opts = { ...DEFAULT_DECODE_OPTIONS, ...options };

  const useMT = opts.useThreads && decoderModuleMT;
  let module: AVIFDecoderModule;
  if (useMT) {
    console.log("Using multi-threaded AVIF decoder");
    module = decoderModuleMT!;
  } else {
    console.log("Using single-threaded AVIF decoder");
    module = decoderModule!;
  }
  // const module = useMT ? decoderModuleMT! : decoderModule!;

  const maxThreads = useMT
    ? opts.maxThreads || navigator.hardwareConcurrency || 4
    : 1;

  // Copy input data to WASM heap
  const t1 = profilingEnabled ? performance.now() : 0;
  console.log(`Copying ${data.length} bytes to WASM heap`);
  const inputPtr = copyToWasm(module, data);
  console.log("Copy to WASM done");
  const t2 = profilingEnabled ? performance.now() : 0;

  let result;
  try {
    console.log('Starting AVIF decode in WASM');
    result = module.decode(inputPtr, data.length, opts.bitDepth, maxThreads);
    console.log("AVIF decode timings (ms):", result.timings);
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
    hasAlpha: result.hasAlpha,
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

  if (result.hasAlpha) {
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
    hasAlpha: result.hasAlpha,
    metadata: convertMetadata(result.metadata, module),
  };
}

export function isInitialized(): boolean {
  return decoderModule !== null;
}

export function isMultiThreaded(): boolean {
  return decoderModuleMT !== null;
}
