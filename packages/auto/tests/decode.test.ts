import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decode, decodeToImageData, getImageInfo } from '../src/decode';
import { UnsupportedFormatError, CodecNotInstalledError } from '../src/errors';
import { createMockCodecAdapter } from './__mocks__/codec-adapter';
import {
  AVIF_SAMPLE,
  JXL_CODESTREAM,
  PNG_SAMPLE,
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

describe('decode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('format auto-detection', () => {
    it('auto-detects and decodes AVIF', async () => {
      const result = await decode(AVIF_SAMPLE);

      expect(result.format).toBe('avif');
      expect(mockAvifAdapter.decode).toHaveBeenCalled();
    });

    it('auto-detects and decodes JXL', async () => {
      const result = await decode(JXL_CODESTREAM);

      expect(result.format).toBe('jxl');
      expect(mockJxlAdapter.decode).toHaveBeenCalled();
    });

    it('throws UnsupportedFormatError for unknown format', async () => {
      await expect(decode(PNG_SAMPLE)).rejects.toThrow(UnsupportedFormatError);
    });
  });

  describe('format override', () => {
    it('uses specified format instead of auto-detect', async () => {
      // Pass JXL data but force AVIF format
      const result = await decode(JXL_CODESTREAM, { format: 'avif' });

      expect(result.format).toBe('avif');
      expect(mockAvifAdapter.decode).toHaveBeenCalled();
      expect(mockJxlAdapter.decode).not.toHaveBeenCalled();
    });

    it('throws if specified format codec not installed', async () => {
      const { getCodec } = await import('../src/codec-registry');
      vi.mocked(getCodec).mockRejectedValueOnce(new CodecNotInstalledError('avif'));

      await expect(decode(AVIF_SAMPLE, { format: 'avif' })).rejects.toThrow(
        CodecNotInstalledError
      );
    });
  });

  describe('options passthrough', () => {
    it('passes bitDepth to codec', async () => {
      await decode(AVIF_SAMPLE, { bitDepth: 16 });

      expect(mockAvifAdapter.decode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({ bitDepth: 16 })
      );
    });

    it('passes maxThreads to codec', async () => {
      await decode(AVIF_SAMPLE, { maxThreads: 4 });

      expect(mockAvifAdapter.decode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({ maxThreads: 4 })
      );
    });

    it('passes ignoreColorProfile to codec', async () => {
      await decode(AVIF_SAMPLE, { ignoreColorProfile: true });

      expect(mockAvifAdapter.decode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({ ignoreColorProfile: true })
      );
    });

    it('passes format-specific options (avif:{})', async () => {
      // AVIF-specific options override common options
      await decode(AVIF_SAMPLE, {
        maxThreads: 2,
        avif: { maxThreads: 4 }, // Override
      });

      expect(mockAvifAdapter.decode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({ maxThreads: 4 })
      );
    });

    it('passes format-specific options (jxl:{})', async () => {
      // JXL-specific options override common options
      await decode(JXL_CODESTREAM, {
        maxThreads: 2,
        jxl: { maxThreads: 8 }, // Override
      });

      expect(mockJxlAdapter.decode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({ maxThreads: 8 })
      );
    });
  });

  describe('result structure', () => {
    it('returns AutoImageData with format field', async () => {
      const result = await decode(AVIF_SAMPLE);

      expect(result).toHaveProperty('format', 'avif');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('dataType');
      expect(result).toHaveProperty('bitDepth');
      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('metadata');
    });

    it('metadata includes format discriminator', async () => {
      const result = await decode(AVIF_SAMPLE);

      expect(result.metadata).toHaveProperty('format', 'avif');
    });

    it('data is correct TypedArray for dataType', async () => {
      const result = await decode(AVIF_SAMPLE);

      expect(result.dataType).toBe('uint8');
      expect(result.data).toBeInstanceOf(Uint8Array);
    });
  });
});

describe('decodeToImageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns standard ImageData', async () => {
    const result = await decodeToImageData(AVIF_SAMPLE);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('width');
    expect(result).toHaveProperty('height');
    expect(mockAvifAdapter.decodeToImageData).toHaveBeenCalled();
  });

  it('ImageData has format property', async () => {
    const result = await decodeToImageData(AVIF_SAMPLE);

    expect(result).toHaveProperty('format', 'avif');
  });

  it('auto-detects format', async () => {
    const avifResult = await decodeToImageData(AVIF_SAMPLE);
    const jxlResult = await decodeToImageData(JXL_CODESTREAM);

    expect(avifResult.format).toBe('avif');
    expect(jxlResult.format).toBe('jxl');
  });
});

describe('getImageInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns dimensions without full decode', async () => {
    const result = await getImageInfo(AVIF_SAMPLE);

    expect(result).toHaveProperty('width');
    expect(result).toHaveProperty('height');
    expect(result).toHaveProperty('bitDepth');
    expect(result).toHaveProperty('channels');
    expect(mockAvifAdapter.getImageInfo).toHaveBeenCalled();
    // decode should NOT be called
    expect(mockAvifAdapter.decode).not.toHaveBeenCalled();
  });

  it('returns metadata with format', async () => {
    const result = await getImageInfo(AVIF_SAMPLE);

    expect(result).toHaveProperty('format', 'avif');
    expect(result.metadata).toHaveProperty('format', 'avif');
  });

  it('throws for unknown format', async () => {
    await expect(getImageInfo(PNG_SAMPLE)).rejects.toThrow(UnsupportedFormatError);
  });
});
