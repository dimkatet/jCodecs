// Encoder
export {
  encode,
  encodeSimple,
  init as initEncoder,
  isInitialized as isEncoderInitialized,
} from './encode';

export type { InitConfig as EncoderInitConfig } from './encode';

// Decoder
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
} from './options';

export { DEFAULT_ENCODE_OPTIONS, DEFAULT_DECODE_OPTIONS } from './options';

// JXL-specific types
export type {
  JXLDataType,
  JXLImageData,
  JXLEncodeDescriptor,
} from './types';

export { SUPPORTED_DATA_TYPES } from './types';

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
export type { ImageDescriptor } from '@dimkatet/jcodecs-core';
