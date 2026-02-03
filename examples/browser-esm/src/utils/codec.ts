/**
 * Codec utilities - abstraction layer for encoding/decoding
 * Switches between Direct API and Worker Pool API based on config
 */

import type {
  AVIFEncodeOptions,
  AVIFImageData,
  AVIFWorkerClient,
  ExtendedImageData,
} from '@dimkatet/jcodecs-avif';
import {
  initEncoder as initAvifEncoder,
  initDecoder as initAvifDecoder,
  decode as decodeAvif,
  encode as encodeAvif,
  createWorkerPool as createAvifWorkerPool,
  decodeInWorker as decodeAvifInWorker,
  encodeInWorker as encodeAvifInWorker,
} from '@dimkatet/jcodecs-avif';
import {
  initDecoder as initJxlDecoder,
  initEncoder as initJxlEncoder,
  decode as decodeJxl,
  encode as encodeJxl,
  type JXLEncodeOptions,
} from '@dimkatet/jcodecs-jxl';

import {
  API_MODE,
  WORKER_CONFIG,
  DIRECT_CONFIG,
  THREAD_CONFIG,
} from '../config/api-mode';

type WorkerPool = AVIFWorkerClient;

// Worker pools (only initialized if API_MODE = 'worker')
let decodeWorkerPool: WorkerPool | null = null;
let encodeWorkerPool: WorkerPool | null = null;

/**
 * Initialize codecs based on API_MODE
 */
export async function initializeCodecs(): Promise<void> {
  if (API_MODE === 'worker') {
    console.log('[Codec] Initializing Worker Pool API...');
    [decodeWorkerPool, encodeWorkerPool] = await Promise.all([
      createAvifWorkerPool({ ...WORKER_CONFIG, type: 'decoder' }),
      createAvifWorkerPool({
        ...WORKER_CONFIG,
        type: 'encoder',
        lazyInit: true,
      }),
    ]);
    console.log('[Codec] Worker pools ready');
  } else {
    console.log('[Codec] Using Direct API');
    // Direct API doesn't need explicit initialization
    // (it auto-initializes on first use)
  }
}

/**
 * Decode image based on format
 */
export async function decode(
  data: Uint8Array,
  format: string
): Promise<ExtendedImageData> {
  const options = { maxThreads: THREAD_CONFIG.maxThreads };

  if (API_MODE === 'worker') {
    if (!decodeWorkerPool) {
      throw new Error('Worker pool not initialized');
    }
    if (format === 'avif') {
      return await decodeAvifInWorker(decodeWorkerPool, data, options);
    } else if (format === 'jxl') {
      // TODO: JXL worker support when available
      throw new Error('JXL worker API not yet implemented');
    }
  } else {
    // Direct API
    if (format === 'avif') {
      return await decodeAvif(data, options, DIRECT_CONFIG);
    } else if (format === 'jxl') {
      return await decodeJxl(data, options, DIRECT_CONFIG);
    }
  }

  throw new Error(`Unsupported format: ${format}`);
}

/**
 * Encode image based on format
 */
export async function encode(
  imageData: ExtendedImageData,
  format: string,
  options: AVIFEncodeOptions | JXLEncodeOptions
): Promise<Uint8Array> {
  const encodeOptions = {
    ...options,
    maxThreads: THREAD_CONFIG.maxThreads,
  };

  if (API_MODE === 'worker') {
    if (!encodeWorkerPool) {
      throw new Error('Worker pool not initialized');
    }
    if (format === 'avif') {
      return await encodeAvifInWorker(
        encodeWorkerPool,
        imageData as AVIFImageData,
        encodeOptions as AVIFEncodeOptions
      );
    } else if (format === 'jxl') {
      // TODO: JXL worker support when available
      throw new Error('JXL worker API not yet implemented');
    }
  } else {
    // Direct API
    if (format === 'avif') {
      return await encodeAvif(
        imageData as AVIFImageData,
        encodeOptions as AVIFEncodeOptions,
        DIRECT_CONFIG
      );
    } else if (format === 'jxl') {
      return await encodeJxl(
        imageData,
        encodeOptions as JXLEncodeOptions,
        DIRECT_CONFIG
      );
    }
  }

  throw new Error(`Unsupported format: ${format}`);
}

/**
 * Get current API mode (for UI display)
 */
export function getApiMode(): string {
  return API_MODE === 'worker' ? 'Worker Pool' : 'Direct';
}
