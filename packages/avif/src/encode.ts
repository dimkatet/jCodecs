import {
  copyToWasm,
  importModule,
  isMultiThreadSupported,
  validateThreadCount,
} from "@dimkatet/jcodecs-core";
import type { ChromaSubsampling } from "@dimkatet/jcodecs-core";
import type { AVIFEncodeOptions } from "./options";
import { DEFAULT_ENCODE_OPTIONS } from "./options";
import type { AVIFEncodeDescriptor } from "./types";
import { validateDescriptor, validateDataAgainstDescriptor } from "./validation";
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
  /** Prefer to use of multi-threaded encoder */
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
 * Convert ChromaSubsampling string to WASM numeric value
 */
function chromaToNumber(chroma: ChromaSubsampling): number {
  switch (chroma) {
    case "444": return 444;
    case "422": return 422;
    case "420": return 420;
    case "400": return 400;
    default: return 420;
  }
}

/**
 * Map core ColorPrimaries to WASM colorSpace string.
 * The C++ encoder only understands: "srgb", "display-p3", "rec2020"
 */
function mapPrimariesToColorSpace(primaries: string): string {
  switch (primaries) {
    case 'bt709': return 'srgb';
    case 'displayP3': return 'display-p3';
    case 'dciP3': return 'display-p3';
    case 'bt2020': return 'rec2020';
    default: return 'srgb';
  }
}

/**
 * Map core TransferFunction to WASM transferFunction string.
 * The C++ encoder understands: "srgb", "pq", "hlg", "linear"
 */
function mapTransferFunction(tf: string): string {
  switch (tf) {
    case 'srgb': return 'srgb';
    case 'pq': return 'pq';
    case 'hlg': return 'hlg';
    case 'linear': return 'linear';
    case 'bt709': return 'srgb';
    default: return 'srgb';
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Encode pixel data to AVIF format.
 *
 * @param data - Raw pixel data
 * @param descriptor - Image description (dimensions, color, format)
 * @param options - Encoding parameters (quality, speed, etc.)
 * @param config - WASM module initialization config
 */
export async function encode(
  data: Uint8Array | Uint16Array,
  descriptor: AVIFEncodeDescriptor,
  options: AVIFEncodeOptions = {},
  config?: InitConfig,
): Promise<Uint8Array> {
  await init(config);

  // Validate descriptor and fill defaults
  const desc = validateDescriptor(descriptor);
  validateDataAgainstDescriptor(data, desc);

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

  // Copy input data to WASM heap
  const inputPtr = copyToWasm(module, data);

  // Map descriptor + options → WASM EncodeOptions
  const wasmOptions: EncodeOptions = {
    // From options (pure encoding params)
    quality: opts.quality,
    qualityAlpha: opts.qualityAlpha,
    speed: opts.speed,
    tune: opts.tune,
    lossless: opts.lossless,
    maxThreads: opts.maxThreads,
    // From descriptor (image description)
    chromaSubsampling: chromaToNumber(desc.sampling.chromaSubsampling!),
    bitDepth: desc.numeric.bitDepth,
    colorSpace: mapPrimariesToColorSpace(desc.color.primaries!),
    transferFunction: mapTransferFunction(desc.transfer.function!),
  };

  let result;
  try {
    result = module.encode(
      inputPtr,
      data.byteLength,
      desc.geometry.width,
      desc.geometry.height,
      desc.channels.count,
      desc.numeric.bitDepth,
      wasmOptions,
    );
  } finally {
    module._free(inputPtr);
  }

  if (result.error) {
    throw new Error(`AVIF encode error: ${result.error}`);
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
 * Encode standard ImageData to AVIF with simple options.
 * Convenience wrapper — constructs descriptor from ImageData.
 */
export async function encodeSimple(
  imageData: ImageData,
  quality = 75,
): Promise<Uint8Array> {
  const data = new Uint8Array(
    imageData.data.buffer,
    imageData.data.byteOffset,
    imageData.data.byteLength,
  );
  const descriptor: AVIFEncodeDescriptor = {
    geometry: { width: imageData.width, height: imageData.height },
    channels: { model: 'rgba', count: 4 },
    numeric: { dataType: 'uint8', bitDepth: 8 },
  };
  return encode(data, descriptor, { quality });
}

/**
 * Check if encoder is initialized
 */
export function isInitialized(): boolean {
  return encoderModule !== null;
}
