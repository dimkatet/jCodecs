import { describe, it, expect } from 'vitest';
import {
  isEncoderInitialized,
  isDecoderInitialized,
  encode,
  DEFAULT_ENCODE_OPTIONS,
  DEFAULT_DECODE_OPTIONS,
} from '../src/index';

describe('@jcodecs/avif', () => {
  describe('module exports', () => {
    it('should export encode and decode functions', async () => {
      const module = await import('../src/index');
      expect(typeof module.encode).toBe('function');
      expect(typeof module.decode).toBe('function');
    });

    it('should export initialization functions', async () => {
      const module = await import('../src/index');
      expect(typeof module.init).toBe('function');
      expect(typeof module.initDecoder).toBe('function');
      expect(typeof module.initEncoder).toBe('function');
    });

    it('should export default options', () => {
      expect(DEFAULT_ENCODE_OPTIONS).toBeDefined();
      expect(DEFAULT_ENCODE_OPTIONS.quality).toBe(75);
      expect(DEFAULT_DECODE_OPTIONS).toBeDefined();
    });
  });

  describe('encoder (not available)', () => {
    it('should report encoder as not initialized', () => {
      expect(isEncoderInitialized()).toBe(false);
    });

    it('should throw error when trying to encode', async () => {
      const fakeImageData = {
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      } as ImageData;

      await expect(encode(fakeImageData)).rejects.toThrow(
        'AVIF encoder is not yet available'
      );
    });
  });

  describe('decoder (available)', () => {
    it('should report decoder as not initialized before init', () => {
      expect(isDecoderInitialized()).toBe(false);
    });
  });

  describe('options', () => {
    it('should have valid encode options', () => {
      expect(DEFAULT_ENCODE_OPTIONS.quality).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_ENCODE_OPTIONS.quality).toBeLessThanOrEqual(100);
      expect(DEFAULT_ENCODE_OPTIONS.speed).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_ENCODE_OPTIONS.speed).toBeLessThanOrEqual(10);
    });

    it('should have valid decode options', () => {
      expect(DEFAULT_DECODE_OPTIONS.bitDepth).toBe(0);
      expect(DEFAULT_DECODE_OPTIONS.useThreads).toBe(true);
    });
  });
});
