import {
  importModule,
  isMultiThreadSupported,
  validateThreadCount,
  copyToWasm,
  copyFromWasmByType,
  normalizeDescriptor,
} from "@dimkatet/jcodecs-core";
import type { ImageDescriptor } from "@dimkatet/jcodecs-core";
import type { AVIFDecodeOptions } from "./options";
import { DEFAULT_DECODE_OPTIONS } from "./options";
import type { AVIFImageData, AVIFDataType } from "./types";
import type { MainModule, DecodeResult } from "./wasm/avif_dec_mt";
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
    const moduleConfig: Record<string, unknown> = {
      mainScriptUrlOrBlob: isMultiThreadedModule ? url : undefined,
    };

    const module = await importModule<WasmModule>(url);
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
  const inputPtr = copyToWasm(module, data);

  let result: DecodeResult;
  try {
    result = module.decode(inputPtr, data.length, opts.bitDepth, opts.maxThreads);
  } finally {
    module._free(inputPtr);
  }

  if (result.error) {
    throw new Error(`AVIF decode error: ${result.error}`);
  }

  const { dataPtr, dataSize } = result;

  const descriptor = normalizeDescriptor(module, result.descriptor);
  const dataType = descriptor.numeric.dataType as AVIFDataType;

  // Copy pixel data from WASM heap
  const bytesPerElement = dataType === 'uint16' ? 2 : 1;
  const elementCount = dataSize / bytesPerElement;
  const pixelData = copyFromWasmByType(module, dataPtr, elementCount, dataType);
  module._free(dataPtr);

  return {
    data: pixelData,
    descriptor,
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

  const { width, height } = result.descriptor.geometry;
  const channels = result.descriptor.channels.count;
  const pixelCount = width * height;
  const rgbaData = new Uint8ClampedArray(pixelCount * 4);

  if (channels === 4) {
    const src = result.data as Uint8Array;
    rgbaData.set(src);
  } else if (channels === 3) {
    const rgb = result.data as Uint8Array;
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
      rgbaData[j] = rgb[i];
      rgbaData[j + 1] = rgb[i + 1];
      rgbaData[j + 2] = rgb[i + 2];
      rgbaData[j + 3] = 255;
    }
  } else if (channels === 1) {
    const gray = result.data as Uint8Array;
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
      rgbaData[j] = gray[i];
      rgbaData[j + 1] = gray[i];
      rgbaData[j + 2] = gray[i];
      rgbaData[j + 3] = 255;
    }
  }

  return new ImageData(rgbaData, width, height);
}

/**
 * Get image info without full decoding
 */
export async function getImageInfo(
  input: Uint8Array | ArrayBuffer,
): Promise<ImageDescriptor> {
  await init();

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const module = decoderModule!;

  const inputPtr = copyToWasm(module, data);

  let descriptor: ImageDescriptor;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor = normalizeDescriptor(module as any, module.getImageInfo(inputPtr, data.length) as any);
  } finally {
    module._free(inputPtr);
  }

  return descriptor;
}

export function isInitialized(): boolean {
  return decoderModule !== null;
}

export function isMultiThreaded(): boolean {
  return isMultiThreadedModule;
}
