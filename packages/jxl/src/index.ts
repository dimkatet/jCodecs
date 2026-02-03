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
} from './decode';

export type { InitConfig as DecoderInitConfig } from './decode';

// Options
export type {
  JXLEncodeOptions,
  JXLDecodeOptions,
  ColorSpace,
  TransferFunctionOption,
} from './options';

export { DEFAULT_ENCODE_OPTIONS, DEFAULT_DECODE_OPTIONS } from './options';

// JXL-specific types
export type {
  JXLMetadata,
  JXLImageData,
  JXLImageInfo,
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

export type { WorkerPoolConfig, JXLWorkerClient } from './worker-api';

// Re-export from core
export { isMultiThreadSupported } from '@dimkatet/jcodecs-core';
export type { ExtendedImageData, ImageInfo } from '@dimkatet/jcodecs-core';
