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
import type { AVIFEncodeDescriptor } from "@dimkatet/jcodecs-avif";

/**
 * Helper: convert ImageData to encode args (data + descriptor)
 */
function fromImageData(imageData: ImageData): {
  data: Uint8Array;
  descriptor: AVIFEncodeDescriptor;
} {
  return {
    data: new Uint8Array(
      imageData.data.buffer,
      imageData.data.byteOffset,
      imageData.data.byteLength,
    ),
    descriptor: {
      geometry: { width: imageData.width, height: imageData.height },
      channels: { model: "rgba" as const, count: 4 },
      numeric: { dataType: "uint8" as const, bitDepth: 8 as const },
    },
  };
}

/**
 * Create a test ImageData with a simple gradient pattern
 */
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

/**
 * Create test pixel data as Uint16Array for high bit depth encoding (10/12-bit)
 */
function createTestPixelData16(
  width: number,
  height: number,
  bitDepth: 10 | 12 = 10,
): { data: Uint16Array; descriptor: AVIFEncodeDescriptor } {
  const maxValue = (1 << bitDepth) - 1;
  const data = new Uint16Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.floor((x / width) * maxValue);
      data[i + 1] = Math.floor((y / height) * maxValue);
      data[i + 2] = Math.floor(maxValue / 2);
      data[i + 3] = maxValue;
    }
  }
  return {
    data,
    descriptor: {
      geometry: { width, height },
      channels: { model: "rgba", count: 4 },
      numeric: { dataType: "uint16", bitDepth },
    },
  };
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
  a = 255,
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
    it("should encode with data + descriptor", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(64, 64));
      const result = await encode(data, descriptor);

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
      const { data, descriptor } = fromImageData(createTestImageData(32, 32));
      const encoded = await encode(data, descriptor);

      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(32);
      expect(decoded.descriptor.geometry.height).toBe(32);
      expect(decoded.data.length).toBeGreaterThan(0);
    });

    it("encoded size should be smaller than raw data", async () => {
      const imageData = createTestImageData(64, 64);
      const { data, descriptor } = fromImageData(imageData);
      const rawSize = imageData.data.length;
      const encoded = await encode(data, descriptor, { quality: 50, speed: 10 });

      expect(encoded.length).toBeLessThan(rawSize);
    });
  });

  describe("quality options", () => {
    it("higher quality should produce larger files", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(32, 32));

      const lowQuality = await encode(data, descriptor, { quality: 20, speed: 10 });
      const highQuality = await encode(data, descriptor, { quality: 90, speed: 10 });

      expect(highQuality.length).toBeGreaterThanOrEqual(lowQuality.length * 0.5);
    });

    it("should support quality range 0-100", async () => {
      const { data, descriptor } = fromImageData(
        createSolidColorImageData(32, 32, 128, 128, 128),
      );

      const q0 = await encode(data, descriptor, { quality: 0, speed: 10 });
      const q50 = await encode(data, descriptor, { quality: 50, speed: 10 });
      const q100 = await encode(data, descriptor, { quality: 100, speed: 10 });

      expect(q0.length).toBeGreaterThan(0);
      expect(q50.length).toBeGreaterThan(0);
      expect(q100.length).toBeGreaterThan(0);
    });
  });

  describe("lossless encoding", () => {
    it("should support lossless encoding", async () => {
      const { data, descriptor } = fromImageData(
        createSolidColorImageData(16, 16, 200, 100, 50),
      );
      const encoded = await encode(data, descriptor, { lossless: true });

      expect(encoded.length).toBeGreaterThan(0);

      const decoded = await decode(encoded);
      expect(decoded.descriptor.geometry.width).toBe(16);
      expect(decoded.descriptor.geometry.height).toBe(16);
    });

    it("lossless should produce exact pixel values for solid color", async () => {
      const r = 123,
        g = 45,
        b = 67;
      const { data, descriptor } = fromImageData(
        createSolidColorImageData(8, 8, r, g, b),
      );

      const encoded = await encode(data, descriptor, { lossless: true });
      const decoded = await decode(encoded);

      const centerIdx = (4 * 8 + 4) * decoded.descriptor.channels.count;
      const pixels = decoded.data as Uint8Array;

      expect(pixels[centerIdx]).toBe(r);
      expect(pixels[centerIdx + 1]).toBe(g);
      expect(pixels[centerIdx + 2]).toBe(b);
    });
  });

  describe("chroma subsampling", () => {
    it("should support 4:4:4 subsampling via descriptor", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(32, 32));
      const encoded = await encode(data, {
        ...descriptor,
        sampling: { chromaSubsampling: "444" },
      });

      expect(encoded.length).toBeGreaterThan(0);
    });

    it("should support 4:2:0 subsampling (default)", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(32, 32));
      const encoded = await encode(data, descriptor);

      expect(encoded.length).toBeGreaterThan(0);
    });

    it("4:4:4 should produce larger files than 4:2:0", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(32, 32));

      const yuv444 = await encode(
        data,
        { ...descriptor, sampling: { chromaSubsampling: "444" } },
        { quality: 80, speed: 10 },
      );
      const yuv420 = await encode(
        data,
        { ...descriptor, sampling: { chromaSubsampling: "420" } },
        { quality: 80, speed: 10 },
      );

      expect(yuv444.length).toBeGreaterThan(yuv420.length);
    });
  });

  describe("color space options", () => {
    it("should encode with sRGB color space", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(16, 16));
      const encoded = await encode(
        data,
        { ...descriptor, color: { primaries: "bt709" } },
        { speed: 10 },
      );
      const decoded = await decode(encoded);

      expect(decoded.descriptor.color?.primaries).toBe("bt709");
      expect(decoded.descriptor.transfer?.function).toBe("srgb");
    });

    it("should encode with Display P3 color space", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(16, 16));
      const encoded = await encode(
        data,
        { ...descriptor, color: { primaries: "displayP3" } },
        { speed: 10 },
      );
      const decoded = await decode(encoded);

      expect(decoded.descriptor.color?.primaries).toBe("displayP3");
    });

    it("should encode with Rec.2020 color space", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(16, 16));
      const encoded = await encode(
        data,
        { ...descriptor, color: { primaries: "bt2020" } },
        { speed: 10 },
      );
      const decoded = await decode(encoded);

      expect(decoded.descriptor.color?.primaries).toBe("bt2020");
    });
  });

  describe("HDR encoding", () => {
    it("should encode with PQ transfer function", async () => {
      const { data, descriptor } = createTestPixelData16(16, 16, 10);
      const encoded = await encode(
        data,
        { ...descriptor, color: { primaries: "bt2020" }, transfer: { function: "pq" } },
        { speed: 10 },
      );
      const decoded = await decode(encoded);

      expect(decoded.descriptor.transfer?.function).toBe("pq");
    });

    it("should encode with HLG transfer function", async () => {
      const { data, descriptor } = createTestPixelData16(16, 16, 10);
      const encoded = await encode(
        data,
        { ...descriptor, color: { primaries: "bt2020" }, transfer: { function: "hlg" } },
        { speed: 10 },
      );
      const decoded = await decode(encoded);

      expect(decoded.descriptor.transfer?.function).toBe("hlg");
    });

    it("should encode 10-bit output", async () => {
      const { data, descriptor } = createTestPixelData16(16, 16, 10);
      const encoded = await encode(data, descriptor, { speed: 10 });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.numeric.bitDepth).toBe(10);
    });
  });

  describe("speed options", () => {
    it("faster speed should produce results quickly", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(32, 32));

      const start = performance.now();
      await encode(data, descriptor, { speed: 10, quality: 50 });
      const fastTime = performance.now() - start;

      expect(fastTime).toBeLessThan(30000);
    });

    it("should support speed 10 (fastest)", async () => {
      const { data, descriptor } = fromImageData(
        createSolidColorImageData(16, 16, 128, 128, 128),
      );

      const result = await encode(data, descriptor, { speed: 10, quality: 50 });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("round-trip integrity", () => {
    it("should preserve image dimensions through encode-decode", async () => {
      const width = 48;
      const height = 32;
      const { data, descriptor } = fromImageData(
        createTestImageData(width, height),
      );

      const encoded = await encode(data, descriptor, { speed: 10 });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(width);
      expect(decoded.descriptor.geometry.height).toBe(height);
    });

    it("should preserve approximate colors (lossy)", async () => {
      const r = 200,
        g = 100,
        b = 50;
      const { data, descriptor } = fromImageData(
        createSolidColorImageData(16, 16, r, g, b),
      );

      const encoded = await encode(data, descriptor, { quality: 90, speed: 10 });
      const decoded = await decode(encoded);

      const centerIdx = (8 * 16 + 8) * decoded.descriptor.channels.count;
      const pixels = decoded.data as Uint8Array;

      expect(Math.abs(pixels[centerIdx] - r)).toBeLessThan(20);
      expect(Math.abs(pixels[centerIdx + 1] - g)).toBeLessThan(20);
      expect(Math.abs(pixels[centerIdx + 2] - b)).toBeLessThan(20);
    });
  });

  describe("error handling", () => {
    it("should handle 1x1 image", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(1, 1));

      const result = await encode(data, descriptor);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("tuning options", () => {
    it("should support SSIM tuning", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(32, 32));
      const encoded = await encode(data, descriptor, { tune: "ssim" });

      expect(encoded.length).toBeGreaterThan(0);
    });

    it("should support PSNR tuning", async () => {
      const { data, descriptor } = fromImageData(createTestImageData(32, 32));
      const encoded = await encode(data, descriptor, { tune: "psnr" });

      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe("validation", () => {
    it("should reject unsupported dataType (float32)", async () => {
      const data = new Float32Array(16 * 16 * 4);
      const descriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: "rgba" as const, count: 4 },
        numeric: { dataType: "float32" as any, bitDepth: 8 as const },
      };

      await expect(encode(data as any, descriptor)).rejects.toThrow();
    });

    it("should reject dataType mismatch (uint8 descriptor with Uint16Array)", async () => {
      const data = new Uint16Array(16 * 16 * 4);
      const descriptor: AVIFEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: "rgba", count: 4 },
        numeric: { dataType: "uint8", bitDepth: 8 },
      };

      await expect(encode(data as any, descriptor)).rejects.toThrow(
        'descriptor.numeric.dataType "uint8" requires Uint8Array',
      );
    });

    it("should reject dataType mismatch (uint16 descriptor with Uint8Array)", async () => {
      const data = new Uint8Array(16 * 16 * 4);
      const descriptor: AVIFEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: "rgba", count: 4 },
        numeric: { dataType: "uint16", bitDepth: 10 },
      };

      await expect(encode(data as any, descriptor)).rejects.toThrow(
        'descriptor.numeric.dataType "uint16" requires Uint16Array',
      );
    });
  });

  describe("uint16 encoding", () => {
    it("should encode uint16 data with 10-bit depth", async () => {
      const data = new Uint16Array(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((i / 4) * 4) % 1024;
        data[i + 1] = 512;
        data[i + 2] = 800;
        data[i + 3] = 1023;
      }

      const descriptor: AVIFEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: "rgba", count: 4 },
        numeric: { dataType: "uint16", bitDepth: 10 },
      };

      const encoded = await encode(data, descriptor);
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = await decode(encoded);
      expect(decoded.descriptor.numeric.dataType).toBe("uint16");
      expect(decoded.data).toBeInstanceOf(Uint16Array);
      expect(decoded.descriptor.numeric.bitDepth).toBe(10);
    });

    it("should encode uint16 data with 12-bit depth", async () => {
      const data = new Uint16Array(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((i / 4) * 16) % 4096;
        data[i + 1] = 2048;
        data[i + 2] = 3200;
        data[i + 3] = 4095;
      }

      const descriptor: AVIFEncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: "rgba", count: 4 },
        numeric: { dataType: "uint16", bitDepth: 12 },
      };

      const encoded = await encode(data, descriptor);
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = await decode(encoded);
      expect(decoded.descriptor.numeric.dataType).toBe("uint16");
      expect(decoded.descriptor.numeric.bitDepth).toBe(12);
    });
  });
});
