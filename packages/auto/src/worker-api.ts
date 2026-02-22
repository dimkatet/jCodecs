/**
 * Worker Pool API for multi-codec operations (Facade pattern)
 *
 * This module doesn't have its own worker - it delegates to codec-specific
 * worker pools from @jcodecs/avif and @jcodecs/jxl packages.
 */
import { isMultiThreadSupported } from '@dimkatet/jcodecs-core';
import { detectFormat, type ImageFormat } from './format-detection';
import type { AutoImageData } from './types';
import type { AutoDecodeOptions, AutoEncodeOptions, AVIFEncodeOptions, JXLEncodeOptions, EXREncodeOptions } from './options';
import { UnsupportedFormatError, CodecNotInstalledError } from './errors';

// ============================================================================
// Descriptor building helpers (for encode in worker)
// ============================================================================

function buildDescriptorFromImageData(
  imgData: ImageData,
): Record<string, unknown> {
  return {
    geometry: { width: imgData.width, height: imgData.height },
    channels: { model: 'rgba', count: 4 },
    numeric: { dataType: 'uint8', bitDepth: 8 },
    color: { primaries: 'bt709' },
    transfer: { function: 'srgb' },
  };
}

// ============================================================================
// Types
// ============================================================================

/**
 * Common worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Number of workers in the pool (default: navigator.hardwareConcurrency / 2) */
  poolSize?: number;
  /** Use multi-threaded WASM modules (default: false) */
  preferMT?: boolean;
  /** Initialize decoder, encoder, or both (default: both) */
  type?: 'decoder' | 'encoder' | 'both';
  /** Delay pool initialization until first use (default: true) */
  lazy?: boolean;
}

/**
 * Auto worker pool configuration with per-codec overrides
 */
export interface AutoWorkerPoolConfig extends WorkerPoolConfig {
  /** Limit to specific formats (default: all installed) */
  formats?: ImageFormat[];
  /** AVIF-specific configuration overrides */
  avif?: WorkerPoolConfig;
  /** JXL-specific configuration overrides */
  jxl?: WorkerPoolConfig;
  /** EXR-specific configuration overrides */
  exr?: WorkerPoolConfig;
}

// Codec worker client types (imported dynamically)
type AVIFWorkerClient = Awaited<
  ReturnType<typeof import('@dimkatet/jcodecs-avif/worker-api').createWorkerPool>
>;
type JXLWorkerClient = Awaited<
  ReturnType<typeof import('@dimkatet/jcodecs-jxl/worker-api').createWorkerPool>
>;
type EXRWorkerClient = Awaited<
  ReturnType<typeof import('@dimkatet/jcodecs-exr/worker-api').createWorkerPool>
>;

/**
 * Auto worker client - facade over codec-specific worker pools
 */
export interface AutoWorkerClient {
  /** AVIF worker pool (undefined if not installed or not initialized yet) */
  readonly avif?: AVIFWorkerClient;
  /** JXL worker pool (undefined if not installed or not initialized yet) */
  readonly jxl?: JXLWorkerClient;
  /** EXR worker pool (undefined if not installed or not initialized yet) */
  readonly exr?: EXRWorkerClient;
  /** List of available codecs (installed packages) */
  readonly availableCodecs: readonly ImageFormat[];
}

// ============================================================================
// Internal state
// ============================================================================

interface InternalState {
  config: AutoWorkerPoolConfig;
  availableCodecs: Set<ImageFormat>;
  pools: {
    avif?: AVIFWorkerClient;
    jxl?: JXLWorkerClient;
    exr?: EXRWorkerClient;
  };
  initPromises: Map<ImageFormat, Promise<void>>;
  // Cached module references
  modules: {
    avif?: typeof import('@dimkatet/jcodecs-avif/worker-api');
    jxl?: typeof import('@dimkatet/jcodecs-jxl/worker-api');
    exr?: typeof import('@dimkatet/jcodecs-exr/worker-api');
  };
}

const clientStates = new WeakMap<AutoWorkerClient, InternalState>();

// ============================================================================
// Codec detection
// ============================================================================

async function detectAvailableCodecs(
  formats?: ImageFormat[],
): Promise<{
  available: Set<ImageFormat>;
  modules: InternalState['modules'];
}> {
  const available = new Set<ImageFormat>();
  const modules: InternalState['modules'] = {};

  // Check AVIF
  if (!formats || formats.includes('avif')) {
    try {
      modules.avif = await import('@dimkatet/jcodecs-avif/worker-api');
      available.add('avif');
    } catch {
      // Not installed
    }
  }

  // Check JXL
  if (!formats || formats.includes('jxl')) {
    try {
      modules.jxl = await import('@dimkatet/jcodecs-jxl/worker-api');
      available.add('jxl');
    } catch {
      // Not installed
    }
  }

  // Check EXR
  if (!formats || formats.includes('exr')) {
    try {
      modules.exr = await import('@dimkatet/jcodecs-exr/worker-api');
      available.add('exr');
    } catch {
      // Not installed
    }
  }

  return { available, modules };
}

// ============================================================================
// Pool initialization
// ============================================================================

function mergeConfig(
  base: WorkerPoolConfig,
  override?: WorkerPoolConfig,
): WorkerPoolConfig {
  if (!override) return base;
  return { ...base, ...override };
}

async function initPool(
  state: InternalState,
  format: ImageFormat,
): Promise<void> {
  // Already initialized
  if (format === 'avif' && state.pools.avif) return;
  if (format === 'jxl' && state.pools.jxl) return;
  if (format === 'exr' && state.pools.exr) return;

  // Check if initialization is in progress
  const existing = state.initPromises.get(format);
  if (existing) return existing;

  const baseConfig: WorkerPoolConfig = {
    poolSize: state.config.poolSize,
    preferMT: state.config.preferMT ?? (isMultiThreadSupported() ? false : false),
    type: state.config.type ?? 'both',
    // Don't pass lazy to codec pools - they init immediately
  };

  const promise = (async () => {
    if (format === 'avif' && state.modules.avif) {
      const config = mergeConfig(baseConfig, state.config.avif);
      state.pools.avif = await state.modules.avif.createWorkerPool(config);
    } else if (format === 'jxl' && state.modules.jxl) {
      const config = mergeConfig(baseConfig, state.config.jxl);
      state.pools.jxl = await state.modules.jxl.createWorkerPool(config);
    } else if (format === 'exr' && state.modules.exr) {
      const config = mergeConfig(baseConfig, state.config.exr);
      state.pools.exr = await state.modules.exr.createWorkerPool(config);
    }
    state.initPromises.delete(format);
  })();

  state.initPromises.set(format, promise);
  return promise;
}

async function ensurePoolInitialized(
  state: InternalState,
  format: ImageFormat,
): Promise<void> {
  if (!state.availableCodecs.has(format)) {
    throw new CodecNotInstalledError(format);
  }
  await initPool(state, format);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a worker pool for multi-codec operations.
 *
 * This creates a facade that manages codec-specific worker pools.
 * Each codec runs in its own optimized worker.
 *
 * @example
 * ```typescript
 * // Basic usage - pools created on first use
 * const client = await createWorkerPool();
 * const imageData = await decodeInWorker(client, jxlBuffer);
 *
 * // Eager initialization
 * const client = await createWorkerPool({ lazy: false });
 *
 * // Per-codec configuration
 * const client = await createWorkerPool({
 *   poolSize: 2,
 *   preferMT: true,
 *   avif: { poolSize: 4 },  // AVIF gets more workers
 *   jxl: { type: 'decoder' }, // JXL only decodes
 * });
 * ```
 */
export async function createWorkerPool(
  config: AutoWorkerPoolConfig = {},
): Promise<AutoWorkerClient> {
  const { available, modules } = await detectAvailableCodecs(config.formats);

  if (available.size === 0) {
    throw new Error(
      'No codec packages installed. Install @dimkatet/jcodecs-avif and/or @dimkatet/jcodecs-jxl.',
    );
  }

  const state: InternalState = {
    config,
    availableCodecs: available,
    pools: {},
    initPromises: new Map(),
    modules,
  };

  // Create the public client object
  const client: AutoWorkerClient = {
    get avif() {
      return state.pools.avif;
    },
    get jxl() {
      return state.pools.jxl;
    },
    get exr() {
      return state.pools.exr;
    },
    get availableCodecs() {
      return [...state.availableCodecs] as const;
    },
  };

  clientStates.set(client, state);

  // Initialize pools eagerly if lazy: false
  const lazy = config.lazy ?? true;
  if (!lazy) {
    const initPromises: Promise<void>[] = [];
    for (const format of available) {
      initPromises.push(initPool(state, format));
    }
    await Promise.all(initPromises);
  }

  return client;
}

/**
 * Decode image in worker with auto-detection.
 *
 * Automatically detects image format from magic bytes and routes
 * to the appropriate codec worker pool.
 */
export async function decodeInWorker(
  client: AutoWorkerClient,
  input: Uint8Array | ArrayBuffer,
  options?: AutoDecodeOptions,
): Promise<AutoImageData> {
  const state = clientStates.get(client);
  if (!state) {
    throw new Error('Invalid AutoWorkerClient');
  }

  const data =
    input instanceof ArrayBuffer ? new Uint8Array(input) : input;

  const format = detectFormat(data);
  if (format === 'unknown') {
    throw new UnsupportedFormatError(data);
  }

  await ensurePoolInitialized(state, format);

  if (format === 'avif' && state.pools.avif && state.modules.avif) {
    const result = await state.modules.avif.decodeInWorker(
      state.pools.avif,
      data,
      options,
    );
    return { data: result.data, descriptor: result.descriptor, format: 'avif' };
  }

  if (format === 'jxl' && state.pools.jxl && state.modules.jxl) {
    const result = await state.modules.jxl.decodeInWorker(
      state.pools.jxl,
      data,
      options,
    );
    return { data: result.data, descriptor: result.descriptor, format: 'jxl' };
  }

  if (format === 'exr' && state.pools.exr && state.modules.exr) {
    const result = await state.modules.exr.decodeInWorker(
      state.pools.exr,
      data,
      options,
    );
    return { data: result.data, descriptor: result.descriptor, format: 'exr' };
  }

  throw new CodecNotInstalledError(format);
}

/**
 * Encode image in worker.
 *
 * Requires explicit format specification in options.
 */
export async function encodeInWorker(
  client: AutoWorkerClient,
  input: AutoImageData | ImageData,
  options: AutoEncodeOptions,
): Promise<Uint8Array> {
  const state = clientStates.get(client);
  if (!state) {
    throw new Error('Invalid AutoWorkerClient');
  }

  const { format } = options;
  await ensurePoolInitialized(state, format);

  // Split input into raw data + descriptor
  let pixelData: Uint8Array | Uint16Array | Float16Array | Float32Array;
  let descriptor: unknown;

  if ('descriptor' in input) {
    // AutoImageData — pass data and descriptor through as-is
    pixelData = input.data;
    descriptor = input.descriptor as unknown as Record<string, unknown>;
  } else {
    // Standard ImageData (8-bit sRGB RGBA)
    pixelData = new Uint8Array(input.data.buffer, input.data.byteOffset, input.data.byteLength);
    descriptor = buildDescriptorFromImageData(input);
  }

  const avifOpts: AVIFEncodeOptions = { quality: options.quality, maxThreads: options.maxThreads, lossless: options.lossless, ...options.avif };
  const jxlOpts: JXLEncodeOptions = { quality: options.quality, maxThreads: options.maxThreads, lossless: options.lossless, ...options.jxl };
  const exrOpts: EXREncodeOptions = { maxThreads: options.maxThreads, ...options.exr };

  if (format === 'avif' && state.pools.avif && state.modules.avif) {
    type AvifData = Parameters<typeof state.modules.avif.encodeInWorker>[1];
    type AvifDesc = Parameters<typeof state.modules.avif.encodeInWorker>[2];
    return state.modules.avif.encodeInWorker(
      state.pools.avif,
      pixelData as AvifData,
      descriptor as AvifDesc,
      avifOpts,
    );
  }

  if (format === 'jxl' && state.pools.jxl && state.modules.jxl) {
    type JxlData = Parameters<typeof state.modules.jxl.encodeInWorker>[1];
    type JxlDesc = Parameters<typeof state.modules.jxl.encodeInWorker>[2];
    return state.modules.jxl.encodeInWorker(
      state.pools.jxl,
      pixelData as JxlData,
      descriptor as JxlDesc,
      jxlOpts,
    );
  }

  if (format === 'exr' && state.pools.exr && state.modules.exr) {
    type ExrData = Parameters<typeof state.modules.exr.encodeInWorker>[1];
    type ExrDesc = Parameters<typeof state.modules.exr.encodeInWorker>[2];
    return state.modules.exr.encodeInWorker(
      state.pools.exr,
      pixelData as ExrData,
      descriptor as ExrDesc,
      exrOpts,
    );
  }

  throw new CodecNotInstalledError(format);
}

/**
 * Transcode image in worker (decode + encode).
 *
 * Decodes input with auto-detection, then encodes to target format.
 */
export async function transcodeInWorker(
  client: AutoWorkerClient,
  input: Uint8Array | ArrayBuffer,
  targetFormat: 'avif' | 'jxl',
  options?: Omit<AutoEncodeOptions, 'format'>,
): Promise<Uint8Array> {
  // Decode with auto-detection
  const imageData = await decodeInWorker(client, input);

  // Encode to target format
  return encodeInWorker(client, imageData, {
    ...options,
    format: targetFormat,
  });
}

/**
 * Get combined statistics from all worker pools.
 */
export function getWorkerPoolStats(client: AutoWorkerClient): {
  avif: ReturnType<AVIFWorkerClient['getStats']> | null;
  jxl: ReturnType<JXLWorkerClient['getStats']> | null;
  exr: ReturnType<EXRWorkerClient['getStats']> | null;
  total: {
    poolSize: number;
    availableWorkers: number;
    queuedTasks: number;
  };
} {
  const state = clientStates.get(client);

  const avifStats = state?.pools.avif?.getStats() ?? null;
  const jxlStats = state?.pools.jxl?.getStats() ?? null;
  const exrStats = state?.pools.exr?.getStats() ?? null;

  return {
    avif: avifStats,
    jxl: jxlStats,
    exr: exrStats,
    total: {
      poolSize: (avifStats?.poolSize ?? 0) + (jxlStats?.poolSize ?? 0) + (exrStats?.poolSize ?? 0),
      availableWorkers:
        (avifStats?.availableWorkers ?? 0) + (jxlStats?.availableWorkers ?? 0) + (exrStats?.availableWorkers ?? 0),
      queuedTasks:
        (avifStats?.queuedTasks ?? 0) + (jxlStats?.queuedTasks ?? 0) + (exrStats?.queuedTasks ?? 0),
    },
  };
}

/**
 * Terminate all worker pools.
 */
export function terminateWorkerPool(client: AutoWorkerClient): void {
  const state = clientStates.get(client);
  if (!state) return;

  state.pools.avif?.terminate();
  state.pools.jxl?.terminate();
  state.pools.exr?.terminate();
  state.pools = {};
  state.initPromises.clear();
  clientStates.delete(client);
}

/**
 * Check if any worker pool is initialized.
 */
export function isWorkerPoolInitialized(client: AutoWorkerClient): boolean {
  const state = clientStates.get(client);
  if (!state) return false;

  return (
    (state.pools.avif?.isInitialized() ?? false) ||
    (state.pools.jxl?.isInitialized() ?? false) ||
    (state.pools.exr?.isInitialized() ?? false)
  );
}

/**
 * Check if a specific codec pool is initialized.
 */
export function isCodecPoolInitialized(
  client: AutoWorkerClient,
  format: ImageFormat,
): boolean {
  const state = clientStates.get(client);
  if (!state) return false;

  if (format === 'avif') return state.pools.avif?.isInitialized() ?? false;
  if (format === 'jxl') return state.pools.jxl?.isInitialized() ?? false;
  if (format === 'exr') return state.pools.exr?.isInitialized() ?? false;
  return false;
}
