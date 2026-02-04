import { describe, it, expect } from 'vitest';
import {
  CodecNotInstalledError,
  CodecLoadError,
  UnsupportedFormatError,
} from '../src/errors';

describe('CodecNotInstalledError', () => {
  it('has correct name', () => {
    const err = new CodecNotInstalledError('avif');
    expect(err.name).toBe('CodecNotInstalledError');
  });

  it('includes format in message', () => {
    const err = new CodecNotInstalledError('avif');
    expect(err.message).toContain('avif');
  });

  it('suggests package to install', () => {
    const err = new CodecNotInstalledError('jxl');
    expect(err.message).toContain('@dimkatet/jcodecs-jxl');
  });

  it('exposes format property', () => {
    const err = new CodecNotInstalledError('avif');
    expect(err.format).toBe('avif');
  });

  it('is instanceof Error', () => {
    const err = new CodecNotInstalledError('avif');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('CodecLoadError', () => {
  const cause = new Error('Failed to load WASM');

  it('has correct name', () => {
    const err = new CodecLoadError('avif', cause);
    expect(err.name).toBe('CodecLoadError');
  });

  it('includes format in message', () => {
    const err = new CodecLoadError('avif', cause);
    expect(err.message).toContain('avif');
  });

  it('includes cause error message', () => {
    const err = new CodecLoadError('jxl', cause);
    expect(err.message).toContain('Failed to load WASM');
  });

  it('exposes format property', () => {
    const err = new CodecLoadError('jxl', cause);
    expect(err.format).toBe('jxl');
  });

  it('exposes cause property', () => {
    const err = new CodecLoadError('avif', cause);
    expect(err.cause).toBe(cause);
  });

  it('is instanceof Error', () => {
    const err = new CodecLoadError('avif', cause);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('UnsupportedFormatError', () => {
  it('has correct name', () => {
    const err = new UnsupportedFormatError(null);
    expect(err.name).toBe('UnsupportedFormatError');
  });

  it('includes magic bytes hint when data provided', () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const err = new UnsupportedFormatError(data);
    expect(err.message).toContain('magic bytes');
    expect(err.message).toContain('89 50 4e 47');
  });

  it('works with null data', () => {
    const err = new UnsupportedFormatError(null);
    expect(err.message).toContain('Unsupported');
    expect(err.message).not.toContain('magic bytes');
  });

  it('is instanceof Error', () => {
    const err = new UnsupportedFormatError(null);
    expect(err).toBeInstanceOf(Error);
  });

  it('truncates magic bytes display to first 12 bytes', () => {
    const data = new Uint8Array(20).fill(0xaa);
    const err = new UnsupportedFormatError(data);
    // Should show only first 12 bytes
    const matches = err.message.match(/aa/g);
    expect(matches?.length).toBe(12);
  });
});
