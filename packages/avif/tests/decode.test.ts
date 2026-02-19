/**
 * Browser tests for AVIF decoder
 *
 * These tests run in a real browser environment using Playwright.
 * They test the full WASM integration including decode operations and metadata extraction.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { decode, getImageInfo, initDecoder } from "@dimkatet/jcodecs-avif";
import type { AVIFImageData } from "@dimkatet/jcodecs-avif";
import type { ImageDescriptor } from "@dimkatet/jcodecs-avif";

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
    let info: ImageDescriptor;

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
      expect(result.descriptor.geometry.width).toBeGreaterThan(0);
      expect(result.descriptor.geometry.height).toBeGreaterThan(0);
    });

    it("should be 8-bit SDR", () => {
      expect(result.descriptor.numeric.bitDepth).toBe(8);
      expect(result.descriptor.transfer?.function).not.toBe("pq");
      expect(result.descriptor.transfer?.function).not.toBe("hlg");
    });

    it("should have sRGB color primaries (bt709)", () => {
      expect(result.descriptor.color?.primaries).toBe("bt709");
    });

    it("should have sRGB transfer function", () => {
      expect(result.descriptor.transfer?.function).toBe("srgb");
    });

    it("should have valid matrix coefficients", () => {
      expect(["bt709", "bt601", "identity"]).toContain(result.descriptor.color?.matrix);
    });

    it("should not have HDR metadata", () => {
      expect(result.descriptor.hdr?.maxCLL ?? 0).toBe(0);
      expect(result.descriptor.hdr?.maxPALL ?? 0).toBe(0);
      expect(result.descriptor.hdr?.masteringDisplay).toBeUndefined();
    });

    it("getImageInfo should match decode result", () => {
      expect(info.geometry.width).toBe(result.descriptor.geometry.width);
      expect(info.geometry.height).toBe(result.descriptor.geometry.height);
      expect(info.numeric.bitDepth).toBe(result.descriptor.numeric.bitDepth);
      expect(info.channels.count).toBe(result.descriptor.channels.count);
      expect(info.color?.primaries).toBe(result.descriptor.color?.primaries);
      expect(info.transfer?.function).toBe(result.descriptor.transfer?.function);
    });
  });

  describe("HDR Rec.2020 image (colors_hdr_rec2020.avif)", () => {
    let result: AVIFImageData;
    let info: ImageDescriptor;

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
      expect(result.descriptor.geometry.width).toBeGreaterThan(0);
      expect(result.descriptor.geometry.height).toBeGreaterThan(0);
    });

    it("should be HDR", () => {
      expect(["pq", "hlg"]).toContain(result.descriptor.transfer?.function);
    });

    it("should have BT.2020 color primaries", () => {
      expect(result.descriptor.color?.primaries).toBe("bt2020");
    });

    it("should have PQ (SMPTE ST 2084) transfer function", () => {
      expect(result.descriptor.transfer?.function).toBe("pq");
    });

    it("should have BT.2020 matrix coefficients", () => {
      expect(["bt2020Ncl", "bt2020Cl", "identity"]).toContain(result.descriptor.color?.matrix);
    });

    it("should have 10-bit or higher depth for HDR", () => {
      expect(result.descriptor.numeric.bitDepth).toBeGreaterThanOrEqual(10);
    });

    it("should return Uint16Array for high bit depth", () => {
      if (result.descriptor.numeric.bitDepth > 8) {
        expect(result.data).toBeInstanceOf(Uint16Array);
      }
    });

    it("getImageInfo should match decode result", () => {
      expect(info.geometry.width).toBe(result.descriptor.geometry.width);
      expect(info.geometry.height).toBe(result.descriptor.geometry.height);
      expect(info.color?.primaries).toBe(result.descriptor.color?.primaries);
      expect(info.transfer?.function).toBe(result.descriptor.transfer?.function);
    });
  });

  describe("HDR Display P3 image (colors_hdr_p3.avif)", () => {
    let result: AVIFImageData;
    let info: ImageDescriptor;

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
      expect(result.descriptor.geometry.width).toBeGreaterThan(0);
      expect(result.descriptor.geometry.height).toBeGreaterThan(0);
    });

    it("should be HDR", () => {
      expect(["pq", "hlg"]).toContain(result.descriptor.transfer?.function);
    });

    it("should have Display P3 or DCI-P3 color primaries", () => {
      expect(["displayP3", "dciP3"]).toContain(result.descriptor.color?.primaries);
    });

    it("should have PQ transfer function", () => {
      expect(result.descriptor.transfer?.function).toBe("pq");
    });

    it("should have 10-bit or higher depth for HDR", () => {
      expect(result.descriptor.numeric.bitDepth).toBeGreaterThanOrEqual(10);
    });

    it("getImageInfo should match decode result", () => {
      expect(info.geometry.width).toBe(result.descriptor.geometry.width);
      expect(info.geometry.height).toBe(result.descriptor.geometry.height);
      expect(info.color?.primaries).toBe(result.descriptor.color?.primaries);
      expect(info.transfer?.function).toBe(result.descriptor.transfer?.function);
    });
  });

  describe("decode options", () => {
    it("should decode HDR image as 8-bit when requested", async () => {
      const data = await loadFixture("colors_hdr_rec2020.avif");
      const result = await decode(data, { bitDepth: 8 });

      expect(result.descriptor.numeric.bitDepth).toBe(8);
      expect(result.data).toBeInstanceOf(Uint8Array);
    });

    it("should preserve HDR metadata when downsampling to 8-bit", async () => {
      const data = await loadFixture("colors_hdr_rec2020.avif");
      const result = await decode(data, { bitDepth: 8 });

      expect(result.descriptor.color?.primaries).toBe("bt2020");
      expect(result.descriptor.transfer?.function).toBe("pq");
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

      const { width, height } = result.descriptor.geometry;
      const channels = result.descriptor.channels.count;
      expect(result.data.length).toBe(width * height * channels);
    });

    it("should have correct pixel count for HDR image", async () => {
      const data = await loadFixture("colors_hdr_rec2020.avif");
      const result = await decode(data);

      const { width, height } = result.descriptor.geometry;
      const channels = result.descriptor.channels.count;
      expect(result.data.length).toBe(width * height * channels);
    });
  });
});
