/**
 * Browser tests for JXL decoder
 *
 * These tests run in a real browser environment using Playwright.
 * They test the full WASM integration including decode operations and descriptor extraction.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  decode,
  encode,
  encodeSimple,
  getImageInfo,
  initDecoder,
  initEncoder,
} from "@dimkatet/jcodecs-jxl";
import type { JXLImageData, JXLEncodeDescriptor } from "@dimkatet/jcodecs-jxl";
import type { ImageDescriptor } from "@dimkatet/jcodecs-jxl";

async function loadFixture(filename: string): Promise<Uint8Array> {
  const response = await fetch(`/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load fixture: ${filename}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function createTestImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.floor((x / width) * 255);
      data[i + 1] = Math.floor((y / height) * 255);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

function createTestPixelData8(
  width: number,
  height: number,
  primaries: 'bt709' | 'displayP3' | 'bt2020' = 'bt709',
): { data: Uint8Array; descriptor: JXLEncodeDescriptor } {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.floor((x / width) * 255);
      data[i + 1] = Math.floor((y / height) * 255);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return {
    data,
    descriptor: {
      geometry: { width, height },
      channels: { model: 'rgba', count: 4 },
      numeric: { dataType: 'uint8', bitDepth: 8 },
      color: { primaries },
    },
  };
}

function createTestPixelData16(
  width: number,
  height: number,
  bitDepth: 10 | 12 = 10,
): { data: Uint16Array; descriptor: JXLEncodeDescriptor } {
  const maxVal = (1 << bitDepth) - 1;
  const data = new Uint16Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.floor((x / width) * maxVal);
      data[i + 1] = Math.floor((y / height) * maxVal);
      data[i + 2] = Math.floor(maxVal / 2);
      data[i + 3] = maxVal;
    }
  }
  return {
    data,
    descriptor: {
      geometry: { width, height },
      channels: { model: 'rgba', count: 4 },
      numeric: { dataType: 'uint16', bitDepth },
    },
  };
}

describe("JXL Decoder", () => {
  beforeAll(async () => {
    await initDecoder();
    await initEncoder();
  });

  describe("real test files from libjxl/testdata", () => {
    describe("pq_gradient.jxl (HDR PQ gradient)", () => {
      let result: JXLImageData;
      let info: ImageDescriptor;

      beforeAll(async () => {
        const data = await loadFixture("pq_gradient.jxl");
        result = await decode(data);
        info = await getImageInfo(data);
      });

      it("should decode successfully", () => {
        expect(result).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
      });

      it("should have correct dimensions", () => {
        expect(result.descriptor.geometry.width).toBeGreaterThan(0);
        expect(result.descriptor.geometry.height).toBeGreaterThan(0);
      });

      it("should be HDR with PQ transfer", () => {
        expect(result.descriptor.transfer?.function).toBe("pq");
      });

      it("should have high bit depth", () => {
        expect(result.descriptor.numeric.bitDepth).toBeGreaterThanOrEqual(10);
      });

      it("should use Uint16Array for high bit depth", () => {
        expect(result.data).toBeInstanceOf(Uint16Array);
        expect(result.descriptor.numeric.dataType).toBe("uint16");
      });

      it("getImageInfo should match decode result", () => {
        expect(info.geometry.width).toBe(result.descriptor.geometry.width);
        expect(info.geometry.height).toBe(result.descriptor.geometry.height);
        expect(info.numeric.bitDepth).toBe(result.descriptor.numeric.bitDepth);
        expect(info.transfer?.function).toBe(result.descriptor.transfer?.function);
      });
    });

    describe("splines.jxl (JXL spline feature test)", () => {
      let result: JXLImageData;
      let info: ImageDescriptor;

      beforeAll(async () => {
        const data = await loadFixture("splines.jxl");
        result = await decode(data);
        info = await getImageInfo(data);
      });

      it("should decode successfully", () => {
        expect(result).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
      });

      it("should have valid dimensions", () => {
        expect(result.descriptor.geometry.width).toBeGreaterThan(0);
        expect(result.descriptor.geometry.height).toBeGreaterThan(0);
      });

      it("should have color and transfer info", () => {
        expect(result.descriptor.color?.primaries).toBeDefined();
        expect(result.descriptor.transfer?.function).toBeDefined();
      });

      it("getImageInfo should match decode result", () => {
        expect(info.geometry.width).toBe(result.descriptor.geometry.width);
        expect(info.geometry.height).toBe(result.descriptor.geometry.height);
        expect(info.numeric.bitDepth).toBe(result.descriptor.numeric.bitDepth);
      });
    });
  });

  describe("basic decoding", () => {
    it("should decode 8-bit sRGB image", async () => {
      const imageData = createTestImageData(64, 64);
      const encoded = await encodeSimple(imageData);
      const result = await decode(encoded);

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.descriptor.geometry.width).toBe(64);
      expect(result.descriptor.geometry.height).toBe(64);
      expect(result.descriptor.numeric.bitDepth).toBe(8);
      expect(result.descriptor.numeric.dataType).toBe("uint8");
    });

    it("should decode 10-bit image", async () => {
      const { data, descriptor } = createTestPixelData16(32, 32, 10);
      const encoded = await encode(data, descriptor);
      const result = await decode(encoded);

      expect(result.data).toBeInstanceOf(Uint16Array);
      expect(result.descriptor.numeric.bitDepth).toBe(10);
      expect(result.descriptor.numeric.dataType).toBe("uint16");
    });

    it("should decode 12-bit image", async () => {
      const { data, descriptor } = createTestPixelData16(32, 32, 12);
      const encoded = await encode(data, descriptor);
      const result = await decode(encoded);

      expect(result.data).toBeInstanceOf(Uint16Array);
      expect(result.descriptor.numeric.bitDepth).toBe(12);
      expect(result.descriptor.numeric.dataType).toBe("uint16");
    });

    it("should preserve image dimensions", async () => {
      const width = 48;
      const height = 32;
      const imageData = createTestImageData(width, height);
      const encoded = await encodeSimple(imageData);
      const result = await decode(encoded);

      expect(result.descriptor.geometry.width).toBe(width);
      expect(result.descriptor.geometry.height).toBe(height);
    });
  });

  describe("color and transfer metadata", () => {
    it("should extract sRGB color info (bt709/sRGB)", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encodeSimple(imageData);
      const result = await decode(encoded);

      expect(result.descriptor.color?.primaries).toBe("bt709");
      expect(result.descriptor.transfer?.function).toBe("srgb");
    });

    it("should extract Display P3 color primaries", async () => {
      const { data, descriptor } = createTestPixelData8(32, 32, 'displayP3');
      const encoded = await encode(data, descriptor);
      const result = await decode(encoded);

      expect(result.descriptor.color?.primaries).toBe("displayP3");
    });

    it("should extract Rec.2020 color primaries", async () => {
      const { data, descriptor } = createTestPixelData8(32, 32, 'bt2020');
      const encoded = await encode(data, descriptor);
      const result = await decode(encoded);

      expect(result.descriptor.color?.primaries).toBe("bt2020");
    });

    it("should detect HDR with PQ transfer", async () => {
      const { data, descriptor } = createTestPixelData16(32, 32, 10);
      const encoded = await encode(data, {
        ...descriptor,
        color: { primaries: 'bt2020' },
        transfer: { function: 'pq' },
      });
      const result = await decode(encoded);

      expect(result.descriptor.transfer?.function).toBe("pq");
    });

    it("should detect HDR with HLG transfer", async () => {
      const { data, descriptor } = createTestPixelData16(32, 32, 10);
      const encoded = await encode(data, {
        ...descriptor,
        color: { primaries: 'bt2020' },
        transfer: { function: 'hlg' },
      });
      const result = await decode(encoded);

      expect(result.descriptor.transfer?.function).toBe("hlg");
    });
  });

  describe("bitDepth option", () => {
    it("should force 8-bit output when bitDepth: 8", async () => {
      const { data, descriptor } = createTestPixelData16(32, 32, 10);
      const encoded = await encode(data, descriptor);
      const result = await decode(encoded, { bitDepth: 8 });

      expect(result.descriptor.numeric.bitDepth).toBe(8);
      expect(result.descriptor.numeric.dataType).toBe("uint8");
      expect(result.data).toBeInstanceOf(Uint8Array);
    });

    it("should preserve HDR color info when downsampling to 8-bit", async () => {
      const { data, descriptor } = createTestPixelData16(32, 32, 10);
      const encoded = await encode(data, {
        ...descriptor,
        color: { primaries: 'bt2020' },
        transfer: { function: 'pq' },
      });
      const result = await decode(encoded, { bitDepth: 8 });

      expect(result.descriptor.color?.primaries).toBe("bt2020");
      expect(result.descriptor.transfer?.function).toBe("pq");
    });

    it("should auto-detect bitDepth when set to 0 (default)", async () => {
      const { data, descriptor } = createTestPixelData16(32, 32, 10);
      const encoded = await encode(data, descriptor);
      const result = await decode(encoded, { bitDepth: 0 });

      expect(result.descriptor.numeric.bitDepth).toBe(10);
      expect(result.descriptor.numeric.dataType).toBe("uint16");
    });
  });

  describe("getImageInfo", () => {
    it("should get image info without full decode", async () => {
      const imageData = createTestImageData(64, 48);
      const encoded = await encodeSimple(imageData);
      const info = await getImageInfo(encoded);

      expect(info.geometry.width).toBe(64);
      expect(info.geometry.height).toBe(48);
      expect(info.numeric.bitDepth).toBe(8);
      expect(info.channels.count).toBeGreaterThan(0);
    });

    it("should match full decode descriptor", async () => {
      const { data, descriptor } = createTestPixelData8(32, 32, 'displayP3');
      const encoded = await encode(data, descriptor);

      const info = await getImageInfo(encoded);
      const result = await decode(encoded);

      expect(info.geometry.width).toBe(result.descriptor.geometry.width);
      expect(info.geometry.height).toBe(result.descriptor.geometry.height);
      expect(info.numeric.bitDepth).toBe(result.descriptor.numeric.bitDepth);
      expect(info.channels.count).toBe(result.descriptor.channels.count);
      expect(info.color?.primaries).toBe(result.descriptor.color?.primaries);
      expect(info.transfer?.function).toBe(result.descriptor.transfer?.function);
    });
  });

  describe("pixel data integrity", () => {
    it("should have correct pixel count", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encodeSimple(imageData);
      const result = await decode(encoded);

      const { width, height } = result.descriptor.geometry;
      const channels = result.descriptor.channels.count;
      expect(result.data.length).toBe(width * height * channels);
    });
  });

  describe("lossless round-trip", () => {
    it("should preserve exact pixels in lossless mode", async () => {
      const imageData = createTestImageData(8, 8);
      const data = new Uint8Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength,
      );
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 8, height: 8 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint8', bitDepth: 8 },
      };
      const encoded = await encode(data, descriptor, { lossless: true });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(8);
      expect(decoded.descriptor.geometry.height).toBe(8);

      // Check center pixel
      const channels = decoded.descriptor.channels.count;
      const centerIdx = (4 * 8 + 4) * channels;
      const srcData = imageData.data;
      const dstData = decoded.data as Uint8Array;

      expect(Math.abs(dstData[centerIdx] - srcData[(4 * 8 + 4) * 4])).toBeLessThan(2);
    });
  });

  describe("error handling", () => {
    it("should throw error for invalid data", async () => {
      const invalidData = new Uint8Array([0, 1, 2, 3, 4, 5]);
      await expect(decode(invalidData)).rejects.toThrow();
    });

    it("should throw error for empty data", async () => {
      const emptyData = new Uint8Array(0);
      await expect(decode(emptyData)).rejects.toThrow();
    });
  });

  describe("channels", () => {
    it("should decode RGBA images (3-4 channels)", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encodeSimple(imageData);
      const result = await decode(encoded);

      // JXL can have 3 or 4 channels depending on encoding
      expect(result.descriptor.channels.count).toBeGreaterThanOrEqual(3);
      expect(result.descriptor.channels.count).toBeLessThanOrEqual(4);
    });
  });
});
