/**
 * Worker API for EXR encoding/decoding
 */
import {
  CodecWorkerClient,
  createWorkerHandle,
  type WorkerHandle,
} from "@dimkatet/jcodecs-core/codec-worker-client";
import { isMultiThreadSupported } from "@dimkatet/jcodecs-core";
import type { EXREncodeOptions, EXRDecodeOptions } from "./options";
import type { EXREncodeDescriptor, EXRImageData } from "./types";
import type { EXRWorkerHandlers, WorkerInitPayload } from "./worker";
import {
  workerUrl as defaultWorkerUrl,
  mtDecoderUrl,
  stDecoderUrl,
} from "./urls";

const mtEncoderUrl = new URL("./exr_enc_mt.js", import.meta.url).href;
const stEncoderUrl = new URL("./exr_enc.js", import.meta.url).href;

export interface WorkerPoolConfig extends WorkerInitPayload {
  /** Number of workers in the pool */
  poolSize?: number;
  /** Custom URL for the worker script */
  workerUrl?: string | URL;
  /** Prefer to use of multi-threaded decoder/encoder */
  preferMT?: boolean;
}

export type EXRWorkerHandle = WorkerHandle<
  EXRDecodeOptions,
  EXRImageData,
  Float16Array | Float32Array,
  EXREncodeDescriptor,
  EXREncodeOptions
>;

/** @deprecated use EXRWorkerHandle */
export type EXRWorkerClient = EXRWorkerHandle;

export async function createWorkerPool(
  config?: WorkerPoolConfig,
): Promise<EXRWorkerHandle> {
  const raw = new CodecWorkerClient<EXRWorkerHandlers>();
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

  // EXR encode does not transfer the buffer — pass encodeTransfer: false
  return createWorkerHandle(raw, { encodeTransfer: false }) as EXRWorkerHandle;
}
