/**
 * Processing Worker — runs resize/crop/rotate in a Web Worker
 */
import { createCodecWorker } from '@dimkatet/jcodecs-core/codec-worker';
import type { CodecImageData } from '@dimkatet/jcodecs-core';
import { resize } from './resize';
import { crop }   from './crop';
import { rotate } from './rotate';
import { init }   from './_module';
import type { ResizeOptions } from './options';

export interface WorkerInitPayload {
  /** Custom URL for img_process.js (WASM embedded) */
  processUrl?: string;
  /** If true, skip WASM initialization on worker creation */
  lazyInit?: boolean;
}

const handlers = {
  init: async (payload: WorkerInitPayload) => {
    if (payload.lazyInit) return;
    await init({ jsUrl: payload.processUrl });
  },

  resize: (payload: {
    image: CodecImageData;
    target: { width: number; height: number };
    options?: ResizeOptions;
  }) => {
    const { image, target, options } = payload;
    return resize(image, target, options);
  },

  crop: (payload: {
    image: CodecImageData;
    region: { x: number; y: number; width: number; height: number };
  }) => {
    const { image, region } = payload;
    return crop(image, region);
  },

  rotate: (payload: {
    image: CodecImageData;
    degrees: 90 | 180 | 270;
  }) => {
    const { image, degrees } = payload;
    return rotate(image, degrees);
  },
};

export type ProcessingWorkerHandlers = typeof handlers;

createCodecWorker<ProcessingWorkerHandlers>(handlers);
