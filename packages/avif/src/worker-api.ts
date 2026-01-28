/**
 * Worker API for AVIF encoding/decoding
 */
import { CodecWorkerClient } from '@jcodecs/core/codec-worker-client';
import type { AVIFEncodeOptions, AVIFDecodeOptions } from './options';
import type { AVIFImageData } from './types';

const client = new CodecWorkerClient();

export async function initWorkerPool(config?: {
  poolSize?: number;
  workerUrl?: string | URL;
  wasmUrls?: { encoder?: string; decoder?: string };
}): Promise<void> {
  return client.init({
    workerUrl: config?.workerUrl ?? new URL('./worker.js', import.meta.url),
    poolSize: config?.poolSize,
    initPayload: {
      encoderWasmUrl: config?.wasmUrls?.encoder,
      decoderWasmUrl: config?.wasmUrls?.decoder,
    },
  });
}

export async function encodeInWorker(
  imageData: ImageData | AVIFImageData,
  options?: AVIFEncodeOptions,
): Promise<Uint8Array> {
  return client.call<Uint8Array>('encode', { imageData, options });
}

export async function decodeInWorker(
  input: Uint8Array | ArrayBuffer,
  options?: AVIFDecodeOptions,
): Promise<AVIFImageData> {
  const data =
    input instanceof ArrayBuffer
      ? new Uint8Array(input.slice(0))
      : new Uint8Array(
          input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength),
        );

  return client.call<AVIFImageData>('decode', { data, options }, [data.buffer]);
}

export const getWorkerPoolStats = () => client.getStats();
export const terminateWorkerPool = () => client.terminate();
export const isWorkerPoolInitialized = () => client.isInitialized();
