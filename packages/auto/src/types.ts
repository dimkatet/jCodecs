import type { DataType } from '@dimkatet/jcodecs-core';
import type { AVIFMetadata } from '@dimkatet/jcodecs-avif';
import type { JXLMetadata } from '@dimkatet/jcodecs-jxl';
import type { ImageFormat } from './format-detection';

// ============================================================================
// Type mappings
// ============================================================================

type TypedArrayForDataType<T extends DataType> = T extends 'uint8'
  ? Uint8Array
  : T extends 'uint16'
    ? Uint16Array
    : T extends 'float16'
      ? Float16Array
      : T extends 'float32'
        ? Float32Array
        : never;

// ============================================================================
// Discriminated union for metadata
// ============================================================================

/** Base metadata fields common to all formats */
export interface BaseMetadata {
  colorPrimaries: string;
  transferFunction: string;
  fullRange: boolean;
  maxCLL: number;
  maxPALL: number;
  masteringDisplay?: {
    primaries: {
      red: [number, number];
      green: [number, number];
      blue: [number, number];
    };
    whitePoint: [number, number];
    luminance: { min: number; max: number };
  };
  iccProfile?: Uint8Array;
  isHDR: boolean;
}

/** AVIF metadata with format discriminator */
export type AVIFAutoMetadata = { format: 'avif' } & AVIFMetadata;

/** JXL metadata with format discriminator */
export type JXLAutoMetadata = { format: 'jxl' } & JXLMetadata;

/** Unknown format metadata */
export type UnknownAutoMetadata = { format: 'unknown' } & BaseMetadata;

/** Union of all metadata types with format discriminator */
export type AutoMetadata = AVIFAutoMetadata | JXLAutoMetadata | UnknownAutoMetadata;

// ============================================================================
// Unified ImageData type
// ============================================================================

/** All supported pixel data types */
export type AutoDataType = DataType;

/**
 * Unified image data with format information
 */
export interface AutoImageData<T extends AutoDataType = AutoDataType> {
  /** Raw pixel data */
  data: TypedArrayForDataType<T>;
  /** Data type */
  dataType: T;
  /** Bit depth (8, 10, 12, 16, 32) */
  bitDepth: number;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Number of channels */
  channels: number;
  /** Detected/source format */
  format: ImageFormat;
  /** Format-specific metadata */
  metadata: AutoMetadata;
}

// ============================================================================
// Type narrowing helpers
// ============================================================================

/**
 * Type guard for AVIF image data
 */
export function isAVIFImageData(
  data: AutoImageData,
): data is AutoImageData & { format: 'avif'; metadata: AVIFAutoMetadata } {
  return data.format === 'avif';
}

/**
 * Type guard for JXL image data
 */
export function isJXLImageData(
  data: AutoImageData,
): data is AutoImageData & { format: 'jxl'; metadata: JXLAutoMetadata } {
  return data.format === 'jxl';
}

// ============================================================================
// Image info (without pixel data)
// ============================================================================

/**
 * Image info without pixel data
 */
export interface AutoImageInfo {
  width: number;
  height: number;
  bitDepth: number;
  channels: number;
  format: ImageFormat;
  metadata: AutoMetadata;
}

// ============================================================================
// Re-export codec types for convenience
// ============================================================================

export type { AVIFMetadata, AVIFImageData } from '@dimkatet/jcodecs-avif';
export type { JXLMetadata, JXLImageData } from '@dimkatet/jcodecs-jxl';
export type { DataType, ExtendedImageData, ImageInfo } from '@dimkatet/jcodecs-core';
