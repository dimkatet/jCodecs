import type { ExtendedImageData } from "@dimkatet/jcodecs-core";
import type { AVIFEncodeOptions, ChromaSubsampling } from "./options";
import { DEFAULT_ENCODE_OPTIONS } from "./options";
import type { MainModule, EncodeOptions } from "./wasm/avif_enc";

type WasmModule = typeof import("./wasm/avif_enc_mt");

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
    `[AVIF Encode Profile] ${profile.dimensions} @ ${profile.inputBitDepth}bit → ${profile.outputBitDepth}bit\n` +
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
const defaultMtJsUrl = new URL("./avif_enc_mt.js", import.meta.url).href;
const defaultStJsUrl = new URL("./avif_enc.js", import.meta.url).href;

export interface InitConfig {
  /** URL to the encoder JS file (avif_enc.js). WASM is embedded. */
  jsUrl?: string;
  /** Prefer to use of multi-threaded decoder */
  preferMT?: boolean;
}

/**
 * Initialize the AVIF encoder module.
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
 * Copy data to WASM heap and return pointer
 */
function copyToWasm(
  module: MainModule,
  data: Uint8Array | Uint16Array,
): number {
  const byteLength =
    data instanceof Uint16Array ? data.byteLength : data.length;
  const ptr = module._malloc(byteLength);

  if (data instanceof Uint16Array) {
    module.HEAPU8.set(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      ptr,
    );
  } else {
    module.HEAPU8.set(data, ptr);
  }

  return ptr;
}

/**
 * Convert chroma subsampling string to number
 */
function chromaToNumber(chroma: ChromaSubsampling): number {
  switch (chroma) {
    case "4:4:4":
      return 444;
    case "4:2:2":
      return 422;
    case "4:2:0":
      return 420;
    case "4:0:0":
      return 400;
    default:
      return 420;
  }
}

/**
 * Encode image data to AVIF format
 */
export async function encode(
  imageData: ImageData | ExtendedImageData,
  options: AVIFEncodeOptions = {},
  config?: InitConfig,
): Promise<Uint8Array> {
  await init(config);
  const t0 = profilingEnabled ? performance.now() : 0;
  
  const opts = { ...DEFAULT_ENCODE_OPTIONS, ...options };
  const module = encoderModule!;

  // Validate maxThreads
  if (!isMultiThreadedModule) {
    if (opts.maxThreads > 1) {
      console.warn("[jcodecs-avif] maxThreads > 1 ignored: SharedArrayBuffer not available");
    }
    opts.maxThreads = 1;
  } else if (opts.maxThreads > maxThreads) {
    console.warn(`[jcodecs-avif] maxThreads=${opts.maxThreads} exceeds limit ${maxThreads}, clamping`);
    opts.maxThreads = maxThreads;
  }

  // Determine input format
  const width = imageData.width;
  const height = imageData.height;

  // Check if it's ExtendedImageData with bitDepth
  const isExtended = "bitDepth" in imageData;
  const inputBitDepth = isExtended
    ? (imageData as ExtendedImageData).bitDepth
    : 8;
  const channels =
    isExtended && "channels" in imageData
      ? (imageData as ExtendedImageData).channels
      : 4; // Standard ImageData is always RGBA

  // Get pixel data
  let pixelData: Uint8Array | Uint16Array;
  if (isExtended && inputBitDepth > 8) {
    pixelData = (imageData as ExtendedImageData).data as Uint16Array;
  } else {
    pixelData = new Uint8Array(
      imageData.data.buffer,
      imageData.data.byteOffset,
      imageData.data.byteLength,
    );
  }

  // Copy input data to WASM heap
  const t1 = profilingEnabled ? performance.now() : 0;
  const inputPtr = copyToWasm(module, pixelData);
  const inputSize =
    pixelData instanceof Uint16Array ? pixelData.byteLength : pixelData.length;
  const t2 = profilingEnabled ? performance.now() : 0;

  // Prepare WASM options
  const wasmOptions: EncodeOptions = {
    quality: opts.quality,
    qualityAlpha: opts.qualityAlpha,
    speed: opts.speed,
    tune: opts.tune,
    lossless: opts.lossless,
    chromaSubsampling: chromaToNumber(opts.chromaSubsampling),
    bitDepth: opts.bitDepth,
    colorSpace: opts.colorSpace,
    transferFunction: opts.transferFunction,
    maxThreads: opts.maxThreads,
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
    throw new Error(`AVIF encode error: ${result.error}`);
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
 * Check if SharedArrayBuffer is available (required for multi-threaded decoding)
 */
export function isMultiThreadSupported(): boolean {
  try {
    return typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Encode ImageData to AVIF with simple options
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
