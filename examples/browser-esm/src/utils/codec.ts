/**
 * Codec utilities - abstraction layer for encoding/decoding
 * Uses @jcodecs/auto for unified API across all formats
 */

import type {
  AutoImageData,
  AutoEncodeOptions,
  AutoWorkerClient,
  ImageFormat,
  ImageDescriptor,
} from '@dimkatet/jcodecs-auto';
import {
  decode as autoDecode,
  encode as autoEncode,
  detectFormat,
  createWorkerPool,
  decodeInWorker,
  encodeInWorker,
} from '@dimkatet/jcodecs-auto';

import {
  API_MODE,
  WORKER_CONFIG,
  THREAD_CONFIG,
} from '../config/api-mode';

// Worker pool (only initialized if API_MODE = 'worker')
let workerPool: AutoWorkerClient | null = null;

// CSS color space names → CID primaries
const COLOR_SPACE_TO_PRIMARIES: Record<string, string> = {
  srgb: 'bt709',
  'display-p3': 'displayP3',
  rec2020: 'bt2020',
  bt709: 'bt709',
};

// Chroma subsampling: colon notation → CID notation
const CHROMA_SUBSAMPLING_MAP: Record<string, string> = {
  '4:4:4': '444',
  '4:2:2': '422',
  '4:2:0': '420',
  '4:0:0': '400',
};

/**
 * Apply encoding options to a cloned descriptor.
 * colorSpace/bitDepth/transferFunction/chromaSubsampling are descriptor fields.
 */
function applyOptionsToDescriptor(
  descriptor: ImageDescriptor,
  options: Record<string, unknown>,
): ImageDescriptor {
  const desc: ImageDescriptor = {
    ...descriptor,
    geometry: { ...descriptor.geometry },
    channels: { ...descriptor.channels },
    numeric: { ...descriptor.numeric },
    color: descriptor.color ? { ...descriptor.color } : undefined,
    transfer: descriptor.transfer ? { ...descriptor.transfer } : undefined,
    sampling: descriptor.sampling ? { ...descriptor.sampling } : undefined,
  };

  // bitDepth → numeric.bitDepth + numeric.dataType
  if (options.bitDepth != null) {
    const bitDepth = options.bitDepth as number;
    desc.numeric = {
      ...desc.numeric,
      bitDepth,
      dataType: (bitDepth <= 8 ? 'uint8' : 'uint16') as any,
    };
  }

  // colorSpace (CSS name) → color.primaries (CID name)
  if (options.colorSpace != null) {
    const primaries = COLOR_SPACE_TO_PRIMARIES[options.colorSpace as string];
    if (primaries) {
      desc.color = { ...desc.color, primaries: primaries as any };
    }
  }

  // transferFunction → transfer.function
  if (options.transferFunction != null) {
    desc.transfer = { ...desc.transfer, function: options.transferFunction as any };
  }

  // chromaSubsampling (colon notation) → sampling.chromaSubsampling (CID notation)
  if (options.chromaSubsampling != null) {
    const chroma =
      CHROMA_SUBSAMPLING_MAP[options.chromaSubsampling as string] ??
      options.chromaSubsampling;
    desc.sampling = { ...desc.sampling, chromaSubsampling: chroma as any };
  }

  return desc;
}

/**
 * Initialize codecs based on API_MODE
 */
export async function initializeCodecs(): Promise<void> {
  if (API_MODE === 'worker') {
    console.log('[Codec] Initializing Worker Pool API...');
    workerPool = await createWorkerPool({
      ...WORKER_CONFIG,
      type: 'both',
    });
    console.log('[Codec] Worker pool ready');
  } else {
    console.log('[Codec] Using Direct API');
  }
}

/**
 * Decode image with auto-detection or specified format
 */
export async function decode(
  data: Uint8Array,
  format?: string,
): Promise<AutoImageData> {
  const options = {
    format: format as ImageFormat | undefined,
    maxThreads: THREAD_CONFIG.maxThreads,
  };

  if (API_MODE === 'worker') {
    if (!workerPool) {
      throw new Error('Worker pool not initialized');
    }
    return await decodeInWorker(workerPool, data, options);
  }

  return await autoDecode(data, options);
}

/**
 * Encode image to specified format
 */
export async function encode(
  imageData: AutoImageData,
  format: string,
  options: Record<string, unknown>,
): Promise<Uint8Array> {
  // Apply descriptor-level options (bitDepth, colorSpace, transferFunction, chromaSubsampling)
  const modifiedDescriptor = applyOptionsToDescriptor(imageData.descriptor, options);
  const modifiedImageData: AutoImageData = { ...imageData, descriptor: modifiedDescriptor };

  const encodeOptions: AutoEncodeOptions = {
    format: format as 'avif' | 'jxl' | 'exr',
    quality: options.quality as number | undefined,
    lossless: options.lossless as boolean | undefined,
    maxThreads: THREAD_CONFIG.maxThreads,
    // Format-specific codec options
    ...(format === 'avif' && options.speed != null
      ? { avif: { speed: options.speed as number } }
      : {}),
    ...(format === 'jxl'
      ? {
          jxl: {
            ...(options.effort != null ? { effort: options.effort as number } : {}),
            ...(options.progressive != null
              ? { progressive: options.progressive as boolean }
              : {}),
          },
        }
      : {}),
  };

  if (API_MODE === 'worker') {
    if (!workerPool) {
      throw new Error('Worker pool not initialized');
    }
    return await encodeInWorker(workerPool, modifiedImageData, encodeOptions);
  }

  return await autoEncode(modifiedImageData, encodeOptions);
}

/**
 * Detect format from buffer
 */
export { detectFormat };

/**
 * Get current API mode (for UI display)
 */
export function getApiMode(): string {
  return API_MODE === 'worker' ? 'Worker Pool' : 'Direct';
}
