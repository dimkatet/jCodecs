/**
 * Unified encode functions
 */

import { getCodec, ensureCodecsRegistered } from './codec-registry';
import type { AutoImageData } from './types';
import type { ImageDescriptor } from '@dimkatet/jcodecs-core';
import {
  mapToAVIFEncodeOptions,
  mapToJXLEncodeOptions,
  DEFAULT_ENCODE_OPTIONS,
  type AutoEncodeOptions,
} from './options';
import { decode } from './decode';

// ============================================================================
// Descriptor construction helpers
// ============================================================================

/**
 * Map AutoEncodeOptions.colorSpace to descriptor color primaries string.
 */
function mapColorSpaceToPrimaries(colorSpace?: string): string {
  switch (colorSpace) {
    case 'display-p3': return 'displayP3';
    case 'rec2020': return 'bt2020';
    default: return 'bt709';
  }
}

/**
 * Build a codec descriptor from an existing ImageDescriptor + encode option overrides.
 * The encode options can override colorSpace, transferFunction, and bitDepth.
 */
function buildDescriptorFromImageDescriptor(
  src: ImageDescriptor,
  opts: AutoEncodeOptions,
): Record<string, unknown> {
  const bitDepth = opts.bitDepth ?? (src.numeric.bitDepth as number);
  // Keep the source dataType unless bitDepth changed
  const dataType = bitDepth > 16 ? 'float32'
    : bitDepth > 8 ? 'uint16'
    : 'uint8';

  return {
    geometry: { width: src.geometry.width, height: src.geometry.height },
    channels: { model: src.channels.model, count: src.channels.count },
    numeric: { dataType, bitDepth },
    color: { primaries: opts.colorSpace ? mapColorSpaceToPrimaries(opts.colorSpace) : (src.color?.primaries ?? 'bt709') },
    transfer: { function: opts.transferFunction ?? (src.transfer?.function ?? 'srgb') },
  };
}

/**
 * Build a basic codec descriptor from ImageData + encode options.
 */
function buildDescriptorFromImageData(
  imageData: ImageData,
  opts: AutoEncodeOptions,
): Record<string, unknown> {
  const bitDepth = opts.bitDepth ?? 8;
  return {
    geometry: { width: imageData.width, height: imageData.height },
    channels: { model: 'rgba', count: 4 },
    numeric: { dataType: 'uint8', bitDepth: bitDepth > 8 ? 8 : bitDepth },
    color: { primaries: mapColorSpaceToPrimaries(opts.colorSpace) },
    transfer: { function: opts.transferFunction ?? 'srgb' },
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
    // AutoImageData with descriptor
    const autoInput = input as AutoImageData;
    data = autoInput.data;
    descriptor = buildDescriptorFromImageDescriptor(autoInput.descriptor, opts);
  } else {
    // Standard ImageData (8-bit RGBA)
    const imgData = input as ImageData;
    data = new Uint8Array(
      imgData.data.buffer,
      imgData.data.byteOffset,
      imgData.data.byteLength,
    );
    descriptor = buildDescriptorFromImageData(imgData, opts);
  }

  switch (format) {
    case 'avif':
      return codec.encode(data, descriptor, mapToAVIFEncodeOptions(opts));
    case 'jxl':
      return codec.encode(data, descriptor, mapToJXLEncodeOptions(opts));
    default:
      throw new Error(`Cannot encode to format: ${format}`);
  }
}

/**
 * Simple encode with quality-only option
 */
export async function encodeSimple(
  imageData: ImageData,
  format: 'avif' | 'jxl',
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
  targetFormat: 'avif' | 'jxl',
  options?: Omit<AutoEncodeOptions, 'format'>,
): Promise<Uint8Array> {
  const decoded = await decode(input);

  return encode(decoded, {
    format: targetFormat,
    ...options,
  });
}
