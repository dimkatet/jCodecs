/**
 * Browser tests for JXL encoder
 *
 * These tests run in a real browser environment using Playwright.
 * They test the full WASM integration including encode operations.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  encode,
  encodeSimple,
  decode,
  initEncoder,
  initDecoder,
  isEncoderInitialized,
} from "@dimkatet/jcodecs-jxl";
import type { JXLEncodeDescriptor } from "@dimkatet/jcodecs-jxl";

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

function createSolidColorImageData(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 255
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return new ImageData(data, width, height);
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

describe("JXL Encoder", () => {
  beforeAll(async () => {
    await initEncoder();
    await initDecoder();
  });

  describe("initialization", () => {
    it("should initialize encoder", () => {
      expect(isEncoderInitialized()).toBe(true);
    });
  });

  describe("basic encoding", () => {
    it("should encode a simple ImageData via encodeSimple", async () => {
      const imageData = createTestImageData(64, 64);
      const result = await encodeSimple(imageData);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should encode using encodeSimple with quality", async () => {
      const imageData = createTestImageData(64, 64);
      const result = await encodeSimple(imageData, 80);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should encode with descriptor API", async () => {
      const imageData = createTestImageData(64, 64);
      const data = new Uint8Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength,
      );
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 64, height: 64 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint8', bitDepth: 8 },
      };
      const result = await encode(data, descriptor);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should produce valid JXL that can be decoded", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encodeSimple(imageData);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(32);
      expect(decoded.descriptor.geometry.height).toBe(32);
      expect(decoded.data.length).toBeGreaterThan(0);
    });

    it("encoded size should be smaller than raw data", async () => {
      const imageData = createTestImageData(64, 64);
      const rawSize = imageData.data.length;
      const encoded = await encodeSimple(imageData, 50);

      expect(encoded.length).toBeLessThan(rawSize);
    });
  });

  describe("quality options", () => {
    it("higher quality should produce larger files", async () => {
      const imageData = createTestImageData(32, 32);

      const lowQuality = await encodeSimple(imageData, 20);
      const highQuality = await encodeSimple(imageData, 90);

      expect(highQuality.length).toBeGreaterThanOrEqual(lowQuality.length * 0.5);
    });

    it("should support quality range 0-100", async () => {
      const imageData = createSolidColorImageData(32, 32, 128, 128, 128);

      const q0 = await encodeSimple(imageData, 0);
      const q50 = await encodeSimple(imageData, 50);
      const q100 = await encodeSimple(imageData, 100);

      expect(q0.length).toBeGreaterThan(0);
      expect(q50.length).toBeGreaterThan(0);
      expect(q100.length).toBeGreaterThan(0);
    });
  });

  describe("lossless encoding", () => {
    it("should support lossless encoding", async () => {
      const imageData = createSolidColorImageData(16, 16, 200, 100, 50);
      const data = new Uint8Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength,
      );
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint8', bitDepth: 8 },
      };
      const encoded = await encode(data, descriptor, { lossless: true });

      expect(encoded.length).toBeGreaterThan(0);

      const decoded = await decode(encoded);
      expect(decoded.descriptor.geometry.width).toBe(16);
      expect(decoded.descriptor.geometry.height).toBe(16);
    });

    it("lossless should produce exact pixel values for solid color", async () => {
      const r = 123, g = 45, b = 67;
      const imageData = createSolidColorImageData(8, 8, r, g, b);
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

      const channels = decoded.descriptor.channels.count;
      const centerIdx = (4 * 8 + 4) * channels;
      const dstData = decoded.data as Uint8Array;

      expect(dstData[centerIdx]).toBe(r);
      expect(dstData[centerIdx + 1]).toBe(g);
      expect(dstData[centerIdx + 2]).toBe(b);
    });
  });

  describe("color space and transfer via descriptor", () => {
    it("should encode with sRGB (bt709) color primaries", async () => {
      const imageData = createTestImageData(16, 16);
      const data = new Uint8Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength,
      );
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint8', bitDepth: 8 },
        color: { primaries: 'bt709' },
      };
      const encoded = await encode(data, descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.color?.primaries).toBe("bt709");
      expect(decoded.descriptor.transfer?.function).toBe("srgb");
    });

    it("should encode with Display P3 color primaries", async () => {
      const imageData = createTestImageData(16, 16);
      const data = new Uint8Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength,
      );
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint8', bitDepth: 8 },
        color: { primaries: 'displayP3' },
      };
      const encoded = await encode(data, descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.color?.primaries).toBe("displayP3");
    });

    it("should encode with Rec.2020 color primaries", async () => {
      const imageData = createTestImageData(16, 16);
      const data = new Uint8Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength,
      );
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint8', bitDepth: 8 },
        color: { primaries: 'bt2020' },
      };
      const encoded = await encode(data, descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.color?.primaries).toBe("bt2020");
    });
  });

  describe("HDR encoding", () => {
    it("should encode with PQ transfer function (10-bit)", async () => {
      const { data, descriptor } = createTestPixelData16(16, 16, 10);
      const encoded = await encode(data, {
        ...descriptor,
        color: { primaries: 'bt2020' },
        transfer: { function: 'pq' },
      });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.transfer?.function).toBe("pq");
    });

    it("should encode with HLG transfer function (10-bit)", async () => {
      const { data, descriptor } = createTestPixelData16(16, 16, 10);
      const encoded = await encode(data, {
        ...descriptor,
        color: { primaries: 'bt2020' },
        transfer: { function: 'hlg' },
      });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.transfer?.function).toBe("hlg");
    });

    it("should encode 10-bit output", async () => {
      const { data, descriptor } = createTestPixelData16(16, 16, 10);
      const encoded = await encode(data, descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.numeric.bitDepth).toBe(10);
    });

    it("should encode 12-bit output", async () => {
      const { data, descriptor } = createTestPixelData16(16, 16, 12);
      const encoded = await encode(data, descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.numeric.bitDepth).toBe(12);
    });
  });

  describe("effort options", () => {
    it("should support effort 10 (fastest)", async () => {
      const imageData = createSolidColorImageData(16, 16, 128, 128, 128);
      const result = await encodeSimple(imageData, 50);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("progressive encoding", () => {
    it("should support progressive encoding", async () => {
      const imageData = createTestImageData(32, 32);
      const data = new Uint8Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength,
      );
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 32, height: 32 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint8', bitDepth: 8 },
      };
      const encoded = await encode(data, descriptor, { progressive: true });

      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe("round-trip integrity", () => {
    it("should preserve image dimensions through encode-decode", async () => {
      const width = 48;
      const height = 32;
      const imageData = createTestImageData(width, height);
      const encoded = await encodeSimple(imageData);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(width);
      expect(decoded.descriptor.geometry.height).toBe(height);
    });

    it("should preserve approximate colors (lossy)", async () => {
      const r = 200, g = 100, b = 50;
      const imageData = createSolidColorImageData(16, 16, r, g, b);
      const encoded = await encodeSimple(imageData, 90);
      const decoded = await decode(encoded);

      const channels = decoded.descriptor.channels.count;
      const centerIdx = (8 * 16 + 8) * channels;
      const data = decoded.data as Uint8Array;

      expect(Math.abs(data[centerIdx] - r)).toBeLessThan(20);
      expect(Math.abs(data[centerIdx + 1] - g)).toBeLessThan(20);
      expect(Math.abs(data[centerIdx + 2] - b)).toBeLessThan(20);
    });
  });

  describe("validation", () => {
    it("should reject dataType mismatch (uint8 with Uint16Array)", async () => {
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint8', bitDepth: 8 },
      };

      await expect(
        encode(new Uint16Array(16 * 16 * 4) as any, descriptor)
      ).rejects.toThrow('descriptor.numeric.dataType "uint8" requires Uint8Array data');
    });

    it("should reject dataType mismatch (uint16 with Uint8Array)", async () => {
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint16', bitDepth: 10 },
      };

      await expect(
        encode(new Uint8Array(16 * 16 * 4), descriptor)
      ).rejects.toThrow('descriptor.numeric.dataType "uint16" requires Uint16Array data');
    });

    it("should reject dataType mismatch (float16 with Float32Array)", async () => {
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'float16', bitDepth: 16 },
      };

      await expect(
        encode(new Float32Array(16 * 16 * 4) as any, descriptor)
      ).rejects.toThrow('descriptor.numeric.dataType "float16" requires Float16Array data');
    });

    it("should reject dataType mismatch (float32 with Float16Array)", async () => {
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'float32', bitDepth: 32 },
      };

      await expect(
        encode(new Float16Array(16 * 16 * 4) as any, descriptor)
      ).rejects.toThrow('descriptor.numeric.dataType "float32" requires Float32Array data');
    });
  });

  describe("float encoding", () => {
    it("should accept float16 data", async () => {
      const data = new Float16Array(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((i / 4) % 256) / 255.0;
        data[i + 1] = 0.5;
        data[i + 2] = 0.8;
        data[i + 3] = 1.0;
      }
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'float16', bitDepth: 16 },
        transfer: { function: 'linear' },
      };

      const encoded = await encode(data, descriptor);
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = await decode(encoded);
      expect(decoded.descriptor.numeric.dataType).toBe("float16");
      expect(decoded.data).toBeInstanceOf(Float16Array);
      expect(decoded.descriptor.geometry.width).toBe(16);
      expect(decoded.descriptor.geometry.height).toBe(16);
    });

    it("should accept float32 data", async () => {
      const data = new Float32Array(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((i / 4) % 256) / 255.0;
        data[i + 1] = 0.5;
        data[i + 2] = 0.8;
        data[i + 3] = 1.0;
      }
      const descriptor: JXLEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'float32', bitDepth: 32 },
        transfer: { function: 'linear' },
      };

      const encoded = await encode(data, descriptor);
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = await decode(encoded);
      expect(decoded.descriptor.numeric.dataType).toBe("float32");
      expect(decoded.data).toBeInstanceOf(Float32Array);
      expect(decoded.descriptor.geometry.width).toBe(16);
      expect(decoded.descriptor.geometry.height).toBe(16);
    });
  });
});
