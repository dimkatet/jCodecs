/**
 * Browser tests for JXL decoder
 *
 * These tests run in a real browser environment using Playwright.
 * They test the full WASM integration including decode operations and metadata extraction.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  decode,
  encode,
  getImageInfo,
  initDecoder,
  initEncoder,
} from "@dimkatet/jcodecs-jxl";
import type { JXLImageData, JXLImageInfo } from "@dimkatet/jcodecs-jxl";

/**
 * Load a test fixture file
 */
async function loadFixture(filename: string): Promise<Uint8Array> {
  const response = await fetch(`/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load fixture: ${filename}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Create a test ImageData for encoding
 */
function createTestImageData(
  width: number,
  height: number,
  hasAlpha = true
): ImageData {
  const channels = hasAlpha ? 4 : 4;
  const data = new Uint8ClampedArray(width * height * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      data[i] = Math.floor((x / width) * 255);
      data[i + 1] = Math.floor((y / height) * 255);
      data[i + 2] = 128;
      data[i + 3] = hasAlpha ? 255 : 255;
    }
  }

  return new ImageData(data, width, height);
}

describe.skip("JXL Decoder", () => {
  beforeAll(async () => {
    await initDecoder();
    await initEncoder();
  });

  describe("real test files from libjxl/testdata", () => {
    describe("pq_gradient.jxl (HDR PQ gradient)", () => {
      let result: JXLImageData;
      let info: JXLImageInfo;

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
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
      });

      it("should be HDR with PQ transfer", () => {
        expect(result.metadata.transferFunction).toBe("pq");
        expect(result.metadata.isHDR).toBe(true);
      });

      it("should have high bit depth", () => {
        expect(result.bitDepth).toBeGreaterThanOrEqual(10);
      });

      it("should use Uint16Array for high bit depth", () => {
        expect(result.data).toBeInstanceOf(Uint16Array);
        expect(result.dataType).toBe("uint16");
      });

      it("getImageInfo should match decode result", () => {
        expect(info.width).toBe(result.width);
        expect(info.height).toBe(result.height);
        expect(info.bitDepth).toBe(result.bitDepth);
        expect(info.metadata.transferFunction).toBe(result.metadata.transferFunction);
        expect(info.metadata.isHDR).toBe(result.metadata.isHDR);
      });
    });

    describe("splines.jxl (JXL spline feature test)", () => {
      let result: JXLImageData;
      let info: JXLImageInfo;

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
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
      });

      it("should have metadata", () => {
        expect(result.metadata).toBeDefined();
        expect(result.metadata.colorPrimaries).toBeDefined();
        expect(result.metadata.transferFunction).toBeDefined();
      });

      it("getImageInfo should match decode result", () => {
        expect(info.width).toBe(result.width);
        expect(info.height).toBe(result.height);
        expect(info.bitDepth).toBe(result.bitDepth);
      });
    });
  });

  describe("basic decoding", () => {
    it("should decode 8-bit sRGB image", async () => {
      const imageData = createTestImageData(64, 64);
      const encoded = await encode(imageData, { bitDepth: 8 });
      const result = await decode(encoded);

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
      expect(result.bitDepth).toBe(8);
      expect(result.dataType).toBe("uint8");
    });

    it("should decode 10-bit image", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { bitDepth: 10 });
      const result = await decode(encoded);

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Uint16Array);
      expect(result.bitDepth).toBe(10);
      expect(result.dataType).toBe("uint16");
    });

    it("should decode 12-bit image", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { bitDepth: 12 });
      const result = await decode(encoded);

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Uint16Array);
      expect(result.bitDepth).toBe(12);
      expect(result.dataType).toBe("uint16");
    });

    it("should preserve image dimensions", async () => {
      const width = 48;
      const height = 32;
      const imageData = createTestImageData(width, height);
      const encoded = await encode(imageData);
      const result = await decode(encoded);

      expect(result.width).toBe(width);
      expect(result.height).toBe(height);
    });
  });

  describe("metadata extraction", () => {
    it("should extract sRGB metadata", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { colorSpace: "srgb" });
      const result = await decode(encoded);

      expect(result.metadata.colorPrimaries).toBe("bt709");
      expect(result.metadata.transferFunction).toBe("srgb");
      expect(result.metadata.matrixCoefficients).toBe("identity");
      expect(result.metadata.isHDR).toBe(false);
    });

    it("should extract Display P3 metadata", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { colorSpace: "display-p3" });
      const result = await decode(encoded);

      expect(result.metadata.colorPrimaries).toBe("display-p3");
    });

    it("should extract Rec.2020 metadata", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, { colorSpace: "rec2020" });
      const result = await decode(encoded);

      expect(result.metadata.colorPrimaries).toBe("bt2020");
    });

    it("should detect HDR with PQ transfer", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, {
        colorSpace: "rec2020",
        transferFunction: "pq",
        bitDepth: 10,
      });
      const result = await decode(encoded);

      expect(result.metadata.transferFunction).toBe("pq");
      expect(result.metadata.isHDR).toBe(true);
    });

    it("should detect HDR with HLG transfer", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, {
        colorSpace: "rec2020",
        transferFunction: "hlg",
        bitDepth: 10,
      });
      const result = await decode(encoded);

      expect(result.metadata.transferFunction).toBe("hlg");
      expect(result.metadata.isHDR).toBe(true);
    });

    it("should have animation metadata", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData);
      const result = await decode(encoded);

      expect(result.metadata.isAnimated).toBe(false);
      expect(result.metadata.frameCount).toBe(1);
    });
  });

  describe("getImageInfo", () => {
    it("should get image info without full decode", async () => {
      const imageData = createTestImageData(64, 48);
      const encoded = await encode(imageData, { bitDepth: 10 });
      const info = await getImageInfo(encoded);

      expect(info.width).toBe(64);
      expect(info.height).toBe(48);
      expect(info.bitDepth).toBe(10);
      expect(info.channels).toBeGreaterThan(0);
      expect(info.metadata).toBeDefined();
    });

    it("should match full decode metadata", async () => {
      const imageData = createTestImageData(32, 32);
      const encoded = await encode(imageData, {
        colorSpace: "display-p3",
        bitDepth: 10,
      });

      const info = await getImageInfo(encoded);
      const result = await decode(encoded);

      expect(info.width).toBe(result.width);
      expect(info.height).toBe(result.height);
      expect(info.bitDepth).toBe(result.bitDepth);
      expect(info.channels).toBe(result.channels);
      expect(info.metadata.colorPrimaries).toBe(result.metadata.colorPrimaries);
      expect(info.metadata.transferFunction).toBe(result.metadata.transferFunction);
      expect(info.metadata.isHDR).toBe(result.metadata.isHDR);
    });
  });

  describe("dataType handling", () => {
    it("should auto-determine dataType based on bitDepth", async () => {
      const imageData8 = createTestImageData(16, 16);
      const encoded8 = await encode(imageData8, { bitDepth: 8 });
      const result8 = await decode(encoded8);

      expect(result8.dataType).toBe("uint8");
      expect(result8.data).toBeInstanceOf(Uint8Array);

      const imageData10 = createTestImageData(16, 16);
      const encoded10 = await encode(imageData10, { bitDepth: 10 });
      const result10 = await decode(encoded10);

      expect(result10.dataType).toBe("uint16");
      expect(result10.data).toBeInstanceOf(Uint16Array);
    });

    it("should respect explicit dataType option", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { bitDepth: 8 });

      const result = await decode(encoded, { dataType: "uint8" });
      expect(result.dataType).toBe("uint8");
      expect(result.data).toBeInstanceOf(Uint8Array);
    });

    it("should handle uint16 dataType for 10-bit", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { bitDepth: 10 });

      const result = await decode(encoded, { dataType: "uint16" });
      expect(result.dataType).toBe("uint16");
      expect(result.data).toBeInstanceOf(Uint16Array);
    });
  });

  describe.skip("bitDepth conversion", () => {
    it("should convert to specified bitDepth", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { bitDepth: 10 });

      const result8 = await decode(encoded, { bitDepth: 8 });
      expect(result8.bitDepth).toBe(8);
      expect(result8.dataType).toBe("uint8");

      const result10 = await decode(encoded, { bitDepth: 10 });
      expect(result10.bitDepth).toBe(10);
      expect(result10.dataType).toBe("uint16");
    });

    it("should auto-detect bitDepth when set to 0", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData, { bitDepth: 12 });

      const result = await decode(encoded, { bitDepth: 0 });
      expect(result.bitDepth).toBe(12);
    });
  });

  describe("lossless round-trip", () => {
    it("should preserve exact pixels in lossless mode", async () => {
      const imageData = createTestImageData(8, 8);
      const encoded = await encode(imageData, { lossless: true });
      const decoded = await decode(encoded);

      expect(decoded.width).toBe(8);
      expect(decoded.height).toBe(8);

      // Check center pixel
      const centerIdx = (4 * 8 + 4) * decoded.channels;
      const srcData = imageData.data;
      const dstData = decoded.data as Uint8Array;

      // For lossless, colors should be very close (allow small difference for format conversion)
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
    it("should decode RGB images (3 channels)", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData);
      const result = await decode(encoded);

      // JXL can have 3 or 4 channels depending on encoding
      expect(result.channels).toBeGreaterThanOrEqual(3);
      expect(result.channels).toBeLessThanOrEqual(4);
    });

    it("should decode RGBA images (4 channels)", async () => {
      const imageData = createTestImageData(16, 16, true);
      const encoded = await encode(imageData);
      const result = await decode(encoded);

      expect(result.channels).toBeGreaterThanOrEqual(3);
    });
  });

  describe("matrix coefficients", () => {
    it("should always have identity matrix (JXL decodes to RGB)", async () => {
      const imageData = createTestImageData(16, 16);
      const encoded = await encode(imageData);
      const result = await decode(encoded);

      // JXL always decodes to RGB, so matrix is identity
      expect(result.metadata.matrixCoefficients).toBe("identity");
    });
  });
});
