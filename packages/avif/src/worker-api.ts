/**
 * Worker API for AVIF encoding/decoding
 */

import { WorkerPool } from '@jcodecs/core';
import type { AVIFEncodeOptions, AVIFDecodeOptions } from './options';
import type { AVIFImageData, AVIFMetadata } from './types';
import { DEFAULT_SRGB_METADATA } from './types';

interface WorkerPoolConfig {
  poolSize?: number;
  workerUrl?: string | URL;
  wasmUrls?: {
    encoder?: string;
    decoder?: string;
  };
}

interface EncodePayload {
  imageData: {
    data: Uint8Array | Uint16Array;
    width: number;
    height: number;
    hasAlpha: boolean;
    bitDepth: 8 | 10 | 12 | 16;
    metadata: AVIFMetadata;
  };
  options?: AVIFEncodeOptions;
}

interface DecodePayload {
  data: Uint8Array;
  options?: AVIFDecodeOptions;
}

let workerPool: WorkerPool<
  EncodePayload | DecodePayload,
  Uint8Array | AVIFImageData
> | null = null;
let initConfig: WorkerPoolConfig | null = null;

export async function initWorkerPool(
  config?: WorkerPoolConfig
): Promise<void> {
  if (workerPool) return;

  initConfig = config || {};

  const workerUrl =
    config?.workerUrl || new URL('./worker.js', import.meta.url);

  workerPool = new WorkerPool(
    () => {
      const worker = new Worker(workerUrl, { type: 'module' });

      worker.postMessage({
        type: 'init',
        id: -1,
        payload: {
          encoderWasmUrl: config?.wasmUrls?.encoder,
          decoderWasmUrl: config?.wasmUrls?.decoder,
        },
      });

      return worker;
    },
    config?.poolSize
  );

  await workerPool.init();
}

async function ensureInitialized(): Promise<void> {
  if (!workerPool) {
    await initWorkerPool(initConfig || undefined);
  }
}

export async function encodeInWorker(
  imageData: ImageData | AVIFImageData,
  options?: AVIFEncodeOptions
): Promise<Uint8Array> {
  await ensureInitialized();

  let data: Uint8Array | Uint16Array;
  let width: number;
  let height: number;
  let hasAlpha: boolean;
  let bitDepth: 8 | 10 | 12 | 16;
  let metadata: AVIFMetadata;

  if ('metadata' in imageData && 'bitDepth' in imageData) {
    data =
      imageData.data instanceof Uint16Array
        ? new Uint16Array(imageData.data)
        : new Uint8Array(imageData.data);
    width = imageData.width;
    height = imageData.height;
    hasAlpha = imageData.hasAlpha;
    bitDepth = imageData.bitDepth;
    metadata = { ...imageData.metadata };
  } else {
    data = new Uint8Array(imageData.data.buffer.slice(0));
    width = imageData.width;
    height = imageData.height;
    hasAlpha = true;
    bitDepth = 8;
    metadata = { ...DEFAULT_SRGB_METADATA };
  }

  const payload: EncodePayload = {
    imageData: { data, width, height, hasAlpha, bitDepth, metadata },
    options,
  };

  const result = await workerPool!.execute({
    type: 'encode',
    payload,
    transferables: [data.buffer],
  });

  return result as Uint8Array;
}

export async function decodeInWorker(
  input: Uint8Array | ArrayBuffer,
  options?: AVIFDecodeOptions
): Promise<AVIFImageData> {
  await ensureInitialized();

  const data =
    input instanceof ArrayBuffer
      ? new Uint8Array(input.slice(0))
      : new Uint8Array(
          input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
        );

  const payload: DecodePayload = { data, options };

  const result = await workerPool!.execute({
    type: 'decode',
    payload,
    transferables: [data.buffer],
  });

  return result as AVIFImageData;
}

export function getWorkerPoolStats(): {
  poolSize: number;
  availableWorkers: number;
  queuedTasks: number;
} | null {
  return workerPool?.getStats() || null;
}

export function terminateWorkerPool(): void {
  workerPool?.terminate();
  workerPool = null;
}

export function isWorkerPoolInitialized(): boolean {
  return workerPool?.isInitialized() || false;
}
