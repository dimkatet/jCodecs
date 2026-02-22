import type { ImageDescriptor } from "@dimkatet/jcodecs-core";
import {
  copyFromWasmByType,
  copyToWasm,
  isMultiThreadSupported,
  normalizeDescriptor,
  validateThreadCount,
} from "@dimkatet/jcodecs-core";
import type { EXRDecodeOptions } from "./options";
import { DEFAULT_DECODE_OPTIONS } from "./options";
import type {
  EXRChromaticities,
  EXRFormatSpecific,
  EXRImageData
} from "./types";
import { mtDecoderUrl, stDecoderUrl } from "./urls";
import type {
  EXRFormatData,
  MainModule,
} from "./wasm/exr_dec_mt";

type WasmModule = typeof import("./wasm/exr_dec_mt");

let decoderModule: MainModule | null = null;
let isMultiThreadedModule = false;
let maxThreads = 1;
let initPromise: Promise<void> | null = null;

export interface InitConfig {
  /** URL to the decoder JS file (exr_dec.js or exr_dec_mt.js). WASM is embedded. */
  jsUrl?: string;
  /** Prefer to use of multi-threaded decoder */
  preferMT?: boolean;
}

/**
 * Initialize the EXR decoder module.
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

    const module: WasmModule = await import(/* @vite-ignore */ url);
    const createModule = module.default;
    decoderModule = await createModule(moduleConfig);
    maxThreads = decoderModule.MAX_THREADS ?? 1;
  })();

  await initPromise;
}

// ============================================================================
// EXRFormatData → EXRFormatSpecific conversion
// ============================================================================

function buildFormatSpecific(fd: EXRFormatData): EXRFormatSpecific {
  let chromaticities: EXRChromaticities | undefined;
  if (fd.chromaticities.present) {
    const c = fd.chromaticities;
    chromaticities = {
      red:   [c.redX,   c.redY],
      green: [c.greenX, c.greenY],
      blue:  [c.blueX,  c.blueY],
      white: [c.whiteX, c.whiteY],
    };
  }

  return {
    compression: fd.compression as EXRFormatSpecific["compression"],
    dataWindow: {
      xMin: fd.dataWindow.xMin,
      yMin: fd.dataWindow.yMin,
      xMax: fd.dataWindow.xMax,
      yMax: fd.dataWindow.yMax,
    },
    displayWindow: {
      xMin: fd.displayWindow.xMin,
      yMin: fd.displayWindow.yMin,
      xMax: fd.displayWindow.xMax,
      yMax: fd.displayWindow.yMax,
    },
    chromaticities,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Decode EXR image data
 */
export async function decode(
  input: Uint8Array | ArrayBuffer,
  options: EXRDecodeOptions = {},
  config?: InitConfig,
): Promise<EXRImageData> {
  await init(config);

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const opts = { ...DEFAULT_DECODE_OPTIONS, ...options };
  const module = decoderModule!;

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

  // Copy input data to WASM heap
  const inputPtr = copyToWasm(module, data);

  let result;
  try {
    result = module.decode(
      inputPtr,
      data.length,
      opts.dataType ?? "auto",
      opts.maxThreads,
    );
  } finally {
    module._free(inputPtr);
  }

  if (result.error) {
    throw new Error(`EXR decode error: ${result.error}`);
  }

  // Normalize WASM ImageDescriptor (enum { value: N } → string)
  const descriptor = normalizeDescriptor(module, result.descriptor);

  const dataType = descriptor.numeric.dataType;
  const bytesPerElement = dataType === "float32" ? 4 : 2;
  const elementCount = result.dataSize / bytesPerElement;

  const pixelData = copyFromWasmByType(
    module,
    result.dataPtr,
    elementCount,
    dataType,
  );
  module._free(result.dataPtr);

  // Attach EXR-specific format metadata
  descriptor.formatSpecific = buildFormatSpecific(result.formatData);

  return { data: pixelData as Float16Array | Float32Array, descriptor };
}

/**
 * Decode EXR to standard ImageData (8-bit RGBA)
 *
 * Converts float16/float32 HDR data to 8-bit by clamping [0, 1] range.
 */
export async function decodeToImageData(
  input: Uint8Array | ArrayBuffer,
  options?: EXRDecodeOptions,
): Promise<ImageData> {
  const result = await decode(input, options);

  const { width, height } = result.descriptor.geometry;
  const channels = result.descriptor.channels.count;
  const pixelCount = width * height;
  const rgbaData = new Uint8ClampedArray(pixelCount * 4);

  const src = result.data;
  if (channels === 4) {
    for (let i = 0, j = 0; i < src.length; i++, j++) {
      rgbaData[j] = Math.round(Math.min(1, Math.max(0, Number(src[i]))) * 255);
    }
  } else if (channels === 3) {
    for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
      rgbaData[j]     = Math.round(Math.min(1, Math.max(0, Number(src[i])))     * 255);
      rgbaData[j + 1] = Math.round(Math.min(1, Math.max(0, Number(src[i + 1]))) * 255);
      rgbaData[j + 2] = Math.round(Math.min(1, Math.max(0, Number(src[i + 2]))) * 255);
      rgbaData[j + 3] = 255;
    }
  }

  return new ImageData(rgbaData, width, height);
}

/**
 * Get image info without full decoding.
 * Returns an ImageDescriptor describing the image.
 */
export async function getImageInfo(
  input: Uint8Array | ArrayBuffer,
): Promise<ImageDescriptor> {
  await init();

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const module = decoderModule!;

  const inputPtr = copyToWasm(module, data);

  let info;
  try {
    info = module.getImageInfo(inputPtr, data.length);
  } finally {
    module._free(inputPtr);
  }

  const descriptor = normalizeDescriptor(module, info.descriptor);
  descriptor.formatSpecific = buildFormatSpecific(info.formatData);

  return descriptor;
}

export function isInitialized(): boolean {
  return decoderModule !== null;
}

export function isMultiThreaded(): boolean {
  return isMultiThreadedModule;
}
