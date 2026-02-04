/**
 * Unified encode functions
 */

import { getCodec, ensureCodecsRegistered } from './codec-registry';
import type { AutoImageData } from './types';
import {
  mapToAVIFEncodeOptions,
  mapToJXLEncodeOptions,
  DEFAULT_ENCODE_OPTIONS,
  type AutoEncodeOptions,
} from './options';
import { decode } from './decode';

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

  // Prepare input - if AutoImageData, strip format field for codec compatibility
  let codecInput: unknown;
  if ('format' in input && 'metadata' in input) {
    // AutoImageData - remove format field from top level
    // Also need to remove format from metadata
    const { format: _f, metadata, ...rest } = input as AutoImageData;
    const metadataObj = metadata as unknown as Record<string, unknown>;
    const { format: _mf, ...metadataRest } = metadataObj;
    codecInput = { ...rest, metadata: metadataRest };
  } else {
    codecInput = input;
  }

  switch (format) {
    case 'avif':
      return codec.encode(codecInput, mapToAVIFEncodeOptions(opts));
    case 'jxl':
      return codec.encode(codecInput, mapToJXLEncodeOptions(opts));
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
