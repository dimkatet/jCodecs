// Main exports
export {
  encode,
  encodeSimple,
  init as initEncoder,
  isInitialized as isEncoderInitialized,
} from './encode';

export type { InitConfig as EncoderInitConfig } from './encode';

export {
  decode,
  decodeToImageData,
  getImageInfo,
  init as initDecoder,
  isInitialized as isDecoderInitialized,
  isMultiThreaded as isDecoderMultiThreaded,
  isMultiThreadSupported,
} from './decode';

export type { InitConfig as DecoderInitConfig } from './decode';

// Options
export type {
  AVIFEncodeOptions,
  AVIFDecodeOptions,
  ChromaSubsampling,
  ColorSpace,
  EncoderTune,
  TransferFunctionOption,
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
  createWorkerPool,
  encodeInWorker,
  decodeInWorker,
  getWorkerPoolStats,
  terminateWorkerPool,
  isWorkerPoolInitialized,
} from './worker-api';

export type { WorkerPoolConfig, AVIFWorkerClient } from './worker-api';

// Re-export generic types from core
export type { ExtendedImageData, ImageInfo } from '@dimkatet/jcodecs-core';
