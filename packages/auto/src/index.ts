/**
 * @dimkatet/jcodecs-auto
 *
 * Auto-detect image format and select codec for jCodecs.
 * Supports AVIF and JPEG-XL with automatic format detection.
 */

// ============================================================================
// Format detection
// ============================================================================

export {
  detectFormat,
  getFormatExtension,
  getMimeType,
} from './format-detection';
export type { ImageFormat } from './format-detection';

// ============================================================================
// Codec registry
// ============================================================================

export {
  isCodecAvailable,
  getAvailableFormats,
  ensureCodecsRegistered,
} from './codec-registry';

// ============================================================================
// Decode
// ============================================================================

export { decode, decodeToImageData, getImageInfo } from './decode';

// ============================================================================
// Encode
// ============================================================================

export { encode, encodeSimple, transcode } from './encode';

// ============================================================================
// Types
// ============================================================================

export type {
  AutoImageData,
  AutoImageInfo,
  AutoMetadata,
  AutoDataType,
  AVIFAutoMetadata,
  JXLAutoMetadata,
  BaseMetadata,
  // Re-exports from codec packages
  AVIFMetadata,
  AVIFImageData,
  JXLMetadata,
  JXLImageData,
  DataType,
  ExtendedImageData,
  ImageInfo,
} from './types';

export { isAVIFImageData, isJXLImageData } from './types';

// ============================================================================
// Options
// ============================================================================

export type {
  AutoDecodeOptions,
  AutoEncodeOptions,
  ColorSpace,
  TransferFunctionOption,
  // Re-exports from codec packages
  AVIFEncodeOptions,
  AVIFDecodeOptions,
  JXLEncodeOptions,
  JXLDecodeOptions,
} from './options';

export { DEFAULT_DECODE_OPTIONS, DEFAULT_ENCODE_OPTIONS } from './options';

// ============================================================================
// Worker API
// ============================================================================

export {
  createWorkerPool,
  decodeInWorker,
  encodeInWorker,
  transcodeInWorker,
  getWorkerPoolStats,
  terminateWorkerPool,
  isWorkerPoolInitialized,
  isCodecPoolInitialized,
} from './worker-api';

export type {
  WorkerPoolConfig,
  AutoWorkerPoolConfig,
  AutoWorkerClient,
} from './worker-api';

// ============================================================================
// Errors
// ============================================================================

export {
  CodecNotInstalledError,
  CodecLoadError,
  UnsupportedFormatError,
} from './errors';

// ============================================================================
// Re-exports from core
// ============================================================================

export { isMultiThreadSupported } from '@dimkatet/jcodecs-core';
