/**
 * Unified encode functions
 */

import { getCodec, ensureCodecsRegistered } from './codec-registry';
import type { AutoImageData } from './types';
import {
  mapToAVIFEncodeOptions,
  mapToJXLEncodeOptions,
  mapToEXREncodeOptions,
  DEFAULT_ENCODE_OPTIONS,
  type AutoEncodeOptions,
} from './options';
import { decode } from './decode';

// ============================================================================
// Descriptor construction helpers
// ============================================================================

/**
 * Build a basic descriptor for an 8-bit sRGB ImageData.
 */
function buildDescriptorFromImageData(imageData: ImageData): Record<string, unknown> {
  return {
    geometry: { width: imageData.width, height: imageData.height },
    channels: { model: 'rgba', count: 4 },
    numeric: { dataType: 'uint8', bitDepth: 8 },
    color: { primaries: 'bt709' },
    transfer: { function: 'srgb' },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Encode image to specified format
 */
export async function encode(
  input: AutoImageData | ImageData,
  options: AutoEncodeOptions,
): Promise<Uint8Array> {
  await ensureCodecsRegistered();

  const { format } = options;
  const opts = { ...DEFAULT_ENCODE_OPTIONS, ...options };

  const codec = await getCodec(format);

  let data: Uint8Array | Uint16Array | Float16Array | Float32Array;
  let descriptor: Record<string, unknown>;

  if ('descriptor' in input && 'format' in input) {
    // AutoImageData — pass data and descriptor through as-is
    const autoInput = input as AutoImageData;
    data = autoInput.data;
    descriptor = autoInput.descriptor as unknown as Record<string, unknown>;
  } else {
    // Standard ImageData (8-bit sRGB RGBA)
    const imgData = input as ImageData;
    data = new Uint8Array(
      imgData.data.buffer,
      imgData.data.byteOffset,
      imgData.data.byteLength,
    );
    descriptor = buildDescriptorFromImageData(imgData);
  }

  switch (format) {
    case 'avif':
      return codec.encode(data, descriptor, mapToAVIFEncodeOptions(opts));
    case 'jxl':
      return codec.encode(data, descriptor, mapToJXLEncodeOptions(opts));
    case 'exr':
      return codec.encode(data, descriptor, mapToEXREncodeOptions(opts));
    default:
      throw new Error(`Cannot encode to format: ${format}`);
  }
}

/**
 * Simple encode with quality-only option
 */
export async function encodeSimple(
  imageData: ImageData,
  format: 'avif' | 'jxl' | 'exr',
  quality = 75,
): Promise<Uint8Array> {
  await ensureCodecsRegistered();

  const codec = await getCodec(format);
  return codec.encodeSimple(imageData, quality);
}

/**
 * Transcode: decode one format and encode to another
 */
export async function transcode(
  input: Uint8Array | ArrayBuffer,
  targetFormat: 'avif' | 'jxl' | 'exr',
  options?: Omit<AutoEncodeOptions, 'format'>,
): Promise<Uint8Array> {
  const decoded = await decode(input);

  return encode(decoded, {
    format: targetFormat,
    ...options,
  });
}
