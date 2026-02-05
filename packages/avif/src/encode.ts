import {
  copyToWasm,
  getExtendedImageData,
  isMultiThreadSupported,
  validateThreadCount,
} from "@dimkatet/jcodecs-core";
import { defaultMetadata } from "./metadata";
import type { AVIFEncodeOptions, ChromaSubsampling } from "./options";
import { DEFAULT_ENCODE_OPTIONS } from "./options";
import { isProfilingEnabled, logEncodeProfile } from "./profiling";
import type { AVIFEncodeInput } from "./types";
import { validateDataType, validateDataTypeMatch } from "./validation";
import type { EncodeOptions, MainModule } from "./wasm/avif_enc";
import { mtEncoderUrl, stEncoderUrl } from "./urls";

type WasmModule = typeof import("./wasm/avif_enc_mt");

let encoderModule: MainModule | null = null;
let isMultiThreadedModule = false;
let maxThreads = 1;
let initPromise: Promise<void> | null = null;

export interface InitConfig {
  /** URL to the encoder JS file (avif_enc.js). WASM is embedded. */
  jsUrl?: string;
  /** Prefer to use of multi-threaded decoder */
  preferMT?: boolean;
}

/**
 * Initialize the AVIF encoder module.
 */
export async function init({
  jsUrl,
  preferMT,
}: InitConfig = {}): Promise<void> {
  if (encoderModule) return;

  if (initPromise) {
    await initPromise;
    return;
  }

  const useMT = preferMT && isMultiThreadSupported();
  const url = jsUrl ?? (useMT ? mtEncoderUrl : stEncoderUrl);

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
  encodeInput: AVIFEncodeInput,
  options: AVIFEncodeOptions = {},
  config?: InitConfig,
): Promise<Uint8Array> {
  await init(config);
  const t0 = isProfilingEnabled() ? performance.now() : 0;
  const imageData =
    encodeInput instanceof ImageData
      ? getExtendedImageData(encodeInput, defaultMetadata)
      : encodeInput;

  const opts = { ...DEFAULT_ENCODE_OPTIONS, ...options };
  const module = encoderModule!;

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

  validateDataType(imageData.dataType);
  validateDataTypeMatch(imageData);

  // Copy input data to WASM heap
  const t1 = isProfilingEnabled() ? performance.now() : 0;
  const inputPtr = copyToWasm(module, imageData.data);
  const inputSize = imageData.data.byteLength;
  const t2 = isProfilingEnabled() ? performance.now() : 0;

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
      imageData.data.byteLength,
      imageData.width,
      imageData.height,
      imageData.channels,
      imageData.bitDepth,
      wasmOptions,
    );
  } finally {
    module._free(inputPtr);
  }
  const t3 = isProfilingEnabled() ? performance.now() : 0;

  if (result.error) {
    throw new Error(`AVIF encode error: ${result.error}`);
  }

  // Copy output data from WASM heap
  const output = new Uint8Array(result.dataSize);
  output.set(
    new Uint8Array(module.HEAPU8.buffer, result.dataPtr, result.dataSize),
  );
  module._free(result.dataPtr);
  const t4 = isProfilingEnabled() ? performance.now() : 0;

  if (isProfilingEnabled()) {
    logEncodeProfile({
      inputSize,
      outputSize: result.dataSize,
      dimensions: `${imageData.width}x${imageData.height}`,
      inputBitDepth: imageData.bitDepth,
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
