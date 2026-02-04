/**
 * Worker Pool API for multi-codec operations
 */
import { CodecWorkerClient } from '@dimkatet/jcodecs-core/codec-worker-client';
import { isMultiThreadSupported } from '@dimkatet/jcodecs-core';
import type { AutoImageData } from './types';
import type { AutoDecodeOptions, AutoEncodeOptions } from './options';
import type { AutoWorkerHandlers, WorkerInitPayload } from './worker';

const defaultWorkerUrl = new URL('./worker.js', import.meta.url);

export interface AutoWorkerPoolConfig extends WorkerInitPayload {
  /** Number of workers in the pool */
  poolSize?: number;
  /** Custom URL for the worker script */
  workerUrl?: string | URL;
}

export type AutoWorkerClient = CodecWorkerClient<AutoWorkerHandlers>;

/**
 * Create a worker pool for multi-codec operations
 */
export async function createWorkerPool(
  config?: AutoWorkerPoolConfig,
): Promise<AutoWorkerClient> {
  const client = new CodecWorkerClient<AutoWorkerHandlers>();
  const useMT = isMultiThreadSupported() && config?.preferMT;

  await client.init({
    workerUrl: config?.workerUrl ?? defaultWorkerUrl,
    poolSize: config?.poolSize,
    initPayload: {
      preferMT: useMT,
      formats: config?.formats,
      type: config?.type ?? 'both',
      lazyInit: config?.lazyInit ?? false,
    },
  });

  return client;
}

/**
 * Decode image in worker with auto-detection
 */
export async function decodeInWorker(
  client: AutoWorkerClient,
  input: Uint8Array | ArrayBuffer,
  options?: AutoDecodeOptions,
): Promise<AutoImageData> {
  const data =
    input instanceof ArrayBuffer
      ? new Uint8Array(input.slice(0))
      : new Uint8Array(
          input.buffer.slice(
            input.byteOffset,
            input.byteOffset + input.byteLength,
          ),
        );

  return client.call('decode', { data, options }, [data.buffer]);
}

/**
 * Encode image in worker
 */
export async function encodeInWorker(
  client: AutoWorkerClient,
  imageData: AutoImageData | ImageData,
  options: AutoEncodeOptions,
): Promise<Uint8Array> {
  return client.call('encode', { imageData, options });
}

/**
 * Transcode image in worker (decode + encode in single call)
 */
export async function transcodeInWorker(
  client: AutoWorkerClient,
  input: Uint8Array | ArrayBuffer,
  targetFormat: 'avif' | 'jxl',
  options?: Omit<AutoEncodeOptions, 'format'>,
): Promise<Uint8Array> {
  const data =
    input instanceof ArrayBuffer
      ? new Uint8Array(input.slice(0))
      : new Uint8Array(
          input.buffer.slice(
            input.byteOffset,
            input.byteOffset + input.byteLength,
          ),
        );

  return client.call('transcode', { data, targetFormat, options }, [data.buffer]);
}

/**
 * Get worker pool statistics
 */
export const getWorkerPoolStats = (client: AutoWorkerClient) =>
  client.getStats();

/**
 * Terminate worker pool
 */
export const terminateWorkerPool = (client: AutoWorkerClient) =>
  client.terminate();

/**
 * Check if worker pool is initialized
 */
export const isWorkerPoolInitialized = (client: AutoWorkerClient) =>
  client.isInitialized();
