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
  EXREncodeOptions,
  EXRDecodeOptions,
} from './options';

export { DEFAULT_ENCODE_OPTIONS, DEFAULT_DECODE_OPTIONS } from './options';

// EXR-specific types
export type {
  EXRImageData,
  EXREncodeDescriptor,
  EXRFormatSpecific,
  EXRChromaticities,
  EXRDataType,
  EXRCompression,
} from './types';

// Worker API
export { createWorkerPool } from './worker-api';

export type { WorkerPoolConfig, EXRWorkerHandle, EXRWorkerClient } from './worker-api';

// Re-export from core
export { isMultiThreadSupported } from '@dimkatet/jcodecs-core';
export type { ImageDescriptor } from '@dimkatet/jcodecs-core';
