import type { ExtendedImageData } from '@jcodecs/core';
import type { AVIFEncodeOptions } from './options';

/**
 * AVIF Encoder is not yet available.
 * The encoder requires aom library which needs special WASM SIMD configuration.
 * Only decoder (dav1d) is currently supported.
 *
 * TODO: Add encoder support with proper WASM SIMD configuration
 */

const ENCODER_NOT_AVAILABLE_ERROR =
  'AVIF encoder is not yet available. Only decoder is currently supported. ' +
  'See: https://github.com/jcodecs/jcodecs/issues/1';

/**
 * Initialize the AVIF encoder (NOT AVAILABLE)
 * @throws Error - Encoder not available
 */
export async function init(_wasmUrl?: string): Promise<void> {
  throw new Error(ENCODER_NOT_AVAILABLE_ERROR);
}

/**
 * Encode image data to AVIF format (NOT AVAILABLE)
 * @throws Error - Encoder not available
 */
export async function encode(
  _imageData: ImageData | ExtendedImageData,
  _options?: AVIFEncodeOptions
): Promise<Uint8Array> {
  throw new Error(ENCODER_NOT_AVAILABLE_ERROR);
}

/**
 * Check if encoder is initialized
 */
export function isInitialized(): boolean {
  return false;
}

/**
 * Check if multi-threaded encoder is available
 */
export function isMultiThreaded(): boolean {
  return false;
}
