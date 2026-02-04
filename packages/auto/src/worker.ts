/**
 * Multi-codec Worker - runs encode/decode operations in a Web Worker
 */
import { createCodecWorker } from '@dimkatet/jcodecs-core/codec-worker';
import type { ImageFormat } from './format-detection';
import type { AutoImageData } from './types';
import type { AutoDecodeOptions, AutoEncodeOptions } from './options';

export interface WorkerInitPayload {
  /** Prefer multi-threaded WASM modules */
  preferMT?: boolean;
  /** Formats to initialize (default: all available) */
  formats?: ImageFormat[];
  /** Initialize only decoder, encoder, or both (default: both) */
  type?: 'decoder' | 'encoder' | 'both';
  /** If true, skips initialization on creation */
  lazyInit?: boolean;
}

const handlers = {
  init: async (payload: WorkerInitPayload) => {
    if (payload.lazyInit) return;

    // Pre-load decode/encode to trigger codec registration
    const { ensureCodecsRegistered } = await import('./codec-registry');
    await ensureCodecsRegistered();
  },

  decode: async (payload: {
    data: Uint8Array;
    options?: AutoDecodeOptions;
  }): Promise<AutoImageData> => {
    const { decode } = await import('./decode');
    return decode(payload.data, payload.options);
  },

  encode: async (payload: {
    imageData: AutoImageData | ImageData;
    options: AutoEncodeOptions;
  }): Promise<Uint8Array> => {
    const { encode } = await import('./encode');
    return encode(payload.imageData, payload.options);
  },

  transcode: async (payload: {
    data: Uint8Array;
    targetFormat: 'avif' | 'jxl';
    options?: Omit<AutoEncodeOptions, 'format'>;
  }): Promise<Uint8Array> => {
    const { transcode } = await import('./encode');
    return transcode(payload.data, payload.targetFormat, payload.options);
  },
};

export type AutoWorkerHandlers = typeof handlers;

createCodecWorker<AutoWorkerHandlers>(handlers);
