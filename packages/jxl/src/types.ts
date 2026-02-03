import type { ExtendedImageData, ImageInfo } from '@dimkatet/jcodecs-core';

// ============================================================================
// Color space types (JXL uses simplified set compared to full CICP)
// ============================================================================

export type ColorPrimaries =
  | 'bt709'
  | 'bt2020'
  | 'display-p3'
  | 'unknown';

export type TransferFunction =
  | 'srgb'
  | 'linear'
  | 'pq'
  | 'hlg'
  | 'bt709'
  | 'dci'
  | 'gamma'
  | 'unknown';

// JXL decodes directly to RGB, matrix coefficients always "identity"
export type MatrixCoefficients = 'identity';

// ============================================================================
// Mastering display metadata (SMPTE ST 2086)
// ============================================================================

export interface MasteringDisplay {
  primaries: {
    red: [x: number, y: number];
    green: [x: number, y: number];
    blue: [x: number, y: number];
  };
  whitePoint: [x: number, y: number];
  luminance: {
    min: number;
    max: number;
  };
}

// ============================================================================
// JXL-specific metadata
// ============================================================================

export interface JXLMetadata {
  /** Color primaries (gamut) */
  colorPrimaries: ColorPrimaries;
  /** Transfer function (gamma/OETF) */
  transferFunction: TransferFunction;
  /** Matrix coefficients (always "identity" for JXL RGB output) */
  matrixCoefficients: MatrixCoefficients;
  /** Full range (JXL always outputs full range RGB) */
  fullRange: boolean;

  /** Maximum Content Light Level in nits (0 if not present) */
  maxCLL: number;
  /** Maximum Picture Average Light Level in nits (0 if not present) */
  maxPALL: number;

  /** Mastering display metadata (undefined if not present) */
  masteringDisplay?: MasteringDisplay;

  /** Raw ICC profile bytes (undefined if not present) */
  iccProfile?: Uint8Array;

  /** Convenience flag: true if PQ/HLG transfer or depth > 8 */
  isHDR: boolean;

  /** JXL-specific: whether image is animated */
  isAnimated: boolean;

  /** JXL-specific: frame count (1 for still images) */
  frameCount: number;
}

// ============================================================================
// AVIF-specific data types
// ============================================================================

/**
 * AVIF supported pixel data types.
 * Note: AVIF (libavif) only supports integer formats, no float.
 */
export type JXLDataType = 'uint8' | 'uint16' | 'float16' |  'float32';

/**
 * Supported types for runtime validation
 */
export const SUPPORTED_DATA_TYPES: readonly JXLDataType[] = [
  'uint8',
  'uint16',
  'float16',
  'float32',
] as const;

// ============================================================================
// JXL-typed exports
// ============================================================================

/** JXL image data with JXL-specific metadata */
export type JXLImageData = ExtendedImageData<JXLDataType, JXLMetadata>;

/** JXL image info (without pixel data) */
export type JXLImageInfo = ImageInfo<JXLMetadata>;

// ============================================================================
// Default metadata
// ============================================================================

export const DEFAULT_SRGB_METADATA: JXLMetadata = {
  colorPrimaries: 'bt709',
  transferFunction: 'srgb',
  matrixCoefficients: 'identity',
  fullRange: true,
  maxCLL: 0,
  maxPALL: 0,
  masteringDisplay: undefined,
  iccProfile: undefined,
  isHDR: false,
  isAnimated: false,
  frameCount: 1,
};
