/**
 * Worker API for JXL encoding/decoding
 */
import {
  CodecWorkerClient,
  createWorkerHandle,
  type WorkerHandle,
} from "@dimkatet/jcodecs-core/codec-worker-client";
import { isMultiThreadSupported } from "@dimkatet/jcodecs-core";
import type { JXLEncodeOptions, JXLDecodeOptions } from "./options";
import type { JXLImageData, JXLEncodeDescriptor } from "./types";
import type { JXLWorkerHandlers, WorkerInitPayload } from "./worker";
import {
  workerUrl as defaultWorkerUrl,
  mtDecoderUrl,
  stDecoderUrl,
} from "./urls";

const mtEncoderUrl = new URL("./jxl_enc_mt.js", import.meta.url).href;
const stEncoderUrl = new URL("./jxl_enc.js", import.meta.url).href;

export interface WorkerPoolConfig extends WorkerInitPayload {
  /** Number of workers in the pool */
  poolSize?: number;
  /** Custom URL for the worker script */
  workerUrl?: string | URL;
  /** Prefer to use of multi-threaded decoder/encoder */
  preferMT?: boolean;
}

export type JXLWorkerHandle = WorkerHandle<
  JXLDecodeOptions,
  JXLImageData,
  Uint8Array | Uint16Array | Float16Array | Float32Array,
  JXLEncodeDescriptor,
  JXLEncodeOptions
>;

/** @deprecated use JXLWorkerHandle */
export type JXLWorkerClient = JXLWorkerHandle;

export async function createWorkerPool(
  config?: WorkerPoolConfig,
): Promise<JXLWorkerHandle> {
  const raw = new CodecWorkerClient<JXLWorkerHandlers>();
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

  return createWorkerHandle(raw) as JXLWorkerHandle;
}
