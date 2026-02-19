import type { ImageDescriptor } from '@dimkatet/jcodecs-core';
import type { ImageFormat } from './format-detection';

// ============================================================================
// Unified image data — uses ImageDescriptor from core
// ============================================================================

/**
 * Unified image data with format information and ImageDescriptor.
 * Returned by auto decode() function.
 */
export interface AutoImageData {
  /** Raw pixel data */
  data: Uint8Array | Uint16Array | Float16Array | Float32Array;
  /** Image descriptor (geometry, channels, color, transfer, HDR metadata, etc.) */
  descriptor: ImageDescriptor;
  /** Detected/source format */
  format: ImageFormat;
}

/**
 * Image info without pixel data.
 * Returned by auto getImageInfo() function.
 */
export interface AutoImageInfo {
  /** Image descriptor */
  descriptor: ImageDescriptor;
  /** Detected/source format */
  format: ImageFormat;
}

// ============================================================================
// Type narrowing helpers
// ============================================================================

/**
 * Type guard for AVIF image data
 */
export function isAVIFImageData(
  data: AutoImageData,
): data is AutoImageData & { format: 'avif' } {
  return data.format === 'avif';
}

/**
 * Type guard for JXL image data
 */
export function isJXLImageData(
  data: AutoImageData,
): data is AutoImageData & { format: 'jxl' } {
  return data.format === 'jxl';
}

// ============================================================================
// Re-export codec types for convenience
// ============================================================================

export type { AVIFImageData, AVIFEncodeDescriptor } from '@dimkatet/jcodecs-avif';
export type { JXLImageData, JXLEncodeDescriptor } from '@dimkatet/jcodecs-jxl';
export type { ImageDescriptor } from '@dimkatet/jcodecs-core';
