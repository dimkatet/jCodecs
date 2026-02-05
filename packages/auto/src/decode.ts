/**
 * Unified decode functions with auto-detection
 */

import { detectFormat, type ImageFormat } from './format-detection';
import { getCodec, ensureCodecsRegistered } from './codec-registry';
import type { AutoImageData, AutoImageInfo, AutoMetadata, AutoDataType } from './types';
import {
  mapToAVIFDecodeOptions,
  mapToJXLDecodeOptions,
  DEFAULT_DECODE_OPTIONS,
  type AutoDecodeOptions,
} from './options';
import { UnsupportedFormatError } from './errors';

/**
 * Decode image with automatic format detection
 */
export async function decode(
  input: Uint8Array | ArrayBuffer,
  options: AutoDecodeOptions = {},
): Promise<AutoImageData> {
  await ensureCodecsRegistered();

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const opts = { ...DEFAULT_DECODE_OPTIONS, ...options };

  // Detect or use specified format
  const format = opts.format ?? detectFormat(data);

  if (format === 'unknown') {
    throw new UnsupportedFormatError(data);
  }

  const codec = await getCodec(format);

  let codecOptions: unknown;
  switch (format) {
    case 'avif':
      codecOptions = mapToAVIFDecodeOptions(opts);
      break;
    case 'jxl':
      codecOptions = mapToJXLDecodeOptions(opts);
      break;
  }

  const result = (await codec.decode(data, codecOptions)) as {
    data: Uint8Array | Uint16Array | Float16Array | Float32Array;
    dataType: string;
    bitDepth: number;
    width: number;
    height: number;
    channels: number;
    metadata: Record<string, unknown>;
  };

  return {
    data: result.data,
    dataType: result.dataType as AutoDataType,
    bitDepth: result.bitDepth,
    width: result.width,
    height: result.height,
    channels: result.channels,
    format,
    metadata: { format, ...result.metadata } as AutoMetadata,
  };
}

/**
 * Decode to standard ImageData (8-bit RGBA)
 */
export async function decodeToImageData(
  input: Uint8Array | ArrayBuffer,
  options: AutoDecodeOptions = {},
): Promise<ImageData & { format: ImageFormat }> {
  await ensureCodecsRegistered();

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const opts = { ...DEFAULT_DECODE_OPTIONS, ...options };

  const format = opts.format ?? detectFormat(data);

  if (format === 'unknown') {
    throw new UnsupportedFormatError(data);
  }

  const codec = await getCodec(format);

  let codecOptions: unknown;
  switch (format) {
    case 'avif':
      codecOptions = mapToAVIFDecodeOptions(opts);
      break;
    case 'jxl':
      codecOptions = mapToJXLDecodeOptions(opts);
      break;
  }

  const imageData = await codec.decodeToImageData(data, codecOptions);

  // Extend ImageData with format info
  return Object.assign(imageData, { format });
}

/**
 * Get image info without full decode
 */
export async function getImageInfo(
  input: Uint8Array | ArrayBuffer,
  options: Pick<AutoDecodeOptions, 'format'> = {},
): Promise<AutoImageInfo> {
  await ensureCodecsRegistered();

  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const format = options.format ?? detectFormat(data);

  if (format === 'unknown') {
    throw new UnsupportedFormatError(data);
  }

  const codec = await getCodec(format);
  const info = (await codec.getImageInfo(data)) as {
    width: number;
    height: number;
    bitDepth: number;
    channels: number;
    metadata: Record<string, unknown>;
  };

  return {
    width: info.width,
    height: info.height,
    bitDepth: info.bitDepth,
    channels: info.channels,
    format,
    metadata: { format, ...info.metadata } as AutoMetadata,
  };
}

