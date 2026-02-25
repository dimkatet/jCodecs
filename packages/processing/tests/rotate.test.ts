import { describe, it, expect, beforeAll } from 'vitest';
import { rotate, init } from '@dimkatet/jcodecs-processing';
import {
  makeUint8Image,
  makeUint16Image,
  makeFloat32Image,
  makeFloat16Image,
} from './helpers';

beforeAll(async () => {
  await init();
});

describe('rotate — dimensions', () => {
  it('90° CW swaps width and height', async () => {
    const src = makeUint8Image(100, 60, 4);
    const dst = await rotate(src, 90);

    expect(dst.descriptor.geometry.width).toBe(60);
    expect(dst.descriptor.geometry.height).toBe(100);
    expect(dst.data.length).toBe(60 * 100 * 4);
  });

  it('180° preserves width and height', async () => {
    const src = makeUint8Image(100, 60, 4);
    const dst = await rotate(src, 180);

    expect(dst.descriptor.geometry.width).toBe(100);
    expect(dst.descriptor.geometry.height).toBe(60);
    expect(dst.data.length).toBe(100 * 60 * 4);
  });

  it('270° CW swaps width and height', async () => {
    const src = makeUint8Image(100, 60, 4);
    const dst = await rotate(src, 270);

    expect(dst.descriptor.geometry.width).toBe(60);
    expect(dst.descriptor.geometry.height).toBe(100);
    expect(dst.data.length).toBe(60 * 100 * 4);
  });
});

describe('rotate — pixel accuracy', () => {
  // Use a 2x3 single-channel image with distinct values to verify transforms
  // Source (2 cols × 3 rows):
  //  A B
  //  C D
  //  E F
  function makeKnownImage() {
    const data = new Uint8Array([10, 20, 30, 40, 50, 60]); // row-major
    return {
      data,
      descriptor: {
        geometry: { width: 2, height: 3 },
        channels: { model: 'gray' as const, count: 1 as const },
        numeric: { sampleType: 'uint' as const, dataType: 'uint8' as const, bitDepth: 8 },
      },
    };
  }

  it('90° CW rotation — pixel order', async () => {
    const src = makeKnownImage();
    // 90° CW: output is 3 cols × 2 rows
    // Expected (reading top-left to bottom-right):
    //  E C A
    //  F D B
    const dst = await rotate(src, 90);
    expect(dst.descriptor.geometry.width).toBe(3);
    expect(dst.descriptor.geometry.height).toBe(2);
    expect(Array.from(dst.data as Uint8Array)).toEqual([50, 30, 10, 60, 40, 20]);
  });

  it('180° rotation — pixel order', async () => {
    const src = makeKnownImage();
    // 180°: output is 2 cols × 3 rows (same size)
    // Expected:
    //  F E
    //  D C
    //  B A
    const dst = await rotate(src, 180);
    expect(Array.from(dst.data as Uint8Array)).toEqual([60, 50, 40, 30, 20, 10]);
  });

  it('270° CW (90° CCW) rotation — pixel order', async () => {
    const src = makeKnownImage();
    // 270° CW: output is 3 cols × 2 rows
    // Expected:
    //  B D F
    //  A C E
    const dst = await rotate(src, 270);
    expect(dst.descriptor.geometry.width).toBe(3);
    expect(dst.descriptor.geometry.height).toBe(2);
    expect(Array.from(dst.data as Uint8Array)).toEqual([20, 40, 60, 10, 30, 50]);
  });

  it('four 90° rotations return to original', async () => {
    const src = makeUint8Image(32, 48, 3);
    let img = { data: src.data, descriptor: src.descriptor };
    for (let i = 0; i < 4; i++) {
      img = await rotate(img, 90);
    }
    expect(img.descriptor.geometry.width).toBe(src.descriptor.geometry.width);
    expect(img.descriptor.geometry.height).toBe(src.descriptor.geometry.height);
    expect(Array.from(img.data as Uint8Array)).toEqual(Array.from(src.data));
  });
});

describe('rotate — data types', () => {
  it('rotates uint16', async () => {
    const src = makeUint16Image(32, 48, 4);
    const dst = await rotate(src, 90);

    expect(dst.data).toBeInstanceOf(Uint16Array);
    expect(dst.data.length).toBe(48 * 32 * 4);
  });

  it('rotates float32', async () => {
    const src = makeFloat32Image(32, 48, 4);
    const dst = await rotate(src, 270);

    expect(dst.data).toBeInstanceOf(Float32Array);
    expect(dst.data.length).toBe(48 * 32 * 4);
  });

  it('rotates float16', async () => {
    const src = makeFloat16Image(32, 48, 4);
    const dst = await rotate(src, 180);

    expect(dst.data).toBeInstanceOf(Float16Array);
    expect(dst.data.length).toBe(32 * 48 * 4);
  });
});

describe('rotate — descriptor', () => {
  it('resets EXIF orientation to 1 for 90°', async () => {
    const src = makeUint8Image(32, 32, 4);
    (src.descriptor.geometry as { orientation?: number }).orientation = 6; // 90° CW in EXIF
    const dst = await rotate(src, 90);
    expect(dst.descriptor.geometry.orientation).toBe(1);
  });

  it('preserves other descriptor fields', async () => {
    const src = makeFloat32Image(64, 64, 4);
    const dst = await rotate(src, 180);

    expect(dst.descriptor.channels.model).toBe(src.descriptor.channels.model);
    expect(dst.descriptor.numeric.dataType).toBe(src.descriptor.numeric.dataType);
  });
});
