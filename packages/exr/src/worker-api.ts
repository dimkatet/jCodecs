/**
 * Worker API for EXR encoding/decoding
 */
import { CodecWorkerClient } from "@dimkatet/jcodecs-core/codec-worker-client";
import { isMultiThreadSupported } from "@dimkatet/jcodecs-core";
import type { EXREncodeOptions, EXRDecodeOptions } from "./options";
import type { EXREncodeDescriptor, EXRImageData } from "./types";
import type { EXRWorkerHandlers, WorkerInitPayload } from "./worker";
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

export type EXRWorkerClient = CodecWorkerClient<EXRWorkerHandlers>;

export async function createWorkerPool(
  config?: WorkerPoolConfig,
): Promise<EXRWorkerClient> {
  const client = new CodecWorkerClient<EXRWorkerHandlers>();
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
  client: EXRWorkerClient,
  data: Float16Array | Float32Array,
  descriptor: EXREncodeDescriptor,
  options?: EXREncodeOptions,
): Promise<Uint8Array> {
  return client.call("encode", { data, descriptor, options });
}

export async function decodeInWorker(
  client: EXRWorkerClient,
  input: Uint8Array | ArrayBuffer,
  options?: EXRDecodeOptions,
): Promise<EXRImageData> {
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

export const getWorkerPoolStats = (client: EXRWorkerClient) =>
  client.getStats();
export const terminateWorkerPool = (client: EXRWorkerClient) =>
  client.terminate();
export const isWorkerPoolInitialized = (client: EXRWorkerClient) =>
  client.isInitialized();
