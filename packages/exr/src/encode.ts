import {
  importModule,
  isMultiThreadSupported,
  validateThreadCount,
  copyToWasm16f,
  copyToWasm32f,
} from "@dimkatet/jcodecs-core";
import type { ColorPrimaries } from "@dimkatet/jcodecs-core";
import type { EXREncodeOptions } from "./options";
import { DEFAULT_ENCODE_OPTIONS } from "./options";
import type { EXREncodeDescriptor } from "./types";
import { validateDataType, validateDataAgainstDescriptor } from "./validation";
import type { MainModule, EncodeOptions } from "./wasm/exr_enc";
import { mtEncoderUrl, stEncoderUrl } from "./urls";

type WasmModule = typeof import("./wasm/exr_enc_mt");

let encoderModule: MainModule | null = null;
let isMultiThreadedModule = false;
let maxThreads = 1;
let initPromise: Promise<void> | null = null;

export interface InitConfig {
  /** URL to the encoder JS file (exr_enc.js). WASM is embedded. */
  jsUrl?: string;
  /** Prefer to use of multi-threaded encoder */
  preferMT?: boolean;
}

/**
 * Initialize the EXR encoder module.
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
    const moduleConfig: Record<string, unknown> = {
      mainScriptUrlOrBlob: isMultiThreadedModule ? url : undefined,
    };
    const module = await importModule<WasmModule>(url);
    const createModule = module.default;
    encoderModule = await createModule(moduleConfig);
    maxThreads = encoderModule.MAX_THREADS ?? 1;
  })();

  await initPromise;
}

// ============================================================================
// Descriptor → WASM mapping helpers
// ============================================================================

/**
 * Map core ColorPrimaries to WASM colorSpace string.
 * The C++ encoder understands: "srgb", "display-p3", "rec2020"
 */
function mapPrimariesToColorSpace(primaries?: ColorPrimaries): string {
  switch (primaries) {
    case 'bt709': return 'srgb';
    case 'displayP3': return 'display-p3';
    case 'bt2020': return 'rec2020';
    default: return 'srgb';
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Encode pixel data to EXR format.
 *
 * @param data - Raw float pixel data (Float16Array or Float32Array)
 * @param descriptor - Image description (dimensions, channels, format, color)
 * @param options - Encoding parameters (compression, output dataType, threads)
 * @param config - WASM module initialization config
 */
export async function encode(
  data: Float16Array | Float32Array,
  descriptor: EXREncodeDescriptor,
  options: EXREncodeOptions = {},
  config?: InitConfig,
): Promise<Uint8Array> {
  await init(config);

  const opts = { ...DEFAULT_ENCODE_OPTIONS, ...options };
  const module = encoderModule!;

  // Validate maxThreads
  const validation = validateThreadCount(
    opts.maxThreads,
    maxThreads,
    isMultiThreadedModule,
    "jcodecs-exr",
  );
  if (validation.warning) {
    console.warn(validation.warning);
  }
  opts.maxThreads = validation.validatedCount;

  // Validate descriptor and data
  validateDataType(descriptor.numeric.dataType);
  validateDataAgainstDescriptor(data, descriptor);

  const { width, height } = descriptor.geometry;
  const channels = descriptor.channels.count;
  const inputDataType = descriptor.numeric.dataType;
  const outputDataType = opts.dataType ?? inputDataType;
  const colorSpace = mapPrimariesToColorSpace(descriptor.color?.primaries);

  // If output type differs from input type, convert the data in TypeScript
  // before passing to WASM (WASM expects input bytes to match output format).
  let wasmData = data;
  if (outputDataType === 'float32' && inputDataType === 'float16') {
    const src = data as Float16Array;
    const f32 = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) f32[i] = Number(src[i]);
    wasmData = f32;
  } else if (outputDataType === 'float16' && inputDataType === 'float32') {
    const src = data as Float32Array;
    const f16 = new Float16Array(src.length);
    for (let i = 0; i < src.length; i++) f16[i] = src[i];
    wasmData = f16;
  }

  // Copy input data to WASM heap
  let inputPtr: number;
  let inputSize: number;

  if (outputDataType === "float32") {
    inputPtr = copyToWasm32f(module, wasmData as Float32Array);
    inputSize = wasmData.byteLength;
  } else {
    inputPtr = copyToWasm16f(module, wasmData as Float16Array);
    inputSize = wasmData.byteLength;
  }

  // Prepare WASM options
  const wasmOptions: EncodeOptions = {
    compression: opts.compression,
    dataType: outputDataType,
    colorSpace,
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
      wasmOptions,
    );
  } finally {
    module._free(inputPtr);
  }

  if (result.error) {
    throw new Error(`EXR encode error: ${result.error}`);
  }

  // Copy output data from WASM heap
  const output = new Uint8Array(result.dataSize);
  output.set(
    new Uint8Array(module.HEAPU8.buffer, result.dataPtr, result.dataSize),
  );
  module._free(result.dataPtr);

  if (opts.onProgress) {
    opts.onProgress(1, "complete");
  }

  return output;
}

/**
 * Encode standard ImageData to EXR with simple options.
 * Convenience wrapper — converts uint8 [0-255] to float32 [0-1].
 */
export async function encodeSimple(
  imageData: ImageData,
  compression: EXREncodeOptions["compression"] = "zip",
): Promise<Uint8Array> {
  const { width, height, data } = imageData;
  const float32Data = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    float32Data[i] = data[i] / 255;
  }
  const descriptor: EXREncodeDescriptor = {
    geometry: { width, height },
    channels: { model: 'rgba', count: 4 },
    numeric: { dataType: 'float32' },
  };
  return encode(float32Data, descriptor, { compression });
}

/**
 * Check if encoder is initialized
 */
export function isInitialized(): boolean {
  return encoderModule !== null;
}
