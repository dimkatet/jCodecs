// Main exports
export {
  encode,
  init as initEncoder,
  isInitialized as isEncoderInitialized,
  isMultiThreaded as isEncoderMultiThreaded,
} from './encode';

export {
  decode,
  decodeToImageData,
  getImageInfo,
  init as initDecoder,
  isInitialized as isDecoderInitialized,
  isMultiThreaded as isDecoderMultiThreaded,
} from './decode';

// Options
export type {
  AVIFEncodeOptions,
  AVIFDecodeOptions,
  ChromaSubsampling,
  ColorSpace,
  EncoderTune,
} from './options';

export { DEFAULT_ENCODE_OPTIONS, DEFAULT_DECODE_OPTIONS } from './options';

// AVIF-specific types
export type {
  AVIFMetadata,
  AVIFImageData,
  AVIFImageInfo,
  ColorPrimaries,
  TransferFunction,
  MatrixCoefficients,
  MasteringDisplay,
} from './types';

export { DEFAULT_SRGB_METADATA } from './types';

// Worker API
export {
  initWorkerPool,
  encodeInWorker,
  decodeInWorker,
  getWorkerPoolStats,
  terminateWorkerPool,
  isWorkerPoolInitialized,
} from './worker-api';

// Re-export generic types from core
export type { ExtendedImageData, ImageInfo } from '@dimkatet/jcodecs-core';

/**
 * Initialize decoder (encoder not yet available)
 */
export async function init(options?: {
  decoderWasmUrl?: string;
}): Promise<void> {
  const { init: initDecoder } = await import('./decode');
  await initDecoder(options?.decoderWasmUrl);
}
