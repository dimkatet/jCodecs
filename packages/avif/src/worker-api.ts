/**
 * Worker API for AVIF encoding/decoding
 */
import {
  CodecWorkerClient,
  createWorkerHandle,
  type WorkerHandle,
} from "@dimkatet/jcodecs-core/codec-worker-client";
import { isMultiThreadSupported } from "@dimkatet/jcodecs-core";
import type { AVIFEncodeOptions, AVIFDecodeOptions } from "./options";
import type { AVIFImageData, AVIFEncodeDescriptor } from "./types";
import type { AVIFWorkerHandlers, WorkerInitPayload } from "./worker";
import {
  workerUrl as defaultWorkerUrl,
  mtDecoderUrl,
  stDecoderUrl,
} from "./urls";

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

export type AVIFWorkerHandle = WorkerHandle<
  AVIFDecodeOptions,
  AVIFImageData,
  Uint8Array | Uint16Array,
  AVIFEncodeDescriptor,
  AVIFEncodeOptions
>;

/** @deprecated use AVIFWorkerHandle */
export type AVIFWorkerClient = AVIFWorkerHandle;

export async function createWorkerPool(
  config?: WorkerPoolConfig,
): Promise<AVIFWorkerHandle> {
  const raw = new CodecWorkerClient<AVIFWorkerHandlers>();
  const useMT = isMultiThreadSupported() && config?.preferMT;

  await raw.init({
    workerUrl: config?.workerUrl ?? defaultWorkerUrl,
    poolSize: config?.poolSize,
    initPayload: {
      ...config,
      decoderUrl: useMT ? mtDecoderUrl : stDecoderUrl,
      encoderUrl: useMT ? mtEncoderUrl : stEncoderUrl,
    },
  });

  return createWorkerHandle(raw) as AVIFWorkerHandle;
}
