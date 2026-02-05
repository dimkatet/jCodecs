/**
 * Worker API for JXL encoding/decoding
 */
import { CodecWorkerClient } from "@dimkatet/jcodecs-core/codec-worker-client";
import { isMultiThreadSupported } from "@dimkatet/jcodecs-core";
import type { JXLEncodeOptions, JXLDecodeOptions } from "./options";
import type { JXLImageData } from "./types";
import type { JXLWorkerHandlers, WorkerInitPayload } from "./worker";
import {
  workerUrl as defaultWorkerUrl,
  mtDecoderUrl,
  stDecoderUrl,
  mtEncoderUrl,
  stEncoderUrl,
} from "./urls";

export interface WorkerPoolConfig extends WorkerInitPayload {
  /** Number of workers in the pool */
  poolSize?: number;
  /** Custom URL for the worker script */
  workerUrl?: string | URL;
  /** Prefer to use of multi-threaded decoder/encoder */
  preferMT?: boolean;
}

export type JXLWorkerClient = CodecWorkerClient<JXLWorkerHandlers>;

export async function createWorkerPool(
  config?: WorkerPoolConfig,
): Promise<JXLWorkerClient> {
  const client = new CodecWorkerClient<JXLWorkerHandlers>();
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
  client: JXLWorkerClient,
  imageData: JXLImageData,
  options?: JXLEncodeOptions,
): Promise<Uint8Array> {
  return client.call("encode", { imageData, options });
}

export async function decodeInWorker(
  client: JXLWorkerClient,
  input: Uint8Array | ArrayBuffer,
  options?: JXLDecodeOptions,
): Promise<JXLImageData> {
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

export const getWorkerPoolStats = (client: JXLWorkerClient) =>
  client.getStats();
export const terminateWorkerPool = (client: JXLWorkerClient) =>
  client.terminate();
export const isWorkerPoolInitialized = (client: JXLWorkerClient) =>
  client.isInitialized();
