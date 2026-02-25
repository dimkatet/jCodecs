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

  /** Decode image with auto-detection */
  decode(input: Uint8Array | ArrayBuffer, options?: AutoDecodeOptions): Promise<AutoImageData>;
  /** Encode image to specified format */
  encode(input: AutoImageData | ImageData, options: AutoEncodeOptions): Promise<Uint8Array>;
  /** Decode then encode to target format */
  transcode(
    input: Uint8Array | ArrayBuffer,
    targetFormat: 'avif' | 'jxl' | 'exr',
    options?: Omit<AutoEncodeOptions, 'format'>,
  ): Promise<Uint8Array>;
  /** Get combined stats from all pools */
  getStats(): {
    avif: ReturnType<NonNullable<AutoWorkerClient['avif']>['getStats']> | null;
    jxl: ReturnType<NonNullable<AutoWorkerClient['jxl']>['getStats']> | null;
    exr: ReturnType<NonNullable<AutoWorkerClient['exr']>['getStats']> | null;
    total: { poolSize: number; availableWorkers: number; queuedTasks: number };
  };
  /** Terminate all worker pools */
  terminate(): void;
  /** Check if any pool is initialized */
  isInitialized(): boolean;
  /** Check if a specific codec pool is initialized */
  isCodecInitialized(format: ImageFormat): boolean;
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

    async decode(input, options) {
      const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
      const format = detectFormat(data);
      if (format === 'unknown') throw new UnsupportedFormatError(data);
      await ensurePoolInitialized(state, format);

      const pool = state.pools[format];
      if (!pool) throw new CodecNotInstalledError(format);

      const result = await pool.decode(data, options as any);
      return { data: result.data, descriptor: result.descriptor, format };
    },

    async encode(input, options) {
      const { format } = options;
      await ensurePoolInitialized(state, format);

      let pixelData: Uint8Array | Uint16Array | Float16Array | Float32Array;
      let descriptor: unknown;

      if ('descriptor' in input) {
        pixelData = input.data;
        descriptor = input.descriptor as unknown;
      } else {
        pixelData = new Uint8Array(input.data.buffer, input.data.byteOffset, input.data.byteLength);
        descriptor = buildDescriptorFromImageData(input);
      }

      const opts = {
        avif: { quality: options.quality, maxThreads: options.maxThreads, lossless: options.lossless, ...options.avif } as AVIFEncodeOptions,
        jxl:  { quality: options.quality, maxThreads: options.maxThreads, lossless: options.lossless, ...options.jxl } as JXLEncodeOptions,
        exr:  { maxThreads: options.maxThreads, ...options.exr } as EXREncodeOptions,
      };

      const pool = state.pools[format];
      if (!pool) throw new CodecNotInstalledError(format);

      return pool.encode(pixelData as any, descriptor as any, opts[format] as any);
    },

    async transcode(input, targetFormat, options) {
      const decoded = await client.decode(input);
      return client.encode(decoded, { ...options, format: targetFormat });
    },

    getStats() {
      const avif = state.pools.avif?.getStats() ?? null;
      const jxl  = state.pools.jxl?.getStats()  ?? null;
      const exr  = state.pools.exr?.getStats()   ?? null;
      const all  = [avif, jxl, exr];
      const sum  = (key: 'poolSize' | 'availableWorkers' | 'queuedTasks') =>
        all.reduce((s, p) => s + (p?.[key] ?? 0), 0);
      return {
        avif, jxl, exr,
        total: { poolSize: sum('poolSize'), availableWorkers: sum('availableWorkers'), queuedTasks: sum('queuedTasks') },
      };
    },

    terminate() {
      for (const pool of Object.values(state.pools)) pool.terminate();
      state.pools = {};
      state.initPromises.clear();
    },

    isInitialized() {
      return Object.values(state.pools).some(p => p.isInitialized());
    },

    isCodecInitialized(format) {
      if (format === 'unknown') return false;
      return state.pools[format]?.isInitialized() ?? false;
    },
  };

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
