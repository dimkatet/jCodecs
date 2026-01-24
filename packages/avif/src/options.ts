import type { ProgressCallback } from '@jcodecs/core';
import type { AVIFMetadata } from './types';

/**
 * Chroma subsampling options
 */
export type ChromaSubsampling = '4:4:4' | '4:2:2' | '4:2:0' | '4:0:0';

/**
 * Color space options
 */
export type ColorSpace = 'srgb' | 'display-p3' | 'rec2020';

/**
 * Encoder tuning modes
 */
export type EncoderTune = 'default' | 'ssim' | 'psnr';

/**
 * AVIF encoding options
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
   * Chroma subsampling.
   * - '4:4:4': No subsampling (best quality, larger size)
   * - '4:2:2': Horizontal subsampling
   * - '4:2:0': Both horizontal and vertical subsampling (most common)
   * - '4:0:0': Grayscale (no chroma)
   * @default '4:2:0'
   */
  chromaSubsampling?: ChromaSubsampling;

  /**
   * Output bit depth.
   * @default 8
   */
  bitDepth?: 8 | 10 | 12;

  /**
   * Output color space.
   * @default 'srgb'
   */
  colorSpace?: ColorSpace;

  /**
   * Enable lossless encoding.
   * When true, quality setting is ignored and chroma subsampling is set to 4:4:4.
   * @default false
   */
  lossless?: boolean;

  /**
   * Number of encoding threads. 0 = auto (use all available cores).
   * Note: Multi-threading requires SharedArrayBuffer support.
   * @default 0
   */
  threads?: number;

  /**
   * Encoder tuning mode.
   * - 'default': Balanced quality/speed
   * - 'ssim': Optimize for SSIM metric
   * - 'psnr': Optimize for PSNR metric
   * @default 'default'
   */
  tune?: EncoderTune;

  /**
   * Image metadata to embed in the output.
   */
  metadata?: Partial<AVIFMetadata>;

  /**
   * Progress callback for tracking encoding progress.
   */
  onProgress?: ProgressCallback;
}

/**
 * AVIF decoding options
 */
export interface AVIFDecodeOptions {
  /**
   * Target bit depth for output.
   * - 0: Auto (use source bit depth)
   * - 8, 10, 12, 16: Convert to specified depth
   * @default 0
   */
  bitDepth?: 0 | 8 | 10 | 12 | 16;

  /**
   * Ignore embedded color profile.
   * @default false
   */
  ignoreColorProfile?: boolean;

  /**
   * Use multi-threading for decoding if available.
   * @default true
   */
  useThreads?: boolean;

  /**
   * Maximum number of threads to use.
   * 0 = auto (use all available cores).
   * @default 0
   */
  maxThreads?: number;
}

/**
 * Default encode options
 */
export const DEFAULT_ENCODE_OPTIONS: Required<
  Omit<AVIFEncodeOptions, 'metadata' | 'onProgress'>
> = {
  quality: 75,
  qualityAlpha: 100,
  speed: 6,
  chromaSubsampling: '4:2:0',
  bitDepth: 8,
  colorSpace: 'srgb',
  lossless: false,
  threads: 0,
  tune: 'default',
};

/**
 * Default decode options
 */
export const DEFAULT_DECODE_OPTIONS: Required<AVIFDecodeOptions> = {
  bitDepth: 0,
  ignoreColorProfile: false,
  useThreads: true,
  maxThreads: 0,
};
