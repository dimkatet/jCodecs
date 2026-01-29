/**
 * Worker API for AVIF encoding/decoding
 */
import { CodecWorkerClient } from '@dimkatet/jcodecs-core/codec-worker-client';
import { isMultiThreadSupported } from './decode';
import type { AVIFEncodeOptions, AVIFDecodeOptions } from './options';
import type { AVIFImageData } from './types';

const client = new CodecWorkerClient();

// Default URLs - auto-detect MT support (WASM is embedded via SINGLE_FILE)
const defaultWorkerUrl = new URL('./worker.js', import.meta.url);
const defaultMtJsUrl = new URL('./avif_dec_mt.js', import.meta.url).href;
const defaultStJsUrl = new URL('./avif_dec.js', import.meta.url).href;

export interface WorkerPoolConfig {
  /** Number of workers in the pool */
  poolSize?: number;
  /** Custom URL for the worker script */
  workerUrl?: string | URL;
  /** Custom URL for decoder JS (WASM is embedded) */
  decoderJsUrl?: string;
}

export async function initWorkerPool(config?: WorkerPoolConfig): Promise<void> {
  // Auto-detect: use MT if supported and no custom URL provided
  const useMT = config?.decoderJsUrl
    ? config.decoderJsUrl.includes("_mt")
    : isMultiThreadSupported();

  return client.init({
    workerUrl: config?.workerUrl ?? defaultWorkerUrl,
    poolSize: config?.poolSize,
    initPayload: {
      decoderJsUrl: config?.decoderJsUrl ?? (useMT ? defaultMtJsUrl : defaultStJsUrl),
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
