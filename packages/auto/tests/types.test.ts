import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  isAVIFImageData,
  isJXLImageData,
  type AutoImageData,
  type AutoMetadata,
  type AVIFAutoMetadata,
  type JXLAutoMetadata,
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

    it('narrows type correctly', () => {
      const data = createMockAutoImageData('avif');
      if (isAVIFImageData(data)) {
        // TypeScript should narrow the type here
        expect(data.format).toBe('avif');
        expect(data.metadata.format).toBe('avif');
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

    it('narrows type correctly', () => {
      const data = createMockAutoImageData('jxl');
      if (isJXLImageData(data)) {
        // TypeScript should narrow the type here
        expect(data.format).toBe('jxl');
        expect(data.metadata.format).toBe('jxl');
      }
    });
  });
});

describe('type inference', () => {
  it('AutoMetadata is discriminated union', () => {
    // Test that we can use format to discriminate
    const avifMeta: AutoMetadata = {
      format: 'avif',
      colorPrimaries: 'bt709',
      transferFunction: 'srgb',
      fullRange: true,
      maxCLL: 0,
      maxPALL: 0,
      isHDR: false,
      matrixCoefficients: 'bt709',
    };

    const jxlMeta: AutoMetadata = {
      format: 'jxl',
      colorPrimaries: 'bt709',
      transferFunction: 'srgb',
      fullRange: true,
      maxCLL: 0,
      maxPALL: 0,
      isHDR: false,
      isAnimated: false,
      frameCount: 1,
    };

    expect(avifMeta.format).toBe('avif');
    expect(jxlMeta.format).toBe('jxl');
  });

  it('metadata.format narrows type', () => {
    const metadata: AutoMetadata = createMockAutoImageData('avif').metadata;

    if (metadata.format === 'avif') {
      // Should have AVIF-specific fields
      expectTypeOf(metadata).toMatchTypeOf<AVIFAutoMetadata>();
    }

    const jxlMetadata: AutoMetadata = createMockAutoImageData('jxl').metadata;
    if (jxlMetadata.format === 'jxl') {
      // Should have JXL-specific fields
      expectTypeOf(jxlMetadata).toMatchTypeOf<JXLAutoMetadata>();
    }
  });

  it('AVIF metadata has matrixCoefficients', () => {
    const data = createMockAutoImageData('avif');
    if (isAVIFImageData(data)) {
      // matrixCoefficients is AVIF-specific
      expect(data.metadata).toHaveProperty('matrixCoefficients');
    }
  });

  it('JXL metadata has isAnimated, frameCount', () => {
    const data = createMockAutoImageData('jxl');
    if (isJXLImageData(data)) {
      // isAnimated and frameCount are JXL-specific
      expect(data.metadata).toHaveProperty('isAnimated');
      expect(data.metadata).toHaveProperty('frameCount');
    }
  });
});
