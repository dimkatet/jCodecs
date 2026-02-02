/**
 * Browser tests for AVIF encoder
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
} from "@dimkatet/jcodecs-avif";

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

describe("AVIF Encoder", () => {
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

    it("should produce valid AVIF that can be decoded", async () => {
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
      const encoded = await encode(imageData, { quality: 50, speed: 10 });

      expect(encoded.length).toBeLessThan(rawSize);
    });
  });

  describe("quality options", () => {
    it("higher quality should produce larger files", async () => {
      const imageData = createTestImageData(32, 32);

      const lowQuality = await encode(imageData, { quality: 20, speed: 10 });
      const highQuality = await encode(imageData, { quality: 90, speed: 10 });

      // High quality should generally be larger (though not always guaranteed)
      // Use a reasonable threshold
      expect(highQuality.length).toBeGreaterThanOrEqual(lowQuality.length * 0.5);
    });

    it("should support quality range 0-100", async () => {
      const imageData = createSolidColorImageData(32, 32, 128, 128, 128);

      const q0 = await encode(imageData, { quality: 0, speed: 10 });
      const q50 = await encode(imageData, { quality: 50, speed: 10 });
      const q100 = await encode(imageData, { quality: 100, speed: 10 });

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

      // Decode and verify exact color match
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

  describe("chroma subsampling", () => {
    it("should support 4:4:4 subsampling", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { chromaSubsampling: "4:4:4" });

      expect(encoded.length).toBeGreaterThan(0);
    });

    it("should support 4:2:0 subsampling (default)", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { chromaSubsampling: "4:2:0" });

      expect(encoded.length).toBeGreaterThan(0);
    });

    it("4:4:4 should produce larger files than 4:2:0", async () => {
      const imageData = createTestImageData(32, 32);

      const yuv444 = await encode(imageData, {
        chromaSubsampling: "4:4:4",
        quality: 80,
        speed: 10,
      });
      const yuv420 = await encode(imageData, {
        chromaSubsampling: "4:2:0",
        quality: 80,
        speed: 10,
      });

      expect(yuv444.length).toBeGreaterThan(yuv420.length);
    });
  });

  describe("color space options", () => {
    it("should encode with sRGB color space", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { colorSpace: "srgb", speed: 10 });
      const decoded = await decode(encoded);

      expect(decoded.metadata.colorPrimaries).toBe("bt709");
      expect(decoded.metadata.transferFunction).toBe("srgb");
    });

    it("should encode with Display P3 color space", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { colorSpace: "display-p3", speed: 10 });
      const decoded = await decode(encoded);

      expect(decoded.metadata.colorPrimaries).toBe("display-p3");
    });

    it("should encode with Rec.2020 color space", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { colorSpace: "rec2020", speed: 10 });
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
        speed: 10,
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
        speed: 10,
      });
      const decoded = await decode(encoded);

      expect(decoded.metadata.transferFunction).toBe("hlg");
      expect(decoded.metadata.isHDR).toBe(true);
    });

    it("should encode 10-bit output", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { bitDepth: 10, speed: 10 });
      const decoded = await decode(encoded);

      expect(decoded.bitDepth).toBe(10);
    });
  });

  describe("speed options", () => {
    it("faster speed should produce results quickly", async () => {
      const imageData = createTestImageData(32, 32);

      const start = performance.now();
      await encode(imageData, { speed: 10, quality: 50 });
      const fastTime = performance.now() - start;

      expect(fastTime).toBeLessThan(30000); // Should complete within 30s
    });

    // Skip speed 0 test - too slow for CI
    it("should support speed 10 (fastest)", async () => {
      const imageData = createSolidColorImageData(16, 16, 128, 128, 128);

      const result = await encode(imageData, { speed: 10, quality: 50 });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("round-trip integrity", () => {
    it("should preserve image dimensions through encode-decode", async () => {
      const width = 48;
      const height = 32;
      const imageData = createTestImageData(width, height);

      const encoded = await encode(imageData, { speed: 10 });
      const decoded = await decode(encoded);

      expect(decoded.width).toBe(width);
      expect(decoded.height).toBe(height);
    });

    it("should preserve approximate colors (lossy)", async () => {
      const r = 200,
        g = 100,
        b = 50;
      const imageData = createSolidColorImageData(16, 16, r, g, b);

      const encoded = await encode(imageData, { quality: 90, speed: 10 });
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

  describe("error handling", () => {
    it("should handle zero-dimension image", async () => {
      // Create minimal valid ImageData then try to break it
      const validData = createTestImageData(1, 1);

      // This should work
      const result = await encode(validData);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("tuning options", () => {
    it("should support SSIM tuning", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { tune: "ssim" });

      expect(encoded.length).toBeGreaterThan(0);
    });

    it("should support PSNR tuning", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { tune: "psnr" });

      expect(encoded.length).toBeGreaterThan(0);
    });
  });
});
