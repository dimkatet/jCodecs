/**
 * API Mode Configuration
 *
 * Toggle between Worker API and Direct API here.
 * This affects how encoding/decoding is performed.
 */

export type ApiMode = 'direct' | 'worker';

/**
 * Change this to switch between Direct API and Worker Pool API
 *
 * - 'direct': Uses direct WASM calls (blocks main thread, simpler)
 * - 'worker': Uses Worker Pool API (non-blocking, better for heavy tasks)
 */
export const API_MODE: ApiMode = 'direct';

/**
 * Configuration for Worker Pool (only used when API_MODE = 'worker')
 */
export const WORKER_CONFIG = {
  poolSize: 1,
  preferMT: true,
  lazyInit: false,
} as const;

/**
 * Configuration for Direct API (only used when API_MODE = 'direct')
 */
export const DIRECT_CONFIG = {
  preferMT: true,
} as const;

/**
 * Threading configuration
 */
export const THREAD_CONFIG = {
  maxThreads: 8,
} as const;
