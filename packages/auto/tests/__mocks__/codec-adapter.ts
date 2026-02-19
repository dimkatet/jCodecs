/**
 * Mock codec adapter factory for tests
 */

import { vi, type Mock } from 'vitest';
import type { CodecAdapter } from '../../src/codec-registry';

// Magic bytes for output validation
export const AVIF_MAGIC_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x1c,
  0x66, 0x74, 0x79, 0x70, // ftyp
  0x61, 0x76, 0x69, 0x66, // avif
]);

export const JXL_MAGIC_BYTES = new Uint8Array([0xff, 0x0a]);

// Default mock ImageDescriptor (partial — enough for test assertions)
export const MOCK_DESCRIPTOR = {
  geometry: { width: 10, height: 10 },
  channels: { model: 'rgba', count: 4 },
  numeric: { sampleType: 'uint', dataType: 'uint8', bitDepth: 8 },
  color: { primaries: 'bt709' },
  transfer: { function: 'srgb' },
};

export interface MockCodecAdapter extends CodecAdapter {
  decode: Mock;
  decodeToImageData: Mock;
  encode: Mock;
  encodeSimple: Mock;
  getImageInfo: Mock;
  initDecoder: Mock;
  initEncoder: Mock;
  isDecoderInitialized: Mock;
  isEncoderInitialized: Mock;
}

/**
 * Create a mock codec adapter for testing
 */
export function createMockCodecAdapter(format: 'avif' | 'jxl'): MockCodecAdapter {
  const magicBytes = format === 'avif' ? AVIF_MAGIC_BYTES : JXL_MAGIC_BYTES;

  return {
    // decode returns { data, descriptor } in the new ImageDescriptor API
    decode: vi.fn().mockResolvedValue({
      data: new Uint8Array(10 * 10 * 4), // 10x10 RGBA
      descriptor: { ...MOCK_DESCRIPTOR },
    }),

    decodeToImageData: vi.fn().mockResolvedValue(
      typeof ImageData !== 'undefined'
        ? new ImageData(10, 10)
        : { data: new Uint8ClampedArray(10 * 10 * 4), width: 10, height: 10, colorSpace: 'srgb' }
    ),

    // encode(data, descriptor, options) — 3 args in new API
    encode: vi.fn().mockResolvedValue(new Uint8Array([...magicBytes, 0x00, 0x00])),

    encodeSimple: vi.fn().mockResolvedValue(new Uint8Array([...magicBytes, 0x00, 0x00])),

    // getImageInfo returns ImageDescriptor directly (auto wraps it in { descriptor, format })
    getImageInfo: vi.fn().mockResolvedValue({ ...MOCK_DESCRIPTOR }),

    initDecoder: vi.fn().mockResolvedValue(undefined),
    initEncoder: vi.fn().mockResolvedValue(undefined),
    isDecoderInitialized: vi.fn().mockReturnValue(true),
    isEncoderInitialized: vi.fn().mockReturnValue(true),
  };
}

/**
 * Create mock codec module (simulates @jcodecs/avif or @jcodecs/jxl)
 */
export function createMockCodecModule(format: 'avif' | 'jxl') {
  const adapter = createMockCodecAdapter(format);
  return {
    decode: adapter.decode,
    decodeToImageData: adapter.decodeToImageData,
    encode: adapter.encode,
    encodeSimple: adapter.encodeSimple,
    getImageInfo: adapter.getImageInfo,
    initDecoder: adapter.initDecoder,
    initEncoder: adapter.initEncoder,
    isDecoderInitialized: adapter.isDecoderInitialized,
    isEncoderInitialized: adapter.isEncoderInitialized,
  };
}
