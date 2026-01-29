/**
 * Browser tests for AVIF decoder
 *
 * These tests run in a real browser environment using Playwright.
 * They test the full WASM integration including decode operations and metadata extraction.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { decode, getImageInfo, initDecoder } from "@dimkatet/jcodecs-avif";
import type { AVIFImageData, AVIFImageInfo } from "@dimkatet/jcodecs-avif";

async function loadFixture(filename: string): Promise<Uint8Array> {
  const response = await fetch(`/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load fixture: ${filename}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

describe("AVIF Decoder", () => {
  beforeAll(async () => {
    await initDecoder();
  });

  describe("SDR sRGB image (colors_sdr_srgb.avif)", () => {
    let result: AVIFImageData;
    let info: AVIFImageInfo;

    beforeAll(async () => {
      const data = await loadFixture("colors_sdr_srgb.avif");
      result = await decode(data);
      info = await getImageInfo(data);
    });

    it("should decode successfully", () => {
      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should have correct dimensions", () => {
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it("should be 8-bit SDR", () => {
      expect(result.bitDepth).toBe(8);
      expect(result.metadata.isHDR).toBe(false);
    });

    it("should have sRGB color primaries (bt709)", () => {
      expect(result.metadata.colorPrimaries).toBe("bt709");
    });

    it("should have sRGB transfer function", () => {
      expect(result.metadata.transferFunction).toBe("srgb");
    });

    it("should have valid matrix coefficients", () => {
      // This test file uses BT.601 matrix (common for SDR content)
      expect(["bt709", "bt601"]).toContain(result.metadata.matrixCoefficients);
    });

    it("should not have HDR metadata", () => {
      expect(result.metadata.maxCLL).toBe(0);
      expect(result.metadata.maxPALL).toBe(0);
      expect(result.metadata.masteringDisplay).toBeUndefined();
    });

    it("getImageInfo should match decode result", () => {
      expect(info.width).toBe(result.width);
      expect(info.height).toBe(result.height);
      expect(info.bitDepth).toBe(result.bitDepth);
      expect(info.channels).toBe(result.channels);
      expect(info.metadata.colorPrimaries).toBe(result.metadata.colorPrimaries);
      expect(info.metadata.transferFunction).toBe(
        result.metadata.transferFunction,
      );
      expect(info.metadata.isHDR).toBe(result.metadata.isHDR);
    });
  });

  describe("HDR Rec.2020 image (colors_hdr_rec2020.avif)", () => {
    let result: AVIFImageData;
    let info: AVIFImageInfo;

    beforeAll(async () => {
      const data = await loadFixture("colors_hdr_rec2020.avif");
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

    it("should be HDR", () => {
      expect(result.metadata.isHDR).toBe(true);
    });

    it("should have BT.2020 color primaries", () => {
      expect(result.metadata.colorPrimaries).toBe("bt2020");
    });

    it("should have PQ (SMPTE ST 2084) transfer function", () => {
      expect(result.metadata.transferFunction).toBe("pq");
    });

    it("should have BT.2020 matrix coefficients", () => {
      expect(["bt2020-ncl", "bt2020-cl"]).toContain(
        result.metadata.matrixCoefficients,
      );
    });

    it("should have 10-bit or higher depth for HDR", () => {
      expect(result.bitDepth).toBeGreaterThanOrEqual(10);
    });

    it("should return Uint16Array for high bit depth", () => {
      if (result.bitDepth > 8) {
        expect(result.data).toBeInstanceOf(Uint16Array);
      }
    });

    it("getImageInfo should match decode result", () => {
      expect(info.width).toBe(result.width);
      expect(info.height).toBe(result.height);
      expect(info.metadata.colorPrimaries).toBe(result.metadata.colorPrimaries);
      expect(info.metadata.transferFunction).toBe(
        result.metadata.transferFunction,
      );
      expect(info.metadata.isHDR).toBe(result.metadata.isHDR);
    });
  });

  describe("HDR Display P3 image (colors_hdr_p3.avif)", () => {
    let result: AVIFImageData;
    let info: AVIFImageInfo;

    beforeAll(async () => {
      const data = await loadFixture("colors_hdr_p3.avif");
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

    it("should be HDR", () => {
      expect(result.metadata.isHDR).toBe(true);
    });

    it("should have Display P3 or DCI-P3 color primaries", () => {
      expect(["display-p3", "dci-p3"]).toContain(
        result.metadata.colorPrimaries,
      );
    });

    it("should have PQ transfer function", () => {
      expect(result.metadata.transferFunction).toBe("pq");
    });

    it("should have 10-bit or higher depth for HDR", () => {
      expect(result.bitDepth).toBeGreaterThanOrEqual(10);
    });

    it("getImageInfo should match decode result", () => {
      expect(info.width).toBe(result.width);
      expect(info.height).toBe(result.height);
      expect(info.metadata.colorPrimaries).toBe(result.metadata.colorPrimaries);
      expect(info.metadata.transferFunction).toBe(
        result.metadata.transferFunction,
      );
      expect(info.metadata.isHDR).toBe(result.metadata.isHDR);
    });
  });

  describe("decode options", () => {
    it("should decode HDR image as 8-bit when requested", async () => {
      const data = await loadFixture("colors_hdr_rec2020.avif");
      const result = await decode(data, { bitDepth: 8 });

      expect(result.bitDepth).toBe(8);
      expect(result.data).toBeInstanceOf(Uint8Array);
    });

    it("should preserve HDR metadata when downsampling to 8-bit", async () => {
      const data = await loadFixture("colors_hdr_rec2020.avif");
      const result = await decode(data, { bitDepth: 8 });

      expect(result.metadata.isHDR).toBe(true);
      expect(result.metadata.colorPrimaries).toBe("bt2020");
      expect(result.metadata.transferFunction).toBe("pq");
    });
  });

  describe("error handling", () => {
    it("should throw error for invalid AVIF data", async () => {
      const invalidData = new Uint8Array([0, 1, 2, 3, 4, 5]);

      await expect(decode(invalidData)).rejects.toThrow();
    });

    it("should throw error for empty data", async () => {
      const emptyData = new Uint8Array(0);

      await expect(decode(emptyData)).rejects.toThrow();
    });
  });

  describe("pixel data integrity", () => {
    it("should have correct pixel count for SDR image", async () => {
      const data = await loadFixture("colors_sdr_srgb.avif");
      const result = await decode(data);

      const channels = result.channels;
      const expectedPixels = result.width * result.height * channels;
      expect(result.data.length).toBe(expectedPixels);
    });

    it("should have correct pixel count for HDR image", async () => {
      const data = await loadFixture("colors_hdr_rec2020.avif");
      const result = await decode(data);
      const channels = result.channels;
      const expectedPixels = result.width * result.height * channels;
      expect(result.data.length).toBe(expectedPixels);
    });
  });
});
