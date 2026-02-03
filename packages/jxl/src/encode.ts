import type { ExtendedImageData } from "@dimkatet/jcodecs-core";
import {
  isMultiThreadSupported,
  validateThreadCount,
  copyToWasm,
  copyToWasm16f,
  copyToWasm32f,
} from "@dimkatet/jcodecs-core";
import type { JXLEncodeOptions } from "./options";
import { DEFAULT_ENCODE_OPTIONS } from "./options";
import type { JXLImageData } from "./types";
import { validateDataType, validateDataTypeMatch } from "./validation";
import type { MainModule, EncodeOptions } from "./wasm/jxl_enc";

type WasmModule = typeof import("./wasm/jxl_enc_mt");

let encoderModule: MainModule | null = null;
let isMultiThreadedModule = false;
let maxThreads = 1;
let initPromise: Promise<void> | null = null;

// Profiling
let profilingEnabled = false;

export interface EncodeProfile {
  inputSize: number;
  outputSize: number;
  dimensions: string;
  inputBitDepth: number;
  outputBitDepth: number;
  copyToWasm: number;
  wasmEncode: number;
  copyFromWasm: number;
  total: number;
}

export function enableProfiling(enabled = true): void {
  profilingEnabled = enabled;
}

function logProfile(profile: EncodeProfile): void {
  if (!profilingEnabled) return;

  console.log(
    `[JXL Encode Profile] ${profile.dimensions} @ ${profile.inputBitDepth}bit → ${profile.outputBitDepth}bit\n` +
      `  Input:          ${(profile.inputSize / 1024 / 1024).toFixed(2)} MB\n` +
      `  Output:         ${(profile.outputSize / 1024).toFixed(1)} KB\n` +
      `  ─────────────────────────────\n` +
      `  Copy to WASM:   ${profile.copyToWasm.toFixed(2)} ms\n` +
      `  WASM encode:    ${profile.wasmEncode.toFixed(2)} ms\n` +
      `  Copy from WASM: ${profile.copyFromWasm.toFixed(2)} ms\n` +
      `  ─────────────────────────────\n` +
      `  TOTAL:          ${profile.total.toFixed(2)} ms`,
  );
}

// Default URL (WASM is embedded via SINGLE_FILE)
const defaultMtJsUrl = new URL("./jxl_enc_mt.js", import.meta.url).href;
const defaultStJsUrl = new URL("./jxl_enc.js", import.meta.url).href;

export interface InitConfig {
  /** URL to the encoder JS file (jxl_enc.js). WASM is embedded. */
  jsUrl?: string;
  /** Prefer to use of multi-threaded encoder */
  preferMT?: boolean;
}

/**
 * Initialize the JXL encoder module.
 */
export async function init({ jsUrl, preferMT }: InitConfig = {}): Promise<void> {
  if (encoderModule) return;

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
    encoderModule = await createModule(moduleConfig);
    maxThreads = encoderModule.MAX_THREADS ?? 1;
  })();

  await initPromise;
}

/**
 * Encode image data to JXL format
 */
export async function encode(
  imageData: ImageData | ExtendedImageData,
  options: JXLEncodeOptions = {},
  config?: InitConfig,
): Promise<Uint8Array> {
  await init(config);
  const t0 = profilingEnabled ? performance.now() : 0;

  const opts = { ...DEFAULT_ENCODE_OPTIONS, ...options };
  const module = encoderModule!;

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

  // Determine input format
  const width = imageData.width;
  const height = imageData.height;

  // Check if it's ExtendedImageData with bitDepth
  const isExtended = "bitDepth" in imageData;

  // Validate dataType if present
  if (isExtended && "dataType" in imageData) {
    const extData = imageData as JXLImageData;
    validateDataType(extData.dataType);
    validateDataTypeMatch(extData);
  }

  const inputBitDepth = isExtended
    ? (imageData as ExtendedImageData).bitDepth
    : 8;
  const channels =
    isExtended && "channels" in imageData
      ? (imageData as ExtendedImageData).channels
      : 4; // Standard ImageData is always RGBA

  // Get pixel data and determine data type
  let pixelData: Uint8Array | Uint16Array | Float16Array | Float32Array;
  let dataType: 'uint8' | 'uint16' | 'float16' | 'float32';

  if (isExtended && "dataType" in imageData) {
    // ExtendedImageData with explicit dataType
    const extData = imageData as JXLImageData;
    pixelData = extData.data;
    dataType = extData.dataType;
  } else if (isExtended && inputBitDepth > 8) {
    // ExtendedImageData without dataType (legacy)
    pixelData = (imageData as any).data as Uint16Array;
    dataType = 'uint16';
  } else {
    // Standard ImageData
    pixelData = new Uint8Array(
      imageData.data.buffer,
      imageData.data.byteOffset,
      imageData.data.byteLength,
    );
    dataType = 'uint8';
  }

  // Copy input data to WASM heap using appropriate function
  const t1 = profilingEnabled ? performance.now() : 0;
  let inputPtr: number;
  let inputSize: number;

  if (dataType === 'float32') {
    inputPtr = copyToWasm32f(module, pixelData as Float32Array);
    inputSize = (pixelData as Float32Array).byteLength;
  } else if (dataType === 'float16') {
    inputPtr = copyToWasm16f(module, pixelData as Float16Array);
    inputSize = (pixelData as Float16Array).byteLength;
  } else if (dataType === 'uint16') {
    inputPtr = copyToWasm(module, pixelData as Uint16Array);
    inputSize = (pixelData as Uint16Array).byteLength;
  } else {
    inputPtr = copyToWasm(module, pixelData as Uint8Array);
    inputSize = (pixelData as Uint8Array).length;
  }

  const t2 = profilingEnabled ? performance.now() : 0;

  // Prepare WASM options
  const wasmOptions: EncodeOptions = {
    quality: opts.quality,
    effort: opts.effort,
    lossless: opts.lossless,
    bitDepth: opts.bitDepth,
    colorSpace: opts.colorSpace,
    transferFunction: opts.transferFunction,
    progressive: opts.progressive,
    maxThreads: opts.maxThreads,
    dataType: dataType,
  };

  let result;
  try {
    result = module.encode(
      inputPtr,
      inputSize,
      width,
      height,
      channels,
      inputBitDepth,
      wasmOptions,
    );
  } finally {
    module._free(inputPtr);
  }
  const t3 = profilingEnabled ? performance.now() : 0;

  if (result.error) {
    throw new Error(`JXL encode error: ${result.error}`);
  }

  // Copy output data from WASM heap
  const output = new Uint8Array(result.dataSize);
  output.set(
    new Uint8Array(module.HEAPU8.buffer, result.dataPtr, result.dataSize),
  );
  module._free(result.dataPtr);
  const t4 = profilingEnabled ? performance.now() : 0;

  if (profilingEnabled) {
    logProfile({
      inputSize,
      outputSize: result.dataSize,
      dimensions: `${width}x${height}`,
      inputBitDepth,
      outputBitDepth: opts.bitDepth,
      copyToWasm: t2 - t1,
      wasmEncode: t3 - t2,
      copyFromWasm: t4 - t3,
      total: t4 - t0,
    });
  }

  // Call progress callback if provided
  if (opts.onProgress) {
    opts.onProgress(1, "complete");
  }

  return output;
}

/**
 * Encode ImageData to JXL with simple options
 */
export async function encodeSimple(
  imageData: ImageData,
  quality = 75,
): Promise<Uint8Array> {
  return encode(imageData, { quality });
}

/**
 * Check if encoder is initialized
 */
export function isInitialized(): boolean {
  return encoderModule !== null;
}
