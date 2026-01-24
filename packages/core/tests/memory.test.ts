import { describe, it, expect } from 'vitest';
import { imageDataToExtended } from '../src/memory';

describe('Memory utilities', () => {
  describe('imageDataToExtended', () => {
    it('should convert ImageData to ExtendedImageData format', () => {
      const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
      const imageData = {
        data,
        width: 2,
        height: 1,
        colorSpace: 'srgb' as const,
      };

      // @ts-expect-error - simplified ImageData for testing
      const result = imageDataToExtended(imageData);

      expect(result.width).toBe(2);
      expect(result.height).toBe(1);
      expect(result.hasAlpha).toBe(true);
      expect(result.bitDepth).toBe(8);
      expect(result.colorSpace).toBe('srgb');
      expect(result.data).toBeInstanceOf(Uint8Array);
    });
  });
});
