/**
 * Test fixtures and mock data factories
 */

import type { AutoImageData, AutoMetadata } from '../../src/types';
import { MOCK_AVIF_METADATA, MOCK_JXL_METADATA } from './codec-adapter';

// ============================================================================
// Magic bytes samples
// ============================================================================

/** AVIF ftyp + avif brand */
export const AVIF_SAMPLE = new Uint8Array([
  0x00, 0x00, 0x00, 0x1c, // size
  0x66, 0x74, 0x79, 0x70, // 'ftyp'
  0x61, 0x76, 0x69, 0x66, // 'avif' brand
]);

/** AVIF ftyp + avis brand (animated) */
export const AVIS_SAMPLE = new Uint8Array([
  0x00, 0x00, 0x00, 0x1c,
  0x66, 0x74, 0x79, 0x70,
  0x61, 0x76, 0x69, 0x73, // 'avis'
]);

/** AVIF ftyp + mif1 brand */
export const MIF1_SAMPLE = new Uint8Array([
  0x00, 0x00, 0x00, 0x1c,
  0x66, 0x74, 0x79, 0x70,
  0x6d, 0x69, 0x66, 0x31, // 'mif1'
]);

/** JXL codestream (0xFF 0x0A) */
export const JXL_CODESTREAM = new Uint8Array([0xff, 0x0a, 0x00, 0x00]);

/** JXL container format (12-byte signature) */
export const JXL_CONTAINER = new Uint8Array([
  0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
]);

/** PNG header (unknown format) */
export const PNG_SAMPLE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Empty buffer */
export const EMPTY_BUFFER = new Uint8Array(0);

/** Too short buffer */
export const SHORT_BUFFER = new Uint8Array([0x00, 0x01, 0x02]);

// ============================================================================
// Mock ImageData factories
// ============================================================================

/**
 * Create mock ImageData for encode tests
 */
export function createMockImageData(width = 10, height = 10): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  // Fill with some pattern for verification
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;     // R
    data[i + 1] = 128; // G
    data[i + 2] = 64;  // B
    data[i + 3] = 255; // A
  }

  // Handle environments without native ImageData
  if (typeof ImageData !== 'undefined') {
    return new ImageData(data, width, height);
  }

  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

/**
 * Create mock AutoImageData for testing
 */
export function createMockAutoImageData(
  format: 'avif' | 'jxl',
  options?: Partial<{
    width: number;
    height: number;
    bitDepth: number;
    dataType: 'uint8' | 'uint16' | 'float16' | 'float32';
  }>
): AutoImageData {
  const width = options?.width ?? 10;
  const height = options?.height ?? 10;
  const bitDepth = options?.bitDepth ?? 8;
  const dataType = options?.dataType ?? 'uint8';

  const baseMetadata = format === 'avif' ? MOCK_AVIF_METADATA : MOCK_JXL_METADATA;
  const metadata = { format, ...baseMetadata } as AutoMetadata;

  let data: Uint8Array | Uint16Array | Float32Array;
  const pixelCount = width * height * 4;

  switch (dataType) {
    case 'uint16':
      data = new Uint16Array(pixelCount);
      break;
    case 'float16':
    case 'float32':
      data = new Float32Array(pixelCount);
      break;
    default:
      data = new Uint8Array(pixelCount);
  }

  return {
    data,
    dataType,
    bitDepth,
    width,
    height,
    channels: 4,
    format,
    metadata,
  } as AutoImageData;
}

// ============================================================================
// Fixture file loading helper (for browser tests)
// ============================================================================

/**
 * Load fixture file from the test server
 */
export async function loadFixture(filename: string): Promise<Uint8Array> {
  const response = await fetch(`/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load fixture: ${filename}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
