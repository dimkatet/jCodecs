import type { ImageDescriptor, ColorPrimaries, ChannelModel } from '@dimkatet/jcodecs-core';

// ============================================================================
// EXR-specific data types
// ============================================================================

/**
 * EXR supported pixel data types.
 * EXR natively stores HALF (float16) and FLOAT (float32).
 */
export type EXRDataType = 'float16' | 'float32';

/**
 * Supported types for runtime validation
 */
export const SUPPORTED_DATA_TYPES: readonly EXRDataType[] = [
  'float16',
  'float32',
] as const;

/**
 * EXR compression methods
 */
export type EXRCompression =
  | 'none'
  | 'rle'
  | 'zips'
  | 'zip'
  | 'piz'
  | 'pxr24'
  | 'dwaa'
  | 'dwab';

// ============================================================================
// EXR format-specific data (goes into descriptor.formatSpecific)
// ============================================================================

/**
 * CIE xy chromaticity coordinates for all primaries and white point.
 * Stored as-is from EXR chromaticities header attribute.
 */
export interface EXRChromaticities {
  red: [x: number, y: number];
  green: [x: number, y: number];
  blue: [x: number, y: number];
  white: [x: number, y: number];
}

/**
 * EXR-specific metadata not covered by ImageDescriptor.
 * Stored in descriptor.formatSpecific.
 */
export interface EXRFormatSpecific {
  /** Compression method used in the file */
  compression: EXRCompression;

  /** Active pixel area (may differ from display window for cropped images) */
  dataWindow: { xMin: number; yMin: number; xMax: number; yMax: number };

  /** Full image area */
  displayWindow: { xMin: number; yMin: number; xMax: number; yMax: number };

  /**
   * Raw CIE chromaticity coordinates from EXR header.
   * Undefined if no chromaticities attribute present in file.
   */
  chromaticities?: EXRChromaticities;
}

// ============================================================================
// Decoder output (descriptor-based API)
// ============================================================================

/** EXR decoded image data with ImageDescriptor */
export interface EXRImageData {
  data: Float16Array | Float32Array;
  descriptor: ImageDescriptor;
}

// ============================================================================
// Encoder input (descriptor-based API)
// ============================================================================

/**
 * Descriptor for EXR encoding input.
 * Structurally mirrors ImageDescriptor but narrowed to fields
 * relevant for the EXR encoder.
 */
export interface EXREncodeDescriptor {
  /** Image dimensions */
  geometry: {
    width: number;
    height: number;
  };

  /** Channel configuration */
  channels: {
    model: Extract<ChannelModel, 'rgb' | 'rgba'>;
    count: 3 | 4;
  };

  /** Pixel data format */
  numeric: {
    dataType: EXRDataType;
  };

  /**
   * Color primaries for EXR chromaticities attribute.
   * Determines what chromaticity data is embedded in the file.
   * undefined → defaults to bt709 (sRGB primaries)
   */
  color?: {
    primaries?: Extract<ColorPrimaries, 'bt709' | 'displayP3' | 'bt2020'>;
  };
}
