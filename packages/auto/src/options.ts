import type { AVIFEncodeOptions, AVIFDecodeOptions } from '@dimkatet/jcodecs-avif';
import type { JXLEncodeOptions, JXLDecodeOptions } from '@dimkatet/jcodecs-jxl';
import type { ImageFormat } from './format-detection';

// ============================================================================
// Common option types
// ============================================================================

export type ColorSpace = 'srgb' | 'display-p3' | 'rec2020';
export type TransferFunctionOption = 'srgb' | 'pq' | 'hlg' | 'linear';

// ============================================================================
// Unified Decode Options
// ============================================================================

export interface AutoDecodeOptions {
  /**
   * Override format detection (use specific codec).
   * If not specified, format will be auto-detected from magic bytes.
   */
  format?: ImageFormat;

  /**
   * Target bit depth for output (real data precision).
   * - 0: Auto (use source bit depth)
   * - 8, 10, 12, 16: Convert to specified depth
   * @default 0
   */
  bitDepth?: 0 | 8 | 10 | 12 | 16;

  /**
   * Maximum number of threads for decoding.
   * 0 = auto (codec decides based on image size and available cores).
   * @default 0
   */
  maxThreads?: number;

  /**
   * Ignore embedded color profile.
   * @default false
   */
  ignoreColorProfile?: boolean;

  /**
   * AVIF-specific options (takes precedence over common options).
   */
  avif?: AVIFDecodeOptions;

  /**
   * JXL-specific options (takes precedence over common options).
   */
  jxl?: JXLDecodeOptions;
}

// ============================================================================
// Unified Encode Options
// ============================================================================

export interface AutoEncodeOptions {
  /**
   * Target format (required for encoding).
   */
  format: Exclude<ImageFormat, 'unknown'>;

  /**
   * Quality (0-100, where 100 is best quality).
   * @default 75
   */
  quality?: number;

  /**
   * Output bit depth (goes into the descriptor).
   * @default 8
   */
  bitDepth?: 8 | 10 | 12 | 16;

  /**
   * Maximum number of threads for encoding.
   * 0 = auto (codec decides based on available cores).
   * @default 0
   */
  maxThreads?: number;

  /**
   * Enable lossless encoding.
   * When true, quality setting is ignored.
   * @default false
   */
  lossless?: boolean;

  /**
   * Output color space (maps to descriptor color primaries).
   * @default 'srgb'
   */
  colorSpace?: ColorSpace;

  /**
   * Transfer function for HDR content (maps to descriptor transfer function).
   * @default 'srgb'
   */
  transferFunction?: TransferFunctionOption;

  /**
   * AVIF-specific options (takes precedence over common options).
   */
  avif?: AVIFEncodeOptions;

  /**
   * JXL-specific options (takes precedence over common options).
   */
  jxl?: JXLEncodeOptions;
}

// ============================================================================
// Option mapping utilities
// ============================================================================

/**
 * Map unified decode options to AVIF-specific options
 */
export function mapToAVIFDecodeOptions(opts: AutoDecodeOptions): AVIFDecodeOptions {
  return {
    bitDepth: opts.bitDepth,
    maxThreads: opts.maxThreads,
    ignoreColorProfile: opts.ignoreColorProfile,
    ...opts.avif,
  };
}

/**
 * Map unified decode options to JXL-specific options
 */
export function mapToJXLDecodeOptions(opts: AutoDecodeOptions): JXLDecodeOptions {
  return {
    bitDepth: opts.bitDepth,
    maxThreads: opts.maxThreads,
    ignoreColorProfile: opts.ignoreColorProfile,
    ...opts.jxl,
  };
}

/**
 * Map unified encode options to AVIF-specific encode options (quality/speed params only,
 * not descriptor fields like colorSpace/transferFunction/bitDepth).
 */
export function mapToAVIFEncodeOptions(opts: AutoEncodeOptions): AVIFEncodeOptions {
  return {
    quality: opts.quality,
    maxThreads: opts.maxThreads,
    lossless: opts.lossless,
    ...opts.avif,
  };
}

/**
 * Map unified encode options to JXL-specific encode options (quality/effort params only,
 * not descriptor fields like colorSpace/transferFunction/bitDepth).
 */
export function mapToJXLEncodeOptions(opts: AutoEncodeOptions): JXLEncodeOptions {
  return {
    quality: opts.quality,
    maxThreads: opts.maxThreads,
    lossless: opts.lossless,
    ...opts.jxl,
  };
}

// ============================================================================
// Default options
// ============================================================================

export const DEFAULT_DECODE_OPTIONS: AutoDecodeOptions = {
  bitDepth: 0,
  maxThreads: 0,
  ignoreColorProfile: false,
};

export const DEFAULT_ENCODE_OPTIONS: Omit<AutoEncodeOptions, 'format'> = {
  quality: 75,
  bitDepth: 8,
  maxThreads: 0,
  lossless: false,
  colorSpace: 'srgb',
  transferFunction: 'srgb',
};

// ============================================================================
// Re-export codec options for convenience
// ============================================================================

export type { AVIFEncodeOptions, AVIFDecodeOptions } from '@dimkatet/jcodecs-avif';
export type { JXLEncodeOptions, JXLDecodeOptions } from '@dimkatet/jcodecs-jxl';
