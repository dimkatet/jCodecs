/**
 * Worker API for AVIF encoding/decoding
 */
import { CodecWorkerClient } from "@dimkatet/jcodecs-core/codec-worker-client";
import { isMultiThreadSupported } from "@dimkatet/jcodecs-core";
import type { AVIFEncodeOptions, AVIFDecodeOptions } from "./options";
import type { AVIFImageData } from "./types";
import type { AVIFWorkerHandlers, WorkerInitPayload } from "./worker";

// Default URLs - auto-detect MT support (WASM is embedded via SINGLE_FILE)
const defaultWorkerUrl = new URL("./worker.js", import.meta.url);
const mtDecoderUrl = new URL("./avif_dec_mt.js", import.meta.url).href;
const stDecoderUrl = new URL("./avif_dec.js", import.meta.url).href;
const mtEncoderUrl = new URL("./avif_enc_mt.js", import.meta.url).href;
const stEncoderUrl = new URL("./avif_enc.js", import.meta.url).href;

export interface WorkerPoolConfig extends WorkerInitPayload {
  /** Number of workers in the pool */
  poolSize?: number;
  /** Custom URL for the worker script */
  workerUrl?: string | URL;
  /** Prefer to use of multi-threaded decoder */
  preferMT?: boolean;
}

export type AVIFWorkerClient = CodecWorkerClient<AVIFWorkerHandlers>;

export async function createWorkerPool(
  config?: WorkerPoolConfig,
): Promise<AVIFWorkerClient> {
  const client = new CodecWorkerClient<AVIFWorkerHandlers>();
  const useMT = isMultiThreadSupported() && config?.preferMT;
  
  const decoderUrl = useMT ? mtDecoderUrl : stDecoderUrl;
  const encoderUrl = useMT ? mtEncoderUrl : stEncoderUrl;

  await client.init({
    workerUrl: config?.workerUrl ?? defaultWorkerUrl,
    poolSize: config?.poolSize,
    initPayload: {
      ...config,
      decoderUrl,
      encoderUrl,
    },
  });

  return client;
}

export async function encodeInWorker(
  client: AVIFWorkerClient,
  imageData: AVIFImageData,
  options?: AVIFEncodeOptions,
): Promise<Uint8Array> {

  return client.call("encode", { imageData, options });
}

export async function decodeInWorker(
  client: AVIFWorkerClient,
  input: Uint8Array | ArrayBuffer,
  options?: AVIFDecodeOptions,
): Promise<AVIFImageData> {
  const data =
    input instanceof ArrayBuffer
      ? new Uint8Array(input.slice(0))
      : new Uint8Array(
          input.buffer.slice(
            input.byteOffset,
            input.byteOffset + input.byteLength,
          ),
        );

  return client.call("decode", { data, options }, [data.buffer]);
}

export const getWorkerPoolStats = (client: AVIFWorkerClient) =>
  client.getStats();
export const terminateWorkerPool = (client: AVIFWorkerClient) =>
  client.terminate();
export const isWorkerPoolInitialized = (client: AVIFWorkerClient) =>
  client.isInitialized();
