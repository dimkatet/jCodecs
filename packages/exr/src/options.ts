import type { ProgressCallback } from "@dimkatet/jcodecs-core";
import type { EXRCompression, EXRDataType } from "./types";

/**
 * EXR encoding options
 */
export interface EXREncodeOptions {
  /**
   * Compression method.
   * - 'none': No compression
   * - 'rle': Run-length encoding
   * - 'zips': Zip (single scanline)
   * - 'zip': Zip (16 scanlines, best for most use cases)
   * - 'piz': Wavelet-based (best lossless compression for noisy images)
   * - 'pxr24': Lossy 24-bit float (rounds to 24-bit mantissa)
   * - 'dwaa': Lossy DCT-based (32 scanline blocks)
   * - 'dwab': Lossy DCT-based (256 scanline blocks)
   * @default 'zip'
   */
  compression?: EXRCompression;

  /**
   * Output pixel data type. Overrides descriptor.numeric.dataType if set.
   * - 'float16': Half-float (most common for EXR)
   * - 'float32': Full-float (maximum precision)
   * @default uses descriptor.numeric.dataType
   */
  dataType?: EXRDataType;

  /**
   * Number of encoding threads. 0 = auto.
   * @default 0
   */
  maxThreads?: number;

  /**
   * Progress callback for tracking encoding progress.
   */
  onProgress?: ProgressCallback;
}

/**
 * EXR decoding options
 */
export interface EXRDecodeOptions {
  /**
   * Output pixel data type.
   * - 'auto': Preserve original format from file (HALF→float16, FLOAT→float32)
   * - 'float16': Force output as float16
   * - 'float32': Force output as float32
   * @default 'auto'
   */
  dataType?: 'auto' | EXRDataType;

  /**
   * Maximum number of threads to use (only effective with MT decoder).
   * 0 = auto.
   * @default 0
   */
  maxThreads?: number;
}

/**
 * Default encode options
 */
export const DEFAULT_ENCODE_OPTIONS: Required<
  Omit<EXREncodeOptions, "dataType" | "onProgress">
> = {
  compression: "zip",
  maxThreads: 0,
};

/**
 * Default decode options
 */
export const DEFAULT_DECODE_OPTIONS: Required<EXRDecodeOptions> = {
  dataType: "auto",
  maxThreads: 0,
};
