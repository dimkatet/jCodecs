import { describe, it, expect } from 'vitest';
import {
  isAVIFImageData,
  isJXLImageData,
  type AutoImageData,
} from '../src/types';
import { createMockAutoImageData } from './__mocks__/fixtures';

describe('type guards', () => {
  describe('isAVIFImageData', () => {
    it('returns true for AVIF format', () => {
      const data = createMockAutoImageData('avif');
      expect(isAVIFImageData(data)).toBe(true);
    });

    it('returns false for JXL format', () => {
      const data = createMockAutoImageData('jxl');
      expect(isAVIFImageData(data)).toBe(false);
    });

    it('narrows format type correctly', () => {
      const data = createMockAutoImageData('avif');
      if (isAVIFImageData(data)) {
        expect(data.format).toBe('avif');
      }
    });
  });

  describe('isJXLImageData', () => {
    it('returns true for JXL format', () => {
      const data = createMockAutoImageData('jxl');
      expect(isJXLImageData(data)).toBe(true);
    });

    it('returns false for AVIF format', () => {
      const data = createMockAutoImageData('avif');
      expect(isJXLImageData(data)).toBe(false);
    });

    it('narrows format type correctly', () => {
      const data = createMockAutoImageData('jxl');
      if (isJXLImageData(data)) {
        expect(data.format).toBe('jxl');
      }
    });
  });
});

describe('AutoImageData structure', () => {
  it('has data, descriptor, and format fields', () => {
    const data = createMockAutoImageData('avif');

    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('descriptor');
    expect(data).toHaveProperty('format', 'avif');
  });

  it('descriptor contains geometry with dimensions', () => {
    const data = createMockAutoImageData('avif', { width: 100, height: 200 });

    expect(data.descriptor.geometry).toEqual({ width: 100, height: 200 });
  });

  it('descriptor.numeric reflects specified bitDepth and dataType', () => {
    const data = createMockAutoImageData('jxl', { bitDepth: 10, dataType: 'uint16' });

    expect(data.descriptor.numeric.bitDepth).toBe(10);
    expect(data.descriptor.numeric.dataType).toBe('uint16');
  });

  it('data is a TypedArray matching dataType', () => {
    const uint8Data = createMockAutoImageData('avif', { dataType: 'uint8' });
    expect(uint8Data.data).toBeInstanceOf(Uint8Array);

    const uint16Data = createMockAutoImageData('jxl', { dataType: 'uint16' });
    expect(uint16Data.data).toBeInstanceOf(Uint16Array);
  });
});

describe('type compatibility', () => {
  it('AutoImageData with format avif satisfies the interface', () => {
    const data: AutoImageData = createMockAutoImageData('avif');
    expect(data.format).toBe('avif');
  });

  it('AutoImageData with format jxl satisfies the interface', () => {
    const data: AutoImageData = createMockAutoImageData('jxl');
    expect(data.format).toBe('jxl');
  });
});
