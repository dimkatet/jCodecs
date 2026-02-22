/**
 * EXR Worker - runs encode/decode operations in a Web Worker
 */
import { createCodecWorker } from "@dimkatet/jcodecs-core/codec-worker";
import { encode, init as initEncoder } from "./encode";
import { decode, init as initDecoder } from "./decode";
import { EXRDecodeOptions, EXREncodeOptions } from "./options";
import { EXREncodeDescriptor } from "./types";

export interface WorkerInitPayload {
  /** Custom URL for decoder JS (WASM is embedded) */
  decoderUrl?: string;
  /** Custom URL for encoder JS (WASM is embedded) */
  encoderUrl?: string;
  /** Initialize only decoder, encoder, or both (default: both) */
  type?: "decoder" | "encoder" | "both";
  /** If true, skips initialization on creation */
  lazyInit?: boolean;
}

let type: "decoder" | "encoder" | "both";
let decoderUrl: string | undefined;
let encoderUrl: string | undefined;

const handlers = {
  init: async (payload: WorkerInitPayload) => {
    ({ decoderUrl, encoderUrl, type = "both" } = payload);
    if (payload.lazyInit) return;
    if (type === "decoder" || type === "both") {
      await initDecoder({ jsUrl: decoderUrl });
    }
    if (type === "encoder" || type === "both") {
      await initEncoder({ jsUrl: encoderUrl });
    }
  },
  encode: (payload: {
    data: Float16Array | Float32Array;
    descriptor: EXREncodeDescriptor;
    options?: EXREncodeOptions;
  }) => {
    if (type === "decoder") {
      throw new Error("EXR encoder module is not initialized");
    }
    const { data, descriptor, options } = payload;
    return encode(data, descriptor, options, { jsUrl: encoderUrl });
  },
  decode: (payload: { data: Uint8Array; options?: EXRDecodeOptions }) => {
    if (type === "encoder") {
      throw new Error("EXR decoder module is not initialized");
    }
    const { data, options } = payload;
    return decode(data, options, { jsUrl: decoderUrl });
  },
};

export type EXRWorkerHandlers = typeof handlers;

createCodecWorker<EXRWorkerHandlers>(handlers);
