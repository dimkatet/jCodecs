import type { ResizeAlgorithm } from './types';

export interface ResizeOptions {
  /**
   * Resampling algorithm.
   * - 'bilinear': fast, adequate quality (default)
   * - 'mitchell': Mitchell-Netravali cubic — high quality, minor ringing
   * - 'lanczos3': Lanczos 3-lobe — sharpest, most ringing
   * @default 'bilinear'
   */
  algorithm?: ResizeAlgorithm;
}

export const DEFAULT_RESIZE_OPTIONS: Required<ResizeOptions> = {
  algorithm: 'bilinear',
};

export interface WorkerPoolConfig {
  /** Number of workers in the pool */
  poolSize?: number;
  /** Custom URL for the worker script */
  workerUrl?: string | URL;
  /** Custom URL for the img_process WASM JS file */
  processUrl?: string;
}
