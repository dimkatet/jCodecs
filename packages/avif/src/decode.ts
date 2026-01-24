import type { AVIFDecodeOptions } from './options';
import { DEFAULT_DECODE_OPTIONS } from './options';
import type {
  AVIFImageData,
  AVIFImageInfo,
  AVIFMetadata,
  MasteringDisplay,
  ColorPrimaries,
  TransferFunction,
  MatrixCoefficients,
} from './types';
import type {
  AVIFDecoderModule,
  WASMImageMetadata,
  WASMMasteringDisplay,
} from '../wasm/avif_dec.js';

type ModuleFactory = (
  config?: Record<string, unknown>
) => Promise<AVIFDecoderModule>;

let decoderModule: AVIFDecoderModule | null = null;
let decoderModuleMT: AVIFDecoderModule | null = null;
let initPromise: Promise<void> | null = null;

function isSharedArrayBufferAvailable(): boolean {
  try {
    return typeof SharedArrayBuffer !== 'undefined';
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
    const createModule = (await import('../wasm/avif_dec.js'))
      .default as ModuleFactory;

    const moduleConfig: Record<string, unknown> = {};

    if (wasmUrl) {
      moduleConfig.locateFile = (path: string) => {
        if (path.endsWith('.wasm')) return wasmUrl;
        return path;
      };
    }

    decoderModule = await createModule(moduleConfig);

    if (isSharedArrayBufferAvailable()) {
      try {
        const createMTModule = (await import('../wasm/avif_dec_mt.js'))
          .default as ModuleFactory;
        decoderModuleMT = await createMTModule(moduleConfig);
      } catch {
        console.warn('AVIF multi-threaded decoder not available');
      }
    }
  })();

  await initPromise;
}

function uint8ArrayToString(data: Uint8Array): string {
  // Process in chunks to avoid call stack limits and improve performance
  const CHUNK_SIZE = 8192;
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.subarray(i, Math.min(i + CHUNK_SIZE, data.length));
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }
  return chunks.join('');
}

function convertMasteringDisplay(
  wasm: WASMMasteringDisplay
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

function convertMetadata(wasm: WASMImageMetadata): AVIFMetadata {
  // Convert ICC profile from Emscripten vector
  let iccProfile: Uint8Array | undefined;
  const iccSize = wasm.iccProfile.size();
  if (iccSize > 0) {
    iccProfile = new Uint8Array(iccSize);
    for (let i = 0; i < iccSize; i++) {
      iccProfile[i] = wasm.iccProfile.get(i);
    }
  }
  wasm.iccProfile.delete();

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
  options: AVIFDecodeOptions = {}
): Promise<AVIFImageData> {
  await init();

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const opts = { ...DEFAULT_DECODE_OPTIONS, ...options };

  const useMT = opts.useThreads && decoderModuleMT;
  const module = useMT ? decoderModuleMT! : decoderModule!;

  const maxThreads =
    opts.maxThreads || (useMT ? navigator.hardwareConcurrency || 4 : 1);

  const result = module.decode(
    uint8ArrayToString(data),
    opts.bitDepth,
    maxThreads
  );

  if (result.error) {
    throw new Error(`AVIF decode error: ${result.error}`);
  }

  const outputDepth = result.depth as 8 | 10 | 12 | 16;
  let pixelData: Uint8Array | Uint16Array;

  // Copy pixel data from WASM heap in one operation (fast!)
  const byteArray = module.HEAPU8.slice(
    result.dataPtr,
    result.dataPtr + result.dataSize
  );
  module._free(result.dataPtr); // Free WASM memory

  if (outputDepth > 8) {
    // Data is uint16 stored as raw bytes (little-endian)
    pixelData = new Uint16Array(
      byteArray.buffer,
      byteArray.byteOffset,
      byteArray.byteLength / 2
    );
  } else {
    pixelData = byteArray;
  }

  return {
    data: pixelData,
    width: result.width,
    height: result.height,
    bitDepth: outputDepth,
    hasAlpha: result.hasAlpha,
    metadata: convertMetadata(result.metadata),
  };
}

/**
 * Decode AVIF to standard ImageData (8-bit RGBA)
 */
export async function decodeToImageData(
  input: Uint8Array | ArrayBuffer,
  options?: Omit<AVIFDecodeOptions, 'bitDepth'>
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
  input: Uint8Array | ArrayBuffer
): Promise<AVIFImageInfo> {
  await init();

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const result = decoderModule!.getImageInfo(uint8ArrayToString(data));

  return {
    width: result.width,
    height: result.height,
    bitDepth: result.depth,
    hasAlpha: result.hasAlpha,
    metadata: convertMetadata(result.metadata),
  };
}

export function isInitialized(): boolean {
  return decoderModule !== null;
}

export function isMultiThreaded(): boolean {
  return decoderModuleMT !== null;
}
