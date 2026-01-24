/**
 * AVIF Worker - runs encode/decode operations in a Web Worker
 */

import { encode as avifEncode, init as initEncoder } from './encode';
import { decode as avifDecode, init as initDecoder } from './decode';
import type { AVIFEncodeOptions, AVIFDecodeOptions } from './options';
import type { AVIFImageData, AVIFMetadata } from './types';

interface WorkerMessage {
  type: 'init' | 'encode' | 'decode';
  id: number;
  payload: unknown;
}

interface InitPayload {
  encoderWasmUrl?: string;
  decoderWasmUrl?: string;
}

interface EncodePayload {
  imageData: {
    data: Uint8Array | Uint16Array;
    width: number;
    height: number;
    hasAlpha: boolean;
    bitDepth: 8 | 10 | 12 | 16;
    metadata: AVIFMetadata;
  };
  options?: AVIFEncodeOptions;
}

interface DecodePayload {
  data: Uint8Array;
  options?: AVIFDecodeOptions;
}

const ctx = self as unknown as Worker;

let initialized = false;

ctx.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  const { type, id, payload } = e.data;

  try {
    switch (type) {
      case 'init': {
        const { encoderWasmUrl, decoderWasmUrl } = payload as InitPayload;

        await Promise.all([
          initEncoder(encoderWasmUrl),
          initDecoder(decoderWasmUrl),
        ]);

        initialized = true;
        ctx.postMessage({ type: 'ready' });
        break;
      }

      case 'encode': {
        if (!initialized) {
          throw new Error('Worker not initialized. Call init() first.');
        }

        const { imageData, options } = payload as EncodePayload;

        const extendedImageData: AVIFImageData = {
          data: imageData.data,
          width: imageData.width,
          height: imageData.height,
          hasAlpha: imageData.hasAlpha,
          bitDepth: imageData.bitDepth,
          metadata: imageData.metadata,
        };

        const result = await avifEncode(extendedImageData, options);

        ctx.postMessage({ id, success: true, data: result }, [result.buffer]);
        break;
      }

      case 'decode': {
        if (!initialized) {
          throw new Error('Worker not initialized. Call init() first.');
        }

        const { data, options } = payload as DecodePayload;

        const result = await avifDecode(data, options);

        const buffer =
          result.data instanceof Uint16Array
            ? result.data.buffer
            : (result.data as Uint8Array).buffer;

        ctx.postMessage({ id, success: true, data: result }, [buffer]);
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    ctx.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

ctx.postMessage({ type: 'loaded' });
