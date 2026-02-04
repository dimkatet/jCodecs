import { describe, it, expect } from 'vitest';
import { detectFormat, getFormatExtension, getMimeType } from '../src/format-detection';
import {
  AVIF_SAMPLE,
  AVIS_SAMPLE,
  MIF1_SAMPLE,
  JXL_CODESTREAM,
  JXL_CONTAINER,
  PNG_SAMPLE,
  EMPTY_BUFFER,
  SHORT_BUFFER,
} from './__mocks__/fixtures';

describe('detectFormat', () => {
  it('detects AVIF from ftyp+avif brand', () => {
    expect(detectFormat(AVIF_SAMPLE)).toBe('avif');
  });

  it('detects AVIF from ftyp+avis brand (animated)', () => {
    expect(detectFormat(AVIS_SAMPLE)).toBe('avif');
  });

  it('detects AVIF from ftyp+mif1 brand', () => {
    expect(detectFormat(MIF1_SAMPLE)).toBe('avif');
  });

  it('detects JXL codestream (0xFF 0x0A)', () => {
    expect(detectFormat(JXL_CODESTREAM)).toBe('jxl');
  });

  it('detects JXL container format', () => {
    expect(detectFormat(JXL_CONTAINER)).toBe('jxl');
  });

  it('returns "unknown" for PNG', () => {
    expect(detectFormat(PNG_SAMPLE)).toBe('unknown');
  });

  it('returns "unknown" for empty buffer', () => {
    expect(detectFormat(EMPTY_BUFFER)).toBe('unknown');
  });

  it('returns "unknown" for buffer < 12 bytes', () => {
    expect(detectFormat(SHORT_BUFFER)).toBe('unknown');
  });

  it('accepts ArrayBuffer input', () => {
    const arrayBuffer = AVIF_SAMPLE.buffer.slice(
      AVIF_SAMPLE.byteOffset,
      AVIF_SAMPLE.byteOffset + AVIF_SAMPLE.byteLength
    );
    expect(detectFormat(arrayBuffer)).toBe('avif');
  });
});

describe('getFormatExtension', () => {
  it('returns .avif for avif', () => {
    expect(getFormatExtension('avif')).toBe('.avif');
  });

  it('returns .jxl for jxl', () => {
    expect(getFormatExtension('jxl')).toBe('.jxl');
  });

  it('returns empty string for unknown', () => {
    expect(getFormatExtension('unknown')).toBe('');
  });
});

describe('getMimeType', () => {
  it('returns image/avif for avif', () => {
    expect(getMimeType('avif')).toBe('image/avif');
  });

  it('returns image/jxl for jxl', () => {
    expect(getMimeType('jxl')).toBe('image/jxl');
  });

  it('returns application/octet-stream for unknown', () => {
    expect(getMimeType('unknown')).toBe('application/octet-stream');
  });
});
