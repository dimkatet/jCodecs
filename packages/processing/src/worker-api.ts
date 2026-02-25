/**
 * Worker API for image processing operations
 */
import {
  CodecWorkerClient,
} from '@dimkatet/jcodecs-core/codec-worker-client';
import type { CodecImageData } from '@dimkatet/jcodecs-core';
import type { ResizeOptions, WorkerPoolConfig } from './options';
import type { ProcessingWorkerHandlers, WorkerInitPayload } from './worker';
import { processUrl, workerUrl as defaultWorkerUrl } from './urls';

export interface ProcessingWorkerHandle {
  resize(
    image: CodecImageData,
    target: { width: number; height: number },
    options?: ResizeOptions,
  ): Promise<CodecImageData>;

  crop(
    image: CodecImageData,
    region: { x: number; y: number; width: number; height: number },
  ): Promise<CodecImageData>;

  rotate(
    image: CodecImageData,
    degrees: 90 | 180 | 270,
  ): Promise<CodecImageData>;

  getStats(): ReturnType<CodecWorkerClient['getStats']>;
  terminate(): void;
  isInitialized(): boolean;
}

export async function createWorkerPool(
  config?: WorkerPoolConfig,
): Promise<ProcessingWorkerHandle> {
  const raw = new CodecWorkerClient<ProcessingWorkerHandlers>();

  const initPayload: WorkerInitPayload = {
    processUrl: config?.processUrl ?? processUrl,
  };

  await raw.init({
    workerUrl:   config?.workerUrl ?? defaultWorkerUrl,
    poolSize:    config?.poolSize,
    initPayload,
  });

  return {
    resize: (image, target, options) =>
      raw.call('resize', { image, target, options }),

    crop: (image, region) =>
      raw.call('crop', { image, region }),

    rotate: (image, degrees) =>
      raw.call('rotate', { image, degrees }),

    getStats:     () => raw.getStats(),
    terminate:    () => raw.terminate(),
    isInitialized: () => raw.isInitialized(),
  };
}
