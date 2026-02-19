import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encode, encodeSimple, transcode } from '../src/encode';
import { CodecNotInstalledError } from '../src/errors';
import {
  createMockCodecAdapter,
  AVIF_MAGIC_BYTES,
  JXL_MAGIC_BYTES,
} from './__mocks__/codec-adapter';
import {
  createMockImageData,
  createMockAutoImageData,
  AVIF_SAMPLE,
  JXL_CODESTREAM,
} from './__mocks__/fixtures';

// Create persistent mock adapters so we can spy on them
const mockAvifAdapter = createMockCodecAdapter('avif');
const mockJxlAdapter = createMockCodecAdapter('jxl');

// Mock the codec-registry module
vi.mock('../src/codec-registry', () => ({
  ensureCodecsRegistered: vi.fn().mockResolvedValue(undefined),
  getCodec: vi.fn().mockImplementation(async (format: string) => {
    if (format === 'avif') return mockAvifAdapter;
    if (format === 'jxl') return mockJxlAdapter;
    throw new CodecNotInstalledError(format as 'avif' | 'jxl');
  }),
}));

describe('encode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('format selection', () => {
    it('encodes to AVIF when format: "avif"', async () => {
      const imageData = createMockImageData();
      await encode(imageData, { format: 'avif' });

      expect(mockAvifAdapter.encode).toHaveBeenCalled();
      expect(mockJxlAdapter.encode).not.toHaveBeenCalled();
    });

    it('encodes to JXL when format: "jxl"', async () => {
      const imageData = createMockImageData();
      await encode(imageData, { format: 'jxl' });

      expect(mockJxlAdapter.encode).toHaveBeenCalled();
      expect(mockAvifAdapter.encode).not.toHaveBeenCalled();
    });

    it('throws for format: "unknown"', async () => {
      const imageData = createMockImageData();

      await expect(
        encode(imageData, { format: 'unknown' as 'avif' })
      ).rejects.toThrow();
    });

    it('throws if target codec not installed', async () => {
      const { getCodec } = await import('../src/codec-registry');
      vi.mocked(getCodec).mockRejectedValueOnce(new CodecNotInstalledError('avif'));

      const imageData = createMockImageData();
      await expect(encode(imageData, { format: 'avif' })).rejects.toThrow(
        CodecNotInstalledError
      );
    });
  });

  describe('input handling', () => {
    it('accepts ImageData input — calls codec.encode(data, descriptor, options)', async () => {
      const imageData = createMockImageData();
      await encode(imageData, { format: 'avif' });

      // New API: encode(rawPixelData, descriptor, codecOptions)
      expect(mockAvifAdapter.encode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({ geometry: { width: 10, height: 10 } }),
        expect.any(Object)
      );
    });

    it('accepts AutoImageData input', async () => {
      const autoImageData = createMockAutoImageData('avif');
      await encode(autoImageData, { format: 'jxl' });

      expect(mockJxlAdapter.encode).toHaveBeenCalled();
    });

    it('descriptor passed to codec does not include format field', async () => {
      const autoImageData = createMockAutoImageData('avif');
      await encode(autoImageData, { format: 'jxl' });

      // descriptor is the 2nd argument to codec.encode
      const [, descriptorArg] = mockJxlAdapter.encode.mock.calls[0];
      expect(descriptorArg).not.toHaveProperty('format');
    });
  });

  describe('options', () => {
    it('applies quality option (goes into codec options, 3rd arg)', async () => {
      const imageData = createMockImageData();
      await encode(imageData, { format: 'avif', quality: 90 });

      expect(mockAvifAdapter.encode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Object),
        expect.objectContaining({ quality: 90 })
      );
    });

    it('applies bitDepth option (goes into descriptor, 2nd arg)', async () => {
      // Use AutoImageData so bitDepth is not clamped (ImageData is always 8-bit)
      const autoImageData = createMockAutoImageData('avif');
      await encode(autoImageData, { format: 'jxl', bitDepth: 10 });

      expect(mockJxlAdapter.encode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({ numeric: expect.objectContaining({ bitDepth: 10 }) }),
        expect.any(Object)
      );
    });

    it('applies lossless option (goes into codec options, 3rd arg)', async () => {
      const imageData = createMockImageData();
      await encode(imageData, { format: 'jxl', lossless: true });

      expect(mockJxlAdapter.encode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Object),
        expect.objectContaining({ lossless: true })
      );
    });

    it('applies colorSpace option (maps to descriptor.color.primaries, 2nd arg)', async () => {
      const imageData = createMockImageData();
      await encode(imageData, { format: 'avif', colorSpace: 'display-p3' });

      // 'display-p3' maps to ImageDescriptor primaries 'displayP3'
      expect(mockAvifAdapter.encode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({ color: { primaries: 'displayP3' } }),
        expect.any(Object)
      );
    });

    it('format-specific options override common options', async () => {
      const imageData = createMockImageData();
      await encode(imageData, {
        format: 'avif',
        quality: 50,
        avif: { quality: 95 }, // Override via format-specific key
      });

      expect(mockAvifAdapter.encode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Object),
        expect.objectContaining({ quality: 95 })
      );
    });
  });

  describe('output', () => {
    it('returns Uint8Array', async () => {
      const imageData = createMockImageData();
      const result = await encode(imageData, { format: 'avif' });

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('output is valid AVIF (magic bytes)', async () => {
      const imageData = createMockImageData();
      const result = await encode(imageData, { format: 'avif' });

      // Check that mock returns AVIF magic bytes
      expect(result[4]).toBe(AVIF_MAGIC_BYTES[4]); // 'f' of 'ftyp'
      expect(result[5]).toBe(AVIF_MAGIC_BYTES[5]); // 't'
      expect(result[6]).toBe(AVIF_MAGIC_BYTES[6]); // 'y'
      expect(result[7]).toBe(AVIF_MAGIC_BYTES[7]); // 'p'
    });

    it('output is valid JXL (magic bytes)', async () => {
      const imageData = createMockImageData();
      const result = await encode(imageData, { format: 'jxl' });

      // JXL codestream starts with 0xFF 0x0A
      expect(result[0]).toBe(JXL_MAGIC_BYTES[0]); // 0xFF
      expect(result[1]).toBe(JXL_MAGIC_BYTES[1]); // 0x0A
    });
  });
});

describe('encodeSimple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('encodes ImageData to AVIF with quality', async () => {
    const imageData = createMockImageData();
    await encodeSimple(imageData, 'avif', 80);

    expect(mockAvifAdapter.encodeSimple).toHaveBeenCalledWith(
      expect.any(Object),
      80
    );
  });

  it('encodes ImageData to JXL with quality', async () => {
    const imageData = createMockImageData();
    await encodeSimple(imageData, 'jxl', 85);

    expect(mockJxlAdapter.encodeSimple).toHaveBeenCalledWith(
      expect.any(Object),
      85
    );
  });

  it('uses default quality 75', async () => {
    const imageData = createMockImageData();
    await encodeSimple(imageData, 'avif');

    expect(mockAvifAdapter.encodeSimple).toHaveBeenCalledWith(
      expect.any(Object),
      75
    );
  });
});

describe('transcode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decodes AVIF and encodes to JXL', async () => {
    await transcode(AVIF_SAMPLE, 'jxl');

    expect(mockAvifAdapter.decode).toHaveBeenCalled();
    expect(mockJxlAdapter.encode).toHaveBeenCalled();
  });

  it('decodes JXL and encodes to AVIF', async () => {
    await transcode(JXL_CODESTREAM, 'avif');

    expect(mockJxlAdapter.decode).toHaveBeenCalled();
    expect(mockAvifAdapter.encode).toHaveBeenCalled();
  });

  it('preserves quality settings (goes into codec options, 3rd arg)', async () => {
    await transcode(AVIF_SAMPLE, 'jxl', { quality: 90 });

    expect(mockJxlAdapter.encode).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.any(Object),
      expect.objectContaining({ quality: 90 })
    );
  });

  it('handles lossless transcode (goes into codec options, 3rd arg)', async () => {
    await transcode(AVIF_SAMPLE, 'jxl', { lossless: true });

    expect(mockJxlAdapter.encode).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.any(Object),
      expect.objectContaining({ lossless: true })
    );
  });
});
