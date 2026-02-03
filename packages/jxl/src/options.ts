import type { ProgressCallback } from "@dimkatet/jcodecs-core";
import type { JXLMetadata } from "./types";

/**
 * Color space options
 */
export type ColorSpace = "srgb" | "display-p3" | "rec2020";

/**
 * Transfer function (OETF) options
 */
export type TransferFunctionOption = "srgb" | "pq" | "hlg" | "linear";

/**
 * JXL encoding options
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
   * Output bit depth.
   * @default 8
   */
  bitDepth?: 8 | 10 | 12 | 16;

  /**
   * Output color space.
   * @default 'srgb'
   */
  colorSpace?: ColorSpace;

  /**
   * Transfer function (OETF) for HDR content.
   * - 'srgb': Standard sRGB gamma (~2.2)
   * - 'pq': Perceptual Quantizer (HDR10, Dolby Vision)
   * - 'hlg': Hybrid Log-Gamma (broadcast HDR)
   * - 'linear': Linear light (for compositing)
   * @default 'srgb'
   */
  transferFunction?: TransferFunctionOption;

  /**
   * Enable progressive decoding support.
   * When true, the encoded image can be progressively decoded
   * showing increasingly detailed previews.
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
   * Image metadata to embed in the output.
   */
  metadata?: Partial<JXLMetadata>;

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
export const DEFAULT_ENCODE_OPTIONS: Required<
  Omit<JXLEncodeOptions, "metadata" | "onProgress">
> = {
  quality: 75,
  effort: 7,
  lossless: false,
  bitDepth: 8,
  colorSpace: "srgb",
  transferFunction: "srgb",
  progressive: false,
  maxThreads: 0,
};

/**
 * Default decode options
 */
export const DEFAULT_DECODE_OPTIONS: Required<JXLDecodeOptions> = {
  ignoreColorProfile: false,
  maxThreads: 0,
};
