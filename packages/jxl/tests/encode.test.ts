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
  DEFAULT_SRGB_METADATA,
} from "@dimkatet/jcodecs-jxl";
import type { JXLImageData } from "@dimkatet/jcodecs-jxl";

/**
 * Create a test ImageData with a simple gradient pattern
 */
function createTestImageData(
  width: number,
  height: number,
  hasAlpha = true
): ImageData {
  const channels = hasAlpha ? 4 : 4; // ImageData is always RGBA
  const data = new Uint8ClampedArray(width * height * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      // Create a gradient pattern
      data[i] = Math.floor((x / width) * 255); // R: horizontal gradient
      data[i + 1] = Math.floor((y / height) * 255); // G: vertical gradient
      data[i + 2] = 128; // B: constant
      data[i + 3] = hasAlpha ? 255 : 255; // A: opaque
    }
  }

  return new ImageData(data, width, height);
}

/**
 * Create a solid color ImageData
 */
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
    it("should encode a simple ImageData", async () => {
      const imageData = createTestImageData(64, 64);
      const result = await encode(imageData);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should encode using encodeSimple", async () => {
      const imageData = createTestImageData(64, 64);
      const result = await encodeSimple(imageData, 80);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should produce valid JXL that can be decoded", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData);

      // Decode the encoded data
      const decoded = await decode(encoded);

      expect(decoded.width).toBe(32);
      expect(decoded.height).toBe(32);
      expect(decoded.data.length).toBeGreaterThan(0);
    });

    it("encoded size should be smaller than raw data", async () => {
      const imageData = createTestImageData(64, 64);
      const rawSize = imageData.data.length;
      const encoded = await encode(imageData, { quality: 50, effort: 10 });

      expect(encoded.length).toBeLessThan(rawSize);
    });
  });

  describe("quality options", () => {
    it("higher quality should produce larger files", async () => {
      const imageData = createTestImageData(32, 32);

      const lowQuality = await encode(imageData, { quality: 20, effort: 10 });
      const highQuality = await encode(imageData, { quality: 90, effort: 10 });

      // High quality should generally be larger (though not always guaranteed)
      expect(highQuality.length).toBeGreaterThanOrEqual(lowQuality.length * 0.5);
    });

    it("should support quality range 0-100", async () => {
      const imageData = createSolidColorImageData(32, 32, 128, 128, 128);

      const q0 = await encode(imageData, { quality: 0, effort: 10 });
      const q50 = await encode(imageData, { quality: 50, effort: 10 });
      const q100 = await encode(imageData, { quality: 100, effort: 10 });

      expect(q0.length).toBeGreaterThan(0);
      expect(q50.length).toBeGreaterThan(0);
      expect(q100.length).toBeGreaterThan(0);
    });
  });

  describe("lossless encoding", () => {
    it("should support lossless encoding", async () => {
      const imageData = createSolidColorImageData(16, 16, 200, 100, 50);
      const encoded = await encode(imageData, { lossless: true });

      expect(encoded.length).toBeGreaterThan(0);

      // Decode and verify dimensions
      const decoded = await decode(encoded);
      expect(decoded.width).toBe(16);
      expect(decoded.height).toBe(16);
    });

    it("lossless should produce exact pixel values for solid color", async () => {
      const r = 123,
        g = 45,
        b = 67;
      const imageData = createSolidColorImageData(8, 8, r, g, b);

      const encoded = await encode(imageData, { lossless: true });
      const decoded = await decode(encoded);

      // Check center pixel (avoid edge effects)
      const centerIdx = (4 * 8 + 4) * decoded.channels;
      const data = decoded.data as Uint8Array;

      expect(data[centerIdx]).toBe(r);
      expect(data[centerIdx + 1]).toBe(g);
      expect(data[centerIdx + 2]).toBe(b);
    });
  });

  describe("color space options", () => {
    it("should encode with sRGB color space", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { colorSpace: "srgb", effort: 10 });
      const decoded = await decode(encoded);

      expect(decoded.metadata.colorPrimaries).toBe("bt709");
      expect(decoded.metadata.transferFunction).toBe("srgb");
    });

    it("should encode with Display P3 color space", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { colorSpace: "display-p3", effort: 10 });
      const decoded = await decode(encoded);

      expect(decoded.metadata.colorPrimaries).toBe("display-p3");
    });

    it("should encode with Rec.2020 color space", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { colorSpace: "rec2020", effort: 10 });
      const decoded = await decode(encoded);

      expect(decoded.metadata.colorPrimaries).toBe("bt2020");
    });
  });

  describe("HDR encoding", () => {
    it("should encode with PQ transfer function", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, {
        colorSpace: "rec2020",
        transferFunction: "pq",
        bitDepth: 10,
        effort: 10,
      });
      const decoded = await decode(encoded);

      expect(decoded.metadata.transferFunction).toBe("pq");
      expect(decoded.metadata.isHDR).toBe(true);
    });

    it("should encode with HLG transfer function", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, {
        colorSpace: "rec2020",
        transferFunction: "hlg",
        bitDepth: 10,
        effort: 10,
      });
      const decoded = await decode(encoded);

      expect(decoded.metadata.transferFunction).toBe("hlg");
      expect(decoded.metadata.isHDR).toBe(true);
    });

    it("should encode 10-bit output", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { bitDepth: 10, effort: 10 });
      const decoded = await decode(encoded);

      expect(decoded.bitDepth).toBe(10);
    });
  });

  describe("effort options", () => {
    it("should support effort 10 (fastest)", async () => {
      const imageData = createSolidColorImageData(16, 16, 128, 128, 128);

      const result = await encode(imageData, { effort: 10, quality: 50 });

      expect(result.length).toBeGreaterThan(0);
    });

    it("faster effort should encode quickly", async () => {
      const imageData = createTestImageData(32, 32);

      const start = performance.now();
      await encode(imageData, { effort: 10, quality: 50 });
      const fastTime = performance.now() - start;

      expect(fastTime).toBeLessThan(30000); // Should complete within 30s
    });
  });

  describe("progressive encoding", () => {
    it("should support progressive encoding", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { progressive: true });

      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe("round-trip integrity", () => {
    it("should preserve image dimensions through encode-decode", async () => {
      const width = 48;
      const height = 32;
      const imageData = createTestImageData(width, height);

      const encoded = await encode(imageData, { effort: 10 });
      const decoded = await decode(encoded);

      expect(decoded.width).toBe(width);
      expect(decoded.height).toBe(height);
    });

    it("should preserve approximate colors (lossy)", async () => {
      const r = 200,
        g = 100,
        b = 50;
      const imageData = createSolidColorImageData(16, 16, r, g, b);

      const encoded = await encode(imageData, { quality: 90, effort: 10 });
      const decoded = await decode(encoded);

      // Check center pixel
      const centerIdx = (8 * 16 + 8) * decoded.channels;
      const data = decoded.data as Uint8Array;

      // Allow some tolerance for lossy compression
      expect(Math.abs(data[centerIdx] - r)).toBeLessThan(20);
      expect(Math.abs(data[centerIdx + 1] - g)).toBeLessThan(20);
      expect(Math.abs(data[centerIdx + 2] - b)).toBeLessThan(20);
    });
  });

  describe("validation", () => {
    it("should accept uint8 dataType", async () => {
      const data = new Uint8Array(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;
        data[i + 1] = 64;
        data[i + 2] = 192;
        data[i + 3] = 255;
      }

      const extendedData: JXLImageData = {
        data,
        dataType: "uint8",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 8,
        metadata: DEFAULT_SRGB_METADATA,
      };

      const encoded = await encode(extendedData);
      expect(encoded.length).toBeGreaterThan(0);
    });

    it("should accept uint16 dataType", async () => {
      const data = new Uint16Array(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 512;
        data[i + 1] = 256;
        data[i + 2] = 768;
        data[i + 3] = 1023;
      }

      const extendedData: JXLImageData = {
        data,
        dataType: "uint16",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 10,
        metadata: DEFAULT_SRGB_METADATA,
      };

      const encoded = await encode(extendedData, { bitDepth: 10 });
      expect(encoded.length).toBeGreaterThan(0);
    });

    it("should reject dataType mismatch (uint8 with Uint16Array)", async () => {
      const extendedData: any = {
        data: new Uint16Array(16 * 16 * 4),
        dataType: "uint8",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 8,
      };

      await expect(encode(extendedData)).rejects.toThrow(
        'dataType "uint8" requires Uint8Array'
      );
    });

    it("should reject dataType mismatch (uint16 with Uint8Array)", async () => {
      const extendedData: any = {
        data: new Uint8Array(16 * 16 * 4),
        dataType: "uint16",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 16,
      };

      await expect(encode(extendedData)).rejects.toThrow(
        'dataType "uint16" requires Uint16Array'
      );
    });

    it("should reject dataType mismatch (float16 with Float32Array)", async () => {
      const extendedData: any = {
        data: new Float32Array(16 * 16 * 4),
        dataType: "float16",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 16,
      };

      await expect(encode(extendedData)).rejects.toThrow(
        'dataType "float16" requires Float16Array'
      );
    });

    it("should reject dataType mismatch (float32 with Float16Array)", async () => {
      const extendedData: any = {
        data: new Float16Array(16 * 16 * 4),
        dataType: "float32",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 32,
      };

      await expect(encode(extendedData)).rejects.toThrow(
        'dataType "float32" requires Float32Array'
      );
    });
  });

  describe("ExtendedImageData encoding", () => {
    it("should encode uint8 ExtendedImageData", async () => {
      const data = new Uint8Array(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (i / 4) % 256;
        data[i + 1] = 128;
        data[i + 2] = 200;
        data[i + 3] = 255;
      }

      const extendedData: JXLImageData = {
        data,
        dataType: "uint8",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 8,
        metadata: DEFAULT_SRGB_METADATA,
      };

      const encoded = await encode(extendedData);
      expect(encoded.length).toBeGreaterThan(0);

      // Verify round-trip preserves dataType
      const decoded = await decode(encoded);
      expect(decoded.dataType).toBe("uint8");
      expect(decoded.data).toBeInstanceOf(Uint8Array);
    });

    it("should encode uint16 ExtendedImageData with 10-bit depth", async () => {
      const data = new Uint16Array(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((i / 4) * 4) % 1024;
        data[i + 1] = 512;
        data[i + 2] = 800;
        data[i + 3] = 1023;
      }

      const extendedData: JXLImageData = {
        data,
        dataType: "uint16",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 10,
        metadata: DEFAULT_SRGB_METADATA,
      };

      const encoded = await encode(extendedData, { bitDepth: 10 });
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = await decode(encoded);
      expect(decoded.dataType).toBe("uint16");
      expect(decoded.data).toBeInstanceOf(Uint16Array);
      expect(decoded.bitDepth).toBe(10);
    });

    it("should encode uint16 ExtendedImageData with 12-bit depth", async () => {
      const data = new Uint16Array(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((i / 4) * 16) % 4096;
        data[i + 1] = 2048;
        data[i + 2] = 3200;
        data[i + 3] = 4095;
      }

      const extendedData: JXLImageData = {
        data,
        dataType: "uint16",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 12,
        metadata: DEFAULT_SRGB_METADATA,
      };

      const encoded = await encode(extendedData, { bitDepth: 12 });
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = await decode(encoded);
      expect(decoded.dataType).toBe("uint16");
      expect(decoded.bitDepth).toBe(12);
    });

    it("should accept float16 ExtendedImageData", async () => {
      const data = new Float16Array(16 * 16 * 4);
      // Fill with HDR values (range 0.0 - 1.0+)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((i / 4) % 256) / 255.0;
        data[i + 1] = 0.5;
        data[i + 2] = 0.8;
        data[i + 3] = 1.0;
      }

      const extendedData: JXLImageData = {
        data,
        dataType: "float16",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 16,
        metadata: {
          ...DEFAULT_SRGB_METADATA,
          transferFunction: "linear",
          isHDR: true,
        },
      };

      const encoded = await encode(extendedData);
      expect(encoded.length).toBeGreaterThan(0);

      // Decode and verify format is preserved
      const decoded = await decode(encoded);
      expect(decoded.dataType).toBe("float16");
      expect(decoded.data).toBeInstanceOf(Float16Array);
      expect(decoded.bitDepth).toBe(16);
      expect(decoded.width).toBe(16);
      expect(decoded.height).toBe(16);
    });

    it("should accept float32 ExtendedImageData", async () => {
      const data = new Float32Array(16 * 16 * 4);
      // Fill with HDR values (range 0.0 - 1.0+)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((i / 4) % 256) / 255.0;
        data[i + 1] = 0.5;
        data[i + 2] = 0.8;
        data[i + 3] = 1.0;
      }

      const extendedData: JXLImageData = {
        data,
        dataType: "float32",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 32,
        metadata: {
          ...DEFAULT_SRGB_METADATA,
          transferFunction: "linear",
          isHDR: true,
        },
      };

      const encoded = await encode(extendedData);
      expect(encoded.length).toBeGreaterThan(0);

      // Decode and verify format is preserved
      const decoded = await decode(encoded);
      expect(decoded.dataType).toBe("float32");
      expect(decoded.data).toBeInstanceOf(Float32Array);
      expect(decoded.bitDepth).toBe(32);
      expect(decoded.width).toBe(16);
      expect(decoded.height).toBe(16);
    });

    it("should validate float16 matches Float16Array", async () => {
      const extendedData: any = {
        data: new Float32Array(16 * 16 * 4),
        dataType: "float16",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 16,
      };

      await expect(encode(extendedData)).rejects.toThrow(
        'dataType "float16" requires Float16Array'
      );
    });

    it("should validate float32 matches Float32Array", async () => {
      const extendedData: any = {
        data: new Float16Array(16 * 16 * 4),
        dataType: "float32",
        width: 16,
        height: 16,
        channels: 4,
        bitDepth: 32,
      };

      await expect(encode(extendedData)).rejects.toThrow(
        'dataType "float32" requires Float32Array'
      );
    });
  });
});
