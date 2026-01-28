import type { ExtendedImageData, ImageInfo } from '@dimkatet/jcodecs-core';

// ============================================================================
// CICP types (Coding-Independent Code Points)
// ============================================================================

export type ColorPrimaries =
  | 'bt709'
  | 'bt470m'
  | 'bt470bg'
  | 'bt601'
  | 'smpte240'
  | 'generic-film'
  | 'bt2020'
  | 'xyz'
  | 'dci-p3'
  | 'display-p3'
  | 'ebu3213'
  | 'unknown';

export type TransferFunction =
  | 'bt709'
  | 'bt470m'
  | 'bt470bg'
  | 'bt601'
  | 'smpte240'
  | 'linear'
  | 'log100'
  | 'log100-sqrt10'
  | 'iec61966'
  | 'bt1361'
  | 'srgb'
  | 'bt2020-10bit'
  | 'bt2020-12bit'
  | 'pq'
  | 'smpte428'
  | 'hlg'
  | 'unknown';

export type MatrixCoefficients =
  | 'identity'
  | 'bt709'
  | 'fcc'
  | 'bt470bg'
  | 'bt601'
  | 'smpte240'
  | 'ycgco'
  | 'bt2020-ncl'
  | 'bt2020-cl'
  | 'smpte2085'
  | 'chroma-derived-ncl'
  | 'chroma-derived-cl'
  | 'ictcp'
  | 'unknown';

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
// AVIF-specific metadata
// ============================================================================

export interface AVIFMetadata {
  /** Color primaries (gamut) */
  colorPrimaries: ColorPrimaries;
  /** Transfer function (gamma/OETF) */
  transferFunction: TransferFunction;
  /** YUV matrix coefficients */
  matrixCoefficients: MatrixCoefficients;
  /** Full range (0-255) vs limited range (16-235) */
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
}

// ============================================================================
// AVIF-typed exports
// ============================================================================

/** AVIF image data with AVIF-specific metadata */
export type AVIFImageData = ExtendedImageData<AVIFMetadata>;

/** AVIF image info (without pixel data) */
export type AVIFImageInfo = ImageInfo<AVIFMetadata>;

// ============================================================================
// Default metadata
// ============================================================================

export const DEFAULT_SRGB_METADATA: AVIFMetadata = {
  colorPrimaries: 'bt709',
  transferFunction: 'srgb',
  matrixCoefficients: 'bt709',
  fullRange: true,
  maxCLL: 0,
  maxPALL: 0,
  masteringDisplay: undefined,
  iccProfile: undefined,
  isHDR: false,
};
