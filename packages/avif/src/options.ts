import type { ProgressCallback } from '@dimkatet/jcodecs-core';

/**
 * Encoder tuning modes
 */
export type EncoderTune = 'default' | 'ssim' | 'psnr';

/**
 * AVIF encoding options — pure encoding parameters only.
 * Image description (dimensions, color, chroma, bit depth) is in AVIFEncodeDescriptor.
 */
export interface AVIFEncodeOptions {
  /**
   * Quality (0-100, where 100 is best quality).
   * @default 75
   */
  quality?: number;

  /**
   * Alpha channel quality (0-100).
   * @default 100
   */
  qualityAlpha?: number;

  /**
   * Encoding speed (0-10, where 10 is fastest).
   * Higher speed = faster encoding but larger file size.
   * @default 6
   */
  speed?: number;

  /**
   * Encoder tuning mode.
   * - 'default': Balanced quality/speed
   * - 'ssim': Optimize for SSIM metric
   * - 'psnr': Optimize for PSNR metric
   * @default 'default'
   */
  tune?: EncoderTune;

  /**
   * Enable lossless encoding.
   * When true, quality setting is ignored and chroma subsampling is forced to 4:4:4.
   * @default false
   */
  lossless?: boolean;

  /**
   * Number of encoding threads. 0 = auto (use all available cores).
   * Note: Multi-threading requires SharedArrayBuffer support.
   * @default 0
   */
  maxThreads?: number;

  /**
   * Progress callback for tracking encoding progress.
   */
  onProgress?: ProgressCallback;
}

/**
 * Default encode options
 */
export const DEFAULT_ENCODE_OPTIONS: Required<Omit<AVIFEncodeOptions, 'onProgress'>> = {
  quality: 75,
  qualityAlpha: 100,
  speed: 6,
  tune: 'default',
  lossless: false,
  maxThreads: 0,
};

/**
 * AVIF decoding options
 */
export interface AVIFDecodeOptions {
  /**
   * Target bit depth for output (real data precision).
   * - 0: Auto (use source bit depth)
   * - 8, 10, 12, 16: Convert to specified depth
   *
   * Note: bitDepth and dataType work together:
   * - dataType determines TypedArray type
   * - bitDepth determines actual data range
   *
   * @default 0
   */
  bitDepth?: 0 | 8 | 10 | 12 | 16;

  /**
   * Ignore embedded color profile.
   * @default false
   */
  ignoreColorProfile?: boolean;

  /**
   * Maximum number of threads to use (only effective with MT decoder).
   * 0 = auto (libavif decides based on image size and available cores).
   * @default 0
   */
  maxThreads?: number;
}

/**
 * Default decode options
 */
export const DEFAULT_DECODE_OPTIONS: Required<AVIFDecodeOptions> = {
  bitDepth: 0,
  ignoreColorProfile: false,
  maxThreads: 0,
};
