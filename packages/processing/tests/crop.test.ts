import { describe, it, expect, beforeAll } from 'vitest';
import { crop, init } from '@dimkatet/jcodecs-processing';
import {
  makeUint8Image,
  makeUint16Image,
  makeFloat32Image,
  makeFloat16Image,
} from './helpers';

beforeAll(async () => {
  await init();
});

describe('crop — basic functionality', () => {
  it('crops center region from uint8 RGBA', async () => {
    const src = makeUint8Image(64, 64, 4);
    const dst = await crop(src, { x: 16, y: 16, width: 32, height: 32 });

    expect(dst.descriptor.geometry.width).toBe(32);
    expect(dst.descriptor.geometry.height).toBe(32);
    expect(dst.data).toBeInstanceOf(Uint8Array);
    expect(dst.data.length).toBe(32 * 32 * 4);
  });

  it('crops uint16', async () => {
    const src = makeUint16Image(64, 64, 4);
    const dst = await crop(src, { x: 0, y: 0, width: 32, height: 32 });

    expect(dst.data).toBeInstanceOf(Uint16Array);
    expect(dst.data.length).toBe(32 * 32 * 4);
  });

  it('crops float32', async () => {
    const src = makeFloat32Image(64, 64, 4);
    const dst = await crop(src, { x: 10, y: 10, width: 20, height: 20 });

    expect(dst.data).toBeInstanceOf(Float32Array);
    expect(dst.data.length).toBe(20 * 20 * 4);
  });

  it('crops float16', async () => {
    const src = makeFloat16Image(64, 64, 4);
    const dst = await crop(src, { x: 10, y: 10, width: 20, height: 20 });

    expect(dst.data).toBeInstanceOf(Float16Array);
    expect(dst.data.length).toBe(20 * 20 * 4);
  });
});

describe('crop — pixel accuracy', () => {
  it('top-left crop extracts correct pixels', async () => {
    // Create 4x4 uint8 single-channel image with known values
    const data = new Uint8Array([
      10, 20, 30, 40,
      50, 60, 70, 80,
      90, 100, 110, 120,
      130, 140, 150, 160,
    ]);
    const src = {
      data,
      descriptor: {
        geometry: { width: 4, height: 4 },
        channels: { model: 'gray' as const, count: 1 as const },
        numeric: { sampleType: 'uint' as const, dataType: 'uint8' as const, bitDepth: 8 },
      },
    };

    // Crop top-left 2x2
    const dst = await crop(src, { x: 0, y: 0, width: 2, height: 2 });
    expect(Array.from(dst.data as Uint8Array)).toEqual([10, 20, 50, 60]);
  });

  it('bottom-right crop extracts correct pixels', async () => {
    const data = new Uint8Array([
      10, 20, 30, 40,
      50, 60, 70, 80,
      90, 100, 110, 120,
      130, 140, 150, 160,
    ]);
    const src = {
      data,
      descriptor: {
        geometry: { width: 4, height: 4 },
        channels: { model: 'gray' as const, count: 1 as const },
        numeric: { sampleType: 'uint' as const, dataType: 'uint8' as const, bitDepth: 8 },
      },
    };

    // Crop bottom-right 2x2
    const dst = await crop(src, { x: 2, y: 2, width: 2, height: 2 });
    expect(Array.from(dst.data as Uint8Array)).toEqual([110, 120, 150, 160]);
  });
});

describe('crop — descriptor preservation', () => {
  it('updates geometry width/height only', async () => {
    const src = makeUint8Image(64, 64, 4);
    const dst = await crop(src, { x: 10, y: 10, width: 30, height: 20 });

    expect(dst.descriptor.geometry.width).toBe(30);
    expect(dst.descriptor.geometry.height).toBe(20);
    expect(dst.descriptor.channels.model).toBe(src.descriptor.channels.model);
    expect(dst.descriptor.channels.count).toBe(src.descriptor.channels.count);
    expect(dst.descriptor.numeric.dataType).toBe(src.descriptor.numeric.dataType);
  });
});

describe('crop — edge cases', () => {
  it('full-image crop returns copy', async () => {
    const src = makeUint8Image(32, 32, 4);
    const dst = await crop(src, { x: 0, y: 0, width: 32, height: 32 });

    expect(dst.data.length).toBe(src.data.length);
    expect(dst.data.buffer).not.toBe(src.data.buffer);
  });

  it('1x1 crop', async () => {
    const src = makeUint8Image(64, 64, 4);
    const dst = await crop(src, { x: 32, y: 32, width: 1, height: 1 });

    expect(dst.data.length).toBe(4);
    expect(dst.descriptor.geometry.width).toBe(1);
    expect(dst.descriptor.geometry.height).toBe(1);
  });

  it('single row crop', async () => {
    const src = makeUint8Image(64, 32, 3);
    const dst = await crop(src, { x: 0, y: 15, width: 64, height: 1 });

    expect(dst.data.length).toBe(64 * 3);
    expect(dst.descriptor.geometry.height).toBe(1);
  });
});
