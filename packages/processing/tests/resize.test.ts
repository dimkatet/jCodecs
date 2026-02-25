import { describe, it, expect, beforeAll } from 'vitest';
import { resize, init } from '@dimkatet/jcodecs-processing';
import {
  makeUint8Image,
  makeUint16Image,
  makeFloat32Image,
  makeFloat16Image,
  allFinite,
  allInRange,
  allApprox,
} from './helpers';

beforeAll(async () => {
  await init();
});

describe('resize — basic functionality', () => {
  it('downscales uint8 RGBA', async () => {
    const src = makeUint8Image(64, 64, 4);
    const dst = await resize(src, { width: 32, height: 32 });

    expect(dst.descriptor.geometry.width).toBe(32);
    expect(dst.descriptor.geometry.height).toBe(32);
    expect(dst.data).toBeInstanceOf(Uint8Array);
    expect(dst.data.length).toBe(32 * 32 * 4);
    expect(allFinite(dst.data)).toBe(true);
    expect(allInRange(dst.data, 0, 255)).toBe(true);
  });

  it('upscales uint8 RGB', async () => {
    const src = makeUint8Image(32, 32, 3);
    const dst = await resize(src, { width: 64, height: 64 });

    expect(dst.descriptor.geometry.width).toBe(64);
    expect(dst.descriptor.geometry.height).toBe(64);
    expect(dst.data.length).toBe(64 * 64 * 3);
  });

  it('resizes uint16', async () => {
    const src = makeUint16Image(64, 48, 4);
    const dst = await resize(src, { width: 32, height: 24 });

    expect(dst.data).toBeInstanceOf(Uint16Array);
    expect(dst.data.length).toBe(32 * 24 * 4);
    expect(allInRange(dst.data, 0, 65535)).toBe(true);
  });

  it('resizes float32', async () => {
    const src = makeFloat32Image(64, 64, 4);
    const dst = await resize(src, { width: 32, height: 32 });

    expect(dst.data).toBeInstanceOf(Float32Array);
    expect(dst.data.length).toBe(32 * 32 * 4);
    expect(allFinite(dst.data)).toBe(true);
  });

  it('resizes float16', async () => {
    const src = makeFloat16Image(64, 64, 4);
    const dst = await resize(src, { width: 32, height: 32 });

    expect(dst.data).toBeInstanceOf(Float16Array);
    expect(dst.data.length).toBe(32 * 32 * 4);
    expect(allFinite(dst.data)).toBe(true);
  });
});

describe('resize — algorithms', () => {
  it('bilinear', async () => {
    const src = makeUint8Image(64, 64, 4);
    const dst = await resize(src, { width: 32, height: 32 }, { algorithm: 'bilinear' });
    expect(allFinite(dst.data)).toBe(true);
    expect(allInRange(dst.data, 0, 255)).toBe(true);
  });

  it('mitchell', async () => {
    const src = makeUint8Image(64, 64, 4);
    const dst = await resize(src, { width: 32, height: 32 }, { algorithm: 'mitchell' });
    expect(allFinite(dst.data)).toBe(true);
    expect(allInRange(dst.data, 0, 255)).toBe(true);
  });

  it('lanczos3', async () => {
    const src = makeUint8Image(64, 64, 4);
    const dst = await resize(src, { width: 32, height: 32 }, { algorithm: 'lanczos3' });
    expect(allFinite(dst.data)).toBe(true);
    expect(allInRange(dst.data, 0, 255)).toBe(true);
  });
});

describe('resize — channel counts', () => {
  it('1-channel grayscale', async () => {
    const src = makeUint8Image(32, 32, 1);
    const dst = await resize(src, { width: 16, height: 16 });
    expect(dst.data.length).toBe(16 * 16 * 1);
    expect(dst.descriptor.channels.count).toBe(1);
    expect(dst.descriptor.channels.model).toBe('gray');
  });

  it('2-channel graya', async () => {
    const src = makeUint8Image(32, 32, 2);
    const dst = await resize(src, { width: 16, height: 16 });
    expect(dst.data.length).toBe(16 * 16 * 2);
    expect(dst.descriptor.channels.count).toBe(2);
  });

  it('3-channel RGB', async () => {
    const src = makeUint8Image(32, 32, 3);
    const dst = await resize(src, { width: 16, height: 16 });
    expect(dst.data.length).toBe(16 * 16 * 3);
    expect(dst.descriptor.channels.count).toBe(3);
  });
});

describe('resize — descriptor preservation', () => {
  it('preserves all descriptor fields except geometry', async () => {
    const src = makeFloat32Image(64, 64, 4);
    const dst = await resize(src, { width: 32, height: 32 });

    expect(dst.descriptor.channels.model).toBe(src.descriptor.channels.model);
    expect(dst.descriptor.channels.count).toBe(src.descriptor.channels.count);
    expect(dst.descriptor.numeric.dataType).toBe(src.descriptor.numeric.dataType);
    expect(dst.descriptor.numeric.sampleType).toBe(src.descriptor.numeric.sampleType);
    expect(dst.descriptor.numeric.bitDepth).toBe(src.descriptor.numeric.bitDepth);
  });
});

describe('resize — edge cases', () => {
  it('1x1 → 1x1 returns identical data', async () => {
    const src = makeUint8Image(1, 1, 4, 128);
    const dst = await resize(src, { width: 1, height: 1 });
    expect(dst.data[0]).toBe(128);
    expect(dst.data.length).toBe(4);
  });

  it('same-size resize returns copy', async () => {
    const src = makeUint8Image(32, 32, 4);
    const dst = await resize(src, { width: 32, height: 32 });
    expect(dst.data.length).toBe(src.data.length);
    // Output should not share buffer with input
    expect(dst.data.buffer).not.toBe(src.data.buffer);
  });

  it('solid-color image stays solid after resize', async () => {
    const src = makeUint8Image(64, 64, 3, 200);
    const dst = await resize(src, { width: 32, height: 32 });
    expect(allApprox(dst.data, 200, 1)).toBe(true);
  });

  it('rectangular non-square resize', async () => {
    const src = makeUint8Image(100, 200, 4);
    const dst = await resize(src, { width: 50, height: 80 });
    expect(dst.descriptor.geometry.width).toBe(50);
    expect(dst.descriptor.geometry.height).toBe(80);
    expect(dst.data.length).toBe(50 * 80 * 4);
  });
});
