/**
 * AVIF Worker - runs encode/decode operations in a Web Worker
 */
import { createCodecWorker } from '@dimkatet/jcodecs-core/codec-worker';
import { encode } from './encode';
import { decode, init as initDecoder } from './decode';

createCodecWorker({
  init: async (payload: unknown) => {
    const { decoderJsUrl } = payload as { decoderJsUrl?: string };
    await initDecoder({ jsUrl: decoderJsUrl });
  },
  encode: (payload: unknown) => {
    const { imageData, options } = payload as { imageData: any; options?: any };
    return encode(imageData, options);
  },
  decode: (payload: unknown) => {
    const { data, options } = payload as { data: Uint8Array; options?: any };
    return decode(data, options);
  },
});
