import {
  isMultiThreadSupported,
  validateThreadCount,
  copyToWasm,
  copyFromWasmByType,
} from "@dimkatet/jcodecs-core";
import type { AVIFDecodeOptions } from "./options";
import { DEFAULT_DECODE_OPTIONS } from "./options";
import type {
  AVIFImageData,
  AVIFImageInfo,
  AVIFDataType,
} from "./types";
import type { MainModule } from "./wasm/avif_dec";
import {
  isProfilingEnabled,
  logDecodeProfile,
} from "./profiling";
import { convertMetadata } from "./metadata";
import { mtDecoderUrl, stDecoderUrl } from "./urls";

type WasmModule = typeof import("./wasm/avif_dec_mt");

let decoderModule: MainModule | null = null;
let isMultiThreadedModule = false;
let maxThreads = 1;
let initPromise: Promise<void> | null = null;

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
  const url = jsUrl ?? (useMT ? mtDecoderUrl : stDecoderUrl);

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

/**
 * Decode AVIF image data
 */
export async function decode(
  input: Uint8Array | ArrayBuffer,
  options: AVIFDecodeOptions = {},
  config?: InitConfig,
): Promise<AVIFImageData> {
  await init(config);
  const t0 = isProfilingEnabled() ? performance.now() : 0;

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
  const t1 = isProfilingEnabled() ? performance.now() : 0;
  const inputPtr = copyToWasm(module, data);
  const t2 = isProfilingEnabled() ? performance.now() : 0;

  let result;
  try {
    result = module.decode(inputPtr, data.length, opts.bitDepth, opts.maxThreads);
  } finally {
    module._free(inputPtr);
  }
  const t3 = isProfilingEnabled() ? performance.now() : 0;

  if (result.error) {
    throw new Error(`AVIF decode error: ${result.error}`);
  }

  const outputDepth = result.depth;
  let outputDataType: AVIFDataType = 'uint8';
  let bytesPerElement = 1;
  if (outputDepth > 8) {
    // Auto: use uint16 for >8 bit
    outputDataType = "uint16";
    bytesPerElement = 2;
  }

  const elementCount = result.dataSize / bytesPerElement;
  const pixelData = copyFromWasmByType(module, result.dataPtr, elementCount, outputDataType);

  module._free(result.dataPtr);
  const t4 = isProfilingEnabled() ? performance.now() : 0;

  const metadata = convertMetadata(result.metadata, module);
  const t5 = isProfilingEnabled() ? performance.now() : 0;

  if (isProfilingEnabled()) {
    logDecodeProfile({
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
