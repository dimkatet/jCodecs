/**
 * JXL Worker - runs encode/decode operations in a Web Worker
 */
import { createCodecWorker } from "@dimkatet/jcodecs-core/codec-worker";
import { encode, init as initEncoder } from "./encode";
import { decode, init as initDecoder } from "./decode";
import { JXLDecodeOptions, JXLEncodeOptions } from "./options";
import { JXLImageData } from "./types";

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
    imageData: JXLImageData;
    options?: JXLEncodeOptions;
  }) => {
    if (type === "decoder") {
      throw new Error("JXL encoder module is not initialized");
    }
    const { imageData, options } = payload;

    return encode(imageData, options, { jsUrl: encoderUrl });
  },
  decode: (payload: { data: Uint8Array; options?: JXLDecodeOptions }) => {
    if (type === "encoder") {
      throw new Error("JXL decoder module is not initialized");
    }
    const { data, options } = payload;
    return decode(data, options, { jsUrl: decoderUrl });
  },
};

export type JXLWorkerHandlers = typeof handlers;

createCodecWorker<JXLWorkerHandlers>(handlers);
