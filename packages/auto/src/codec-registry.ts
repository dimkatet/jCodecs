/**
 * Dynamic codec loading and registration
 */

import type { ImageFormat } from './format-detection';
import { CodecNotInstalledError, CodecLoadError } from './errors';

// ============================================================================
// Codec adapter interface
// ============================================================================

/**
 * Unified interface for codec packages
 */
export interface CodecAdapter {
  decode(
    input: Uint8Array | ArrayBuffer,
    options?: unknown,
  ): Promise<unknown>;

  decodeToImageData(
    input: Uint8Array | ArrayBuffer,
    options?: unknown,
  ): Promise<ImageData>;

  encode(
    input: unknown,
    options?: unknown,
  ): Promise<Uint8Array>;

  encodeSimple(
    imageData: ImageData,
    quality?: number,
  ): Promise<Uint8Array>;

  getImageInfo(
    input: Uint8Array | ArrayBuffer,
  ): Promise<unknown>;

  initDecoder(config?: unknown): Promise<void>;
  initEncoder(config?: unknown): Promise<void>;
  isDecoderInitialized(): boolean;
  isEncoderInitialized(): boolean;
}

type CodecLoader = () => Promise<CodecAdapter>;

// ============================================================================
// Registry state
// ============================================================================

const codecLoaders = new Map<ImageFormat, CodecLoader>();
const loadedCodecs = new Map<ImageFormat, CodecAdapter>();
const loadingPromises = new Map<ImageFormat, Promise<CodecAdapter>>();

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a codec is available (installed)
 */
export function isCodecAvailable(format: ImageFormat): boolean {
  return codecLoaders.has(format);
}

/**
 * Get list of available formats
 */
export function getAvailableFormats(): ImageFormat[] {
  return [...codecLoaders.keys()];
}

/**
 * Load a codec, throwing if not installed
 */
export async function getCodec(format: ImageFormat): Promise<CodecAdapter> {
  // Return cached
  const cached = loadedCodecs.get(format);
  if (cached) return cached;

  // Check if already loading
  const existing = loadingPromises.get(format);
  if (existing) return existing;

  // Check if available
  const loader = codecLoaders.get(format);
  if (!loader) {
    throw new CodecNotInstalledError(format);
  }

  // Load codec
  const promise = loader()
    .then((codec) => {
      loadedCodecs.set(format, codec);
      loadingPromises.delete(format);
      return codec;
    })
    .catch((err) => {
      loadingPromises.delete(format);
      throw new CodecLoadError(format, err instanceof Error ? err : new Error(String(err)));
    });

  loadingPromises.set(format, promise);
  return promise;
}

/**
 * Try to load a codec, returning null if not available
 */
export async function tryGetCodec(format: ImageFormat): Promise<CodecAdapter | null> {
  try {
    return await getCodec(format);
  } catch {
    return null;
  }
}

// ============================================================================
// Codec registration
// ============================================================================

function registerCodec(format: ImageFormat, loader: CodecLoader): void {
  codecLoaders.set(format, loader);
}

async function tryRegisterAVIF(): Promise<void> {
  try {
    // Dynamic import to check if package is available
    const avif = await import('@dimkatet/jcodecs-avif');

    registerCodec('avif', async () => ({
      decode: avif.decode,
      decodeToImageData: avif.decodeToImageData,
      encode: avif.encode,
      encodeSimple: avif.encodeSimple,
      getImageInfo: avif.getImageInfo,
      initDecoder: avif.initDecoder,
      initEncoder: avif.initEncoder,
      isDecoderInitialized: avif.isDecoderInitialized,
      isEncoderInitialized: avif.isEncoderInitialized,
    }));
  } catch {
    // Package not installed, skip registration
  }
}

async function tryRegisterJXL(): Promise<void> {
  try {
    const jxl = await import('@dimkatet/jcodecs-jxl');

    registerCodec('jxl', async () => ({
      decode: jxl.decode,
      decodeToImageData: jxl.decodeToImageData,
      encode: jxl.encode,
      encodeSimple: jxl.encodeSimple,
      getImageInfo: jxl.getImageInfo,
      initDecoder: jxl.initDecoder,
      initEncoder: jxl.initEncoder,
      isDecoderInitialized: jxl.isDecoderInitialized,
      isEncoderInitialized: jxl.isEncoderInitialized,
    }));
  } catch {
    // Package not installed, skip registration
  }
}

// ============================================================================
// Initialization
// ============================================================================

let registrationPromise: Promise<void> | null = null;

/**
 * Ensure all available codecs are registered.
 * Safe to call multiple times.
 */
export async function ensureCodecsRegistered(): Promise<void> {
  if (!registrationPromise) {
    registrationPromise = Promise.all([
      tryRegisterAVIF(),
      tryRegisterJXL(),
    ]).then(() => undefined);
  }
  return registrationPromise;
}

// ============================================================================
// Testing utilities (not exported from index.ts)
// ============================================================================

/**
 * Reset registry state for testing purposes.
 * @internal
 */
export function _resetForTesting(): void {
  codecLoaders.clear();
  loadedCodecs.clear();
  loadingPromises.clear();
  registrationPromise = null;
}
