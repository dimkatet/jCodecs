/**
 * Browser tests for EXR decoder
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
} from "@dimkatet/jcodecs-exr";
import type { EXREncodeDescriptor, EXRFormatSpecific } from "@dimkatet/jcodecs-exr";
import type { ImageDescriptor } from "@dimkatet/jcodecs-exr";

/**
 * Create test float16 image data
 */
function createTestFloat16ImageData(
  width: number,
  height: number,
  hasAlpha = true
) {
  const channels = hasAlpha ? 4 : 3;
  const data = new Float16Array(width * height * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      data[i] = x / width;
      data[i + 1] = y / height;
      data[i + 2] = 0.5;
      if (hasAlpha) {
        data[i + 3] = 1.0;
      }
    }
  }

  const descriptor: EXREncodeDescriptor = {
    geometry: { width, height },
    channels: { model: hasAlpha ? 'rgba' : 'rgb', count: channels as 3 | 4 },
    numeric: { dataType: 'float16' },
  };

  return { data, descriptor };
}

/**
 * Create test float32 image data
 */
function createTestFloat32ImageData(
  width: number,
  height: number,
  hasAlpha = true
) {
  const channels = hasAlpha ? 4 : 3;
  const data = new Float32Array(width * height * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      data[i] = x / width;
      data[i + 1] = y / height;
      data[i + 2] = 0.5;
      if (hasAlpha) {
        data[i + 3] = 1.0;
      }
    }
  }

  const descriptor: EXREncodeDescriptor = {
    geometry: { width, height },
    channels: { model: hasAlpha ? 'rgba' : 'rgb', count: channels as 3 | 4 },
    numeric: { dataType: 'float32' },
  };

  return { data, descriptor };
}

describe("EXR Decoder", () => {
  beforeAll(async () => {
    await initDecoder();
    await initEncoder();
  });

  describe("basic decoding", () => {
    it("should decode float16 image", async () => {
      const imageData = createTestFloat16ImageData(64, 64);
      const encoded = await encode(imageData.data, imageData.descriptor, { dataType: "float16" });
      const result = await decode(encoded);

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Float16Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.descriptor.geometry.width).toBe(64);
      expect(result.descriptor.geometry.height).toBe(64);
      expect(result.descriptor.numeric.bitDepth).toBe(16);
      expect(result.descriptor.numeric.dataType).toBe("float16");
    });

    it("should decode float32 image", async () => {
      const imageData = createTestFloat32ImageData(32, 32);
      const encoded = await encode(imageData.data, imageData.descriptor, { dataType: "float32" });
      const result = await decode(encoded);

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Float32Array);
      expect(result.descriptor.numeric.bitDepth).toBe(32);
      expect(result.descriptor.numeric.dataType).toBe("float32");
    });

    it("should preserve image dimensions", async () => {
      const width = 48;
      const height = 32;
      const imageData = createTestFloat16ImageData(width, height);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const result = await decode(encoded);

      expect(result.descriptor.geometry.width).toBe(width);
      expect(result.descriptor.geometry.height).toBe(height);
    });
  });

  describe("metadata extraction", () => {
    it("should extract sRGB (bt709) metadata", async () => {
      const imageData = createTestFloat16ImageData(32, 32);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const result = await decode(encoded);

      expect(result.descriptor.color?.primaries).toBe("bt709");
      expect(result.descriptor.transfer?.function).toBe("linear");
      expect(result.descriptor.luminance?.reference).toBe("hdr");
    });

    it("should extract Display P3 metadata", async () => {
      const imageData = createTestFloat16ImageData(32, 32);
      const descriptorP3: EXREncodeDescriptor = {
        ...imageData.descriptor,
        color: { primaries: 'displayP3' },
      };
      const encoded = await encode(imageData.data, descriptorP3);
      const result = await decode(encoded);

      expect(result.descriptor.color?.primaries).toBe("displayP3");
      const fs = result.descriptor.formatSpecific as EXRFormatSpecific;
      expect(fs.chromaticities).toBeDefined();
    });

    it("should extract Rec.2020 metadata", async () => {
      const imageData = createTestFloat16ImageData(32, 32);
      const descriptorBT2020: EXREncodeDescriptor = {
        ...imageData.descriptor,
        color: { primaries: 'bt2020' },
      };
      const encoded = await encode(imageData.data, descriptorBT2020);
      const result = await decode(encoded);

      expect(result.descriptor.color?.primaries).toBe("bt2020");
      const fs = result.descriptor.formatSpecific as EXRFormatSpecific;
      expect(fs.chromaticities).toBeDefined();
    });

    it("should always be HDR (linear transfer)", async () => {
      const imageData = createTestFloat16ImageData(32, 32);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const result = await decode(encoded);

      expect(result.descriptor.transfer?.function).toBe("linear");
      expect(result.descriptor.luminance?.reference).toBe("hdr");
    });

    it("should extract compression metadata", async () => {
      const imageData = createTestFloat16ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor, { compression: "piz" });
      const result = await decode(encoded);

      const fs = result.descriptor.formatSpecific as EXRFormatSpecific;
      expect(fs.compression).toBe("piz");
    });

    it("should have data and display windows", async () => {
      const imageData = createTestFloat16ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const result = await decode(encoded);

      const fs = result.descriptor.formatSpecific as EXRFormatSpecific;
      expect(fs.dataWindow).toBeDefined();
      expect(fs.displayWindow).toBeDefined();
      expect(fs.dataWindow.xMax).toBe(15);
      expect(fs.dataWindow.yMax).toBe(15);
    });
  });

  describe("getImageInfo", () => {
    it("should get image info without full decode", async () => {
      const imageData = createTestFloat16ImageData(64, 48);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const info: ImageDescriptor = await getImageInfo(encoded);

      expect(info.geometry.width).toBe(64);
      expect(info.geometry.height).toBe(48);
      expect(info.numeric.bitDepth).toBeGreaterThan(0);
      expect(info.channels.count).toBeGreaterThan(0);
    });

    it("should match full decode metadata", async () => {
      const imageData = createTestFloat16ImageData(32, 32);
      const descriptorP3: EXREncodeDescriptor = {
        ...imageData.descriptor,
        color: { primaries: 'displayP3' },
      };
      const encoded = await encode(imageData.data, descriptorP3, { dataType: "float16" });

      const info: ImageDescriptor = await getImageInfo(encoded);
      const result = await decode(encoded);

      expect(info.geometry.width).toBe(result.descriptor.geometry.width);
      expect(info.geometry.height).toBe(result.descriptor.geometry.height);
      expect(info.numeric.bitDepth).toBe(result.descriptor.numeric.bitDepth);
      expect(info.channels.count).toBe(result.descriptor.channels.count);
      expect(info.color?.primaries).toBe(result.descriptor.color?.primaries);
      expect(info.transfer?.function).toBe(result.descriptor.transfer?.function);
      expect(info.luminance?.reference).toBe(result.descriptor.luminance?.reference);
    });
  });

  describe("dataType handling", () => {
    it("should auto-detect dataType from file", async () => {
      const imageData16 = createTestFloat16ImageData(16, 16);
      const encoded16 = await encode(imageData16.data, imageData16.descriptor, { dataType: "float16" });
      const result16 = await decode(encoded16, { dataType: "auto" });

      expect(result16.descriptor.numeric.dataType).toBe("float16");
      expect(result16.data).toBeInstanceOf(Float16Array);

      const imageData32 = createTestFloat32ImageData(16, 16);
      const encoded32 = await encode(imageData32.data, imageData32.descriptor, { dataType: "float32" });
      const result32 = await decode(encoded32, { dataType: "auto" });

      expect(result32.descriptor.numeric.dataType).toBe("float32");
      expect(result32.data).toBeInstanceOf(Float32Array);
    });

    it("should convert float32 to float16 when requested", async () => {
      const imageData = createTestFloat32ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor, { dataType: "float32" });

      const result = await decode(encoded, { dataType: "float16" });
      expect(result.descriptor.numeric.dataType).toBe("float16");
      expect(result.data).toBeInstanceOf(Float16Array);
    });

    it("should convert float16 to float32 when requested", async () => {
      const imageData = createTestFloat16ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor, { dataType: "float16" });

      const result = await decode(encoded, { dataType: "float32" });
      expect(result.descriptor.numeric.dataType).toBe("float32");
      expect(result.data).toBeInstanceOf(Float32Array);
    });
  });

  describe("channels", () => {
    it("should decode RGB images (3 channels)", async () => {
      const imageData = createTestFloat16ImageData(16, 16, false);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const result = await decode(encoded);

      expect(result.descriptor.channels.count).toBe(3);
    });

    it("should decode RGBA images (4 channels)", async () => {
      const imageData = createTestFloat16ImageData(16, 16, true);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const result = await decode(encoded);

      expect(result.descriptor.channels.count).toBe(4);
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

  describe("pixel data integrity", () => {
    it("should have correct pixel count", async () => {
      const width = 32;
      const height = 24;
      const channels = 4;
      const imageData = createTestFloat16ImageData(width, height);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const result = await decode(encoded);

      const expectedPixels = width * height * channels;
      expect(result.data.length).toBe(expectedPixels);
    });

    it("should preserve approximate float values in lossless mode", async () => {
      const imageData = createTestFloat16ImageData(8, 8);
      const encoded = await encode(imageData.data, imageData.descriptor, { compression: "zip" });
      const decoded = await decode(encoded);

      const channels = decoded.descriptor.channels.count;
      const centerIdx = (4 * 8 + 4) * channels;
      const srcData = imageData.data as Float16Array;
      const dstData = decoded.data;

      expect(Math.abs(Number(dstData[centerIdx]) - Number(srcData[centerIdx]))).toBeLessThan(0.01);
    });
  });

  describe("compression formats", () => {
    const compressionFormats = [
      "none",
      "rle",
      "zips",
      "zip",
      "piz",
      "pxr24",
      "dwaa",
      "dwab",
    ] as const;

    compressionFormats.forEach((compression) => {
      it(`should support ${compression} compression`, async () => {
        const imageData = createTestFloat16ImageData(16, 16);
        const encoded = await encode(imageData.data, imageData.descriptor, { compression });
        const decoded = await decode(encoded);

        expect(decoded.descriptor.geometry.width).toBe(16);
        expect(decoded.descriptor.geometry.height).toBe(16);
        const fs = decoded.descriptor.formatSpecific as EXRFormatSpecific;
        expect(fs.compression).toBe(compression);
      });
    });
  });
});
