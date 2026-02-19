import type { ProgressCallback } from '@dimkatet/jcodecs-core';

/**
 * JXL encoding options — pure encoding parameters.
 * Image description (dimensions, color, bit depth, data type) is in JXLEncodeDescriptor.
 */
export interface JXLEncodeOptions {
  /**
   * Quality (0-100, where 100 is best quality).
   * Maps to JXL "distance" internally (0=lossless, 15=max compression).
   * @default 75
   */
  quality?: number;

  /**
   * Encoding effort (1-10, where 10 is slowest but best compression).
   * Higher effort = slower encoding but smaller file size.
   * @default 7
   */
  effort?: number;

  /**
   * Enable lossless encoding.
   * When true, quality setting is ignored.
   * @default false
   */
  lossless?: boolean;

  /**
   * Enable progressive decoding support.
   * @default false
   */
  progressive?: boolean;

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
 * JXL decoding options
 */
export interface JXLDecodeOptions {
  /**
   * Target bit depth for output.
   * - 0: Auto (use source bit depth / data type from file)
   * - 8: Force uint8 output (even for HDR/float files)
   * - 10, 12, 16: Force uint16 output at specified depth
   *
   * Note: For float format files (float16/float32), setting bitDepth > 0
   * forces integer output. Leave at 0 to preserve the native float format.
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
   * 0 = auto (libjxl decides based on image size and available cores).
   * @default 0
   */
  maxThreads?: number;
}

/**
 * Default encode options
 */
export const DEFAULT_ENCODE_OPTIONS: Required<Omit<JXLEncodeOptions, 'onProgress'>> = {
  quality: 75,
  effort: 7,
  lossless: false,
  progressive: false,
  maxThreads: 0,
};

/**
 * Default decode options
 */
export const DEFAULT_DECODE_OPTIONS: Required<JXLDecodeOptions> = {
  bitDepth: 0,
  ignoreColorProfile: false,
  maxThreads: 0,
};
