/**
 * Browser tests for EXR encoder
 *
 * These tests run in a real browser environment using Playwright.
 * They test the full WASM integration including encode operations.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  encode,
  encodeSimple,
  decode,
  initDecoder,
  isDecoderInitialized,
  initEncoder,
  isEncoderInitialized,
} from "@dimkatet/jcodecs-exr";
import type { EXREncodeDescriptor, EXRFormatSpecific } from "@dimkatet/jcodecs-exr";

/**
 * Create test float16 image data with gradient pattern
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

/**
 * Create a solid color float16 image
 */
function createSolidFloat16ImageData(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 1.0
) {
  const data = new Float16Array(width * height * 4);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }

  const descriptor: EXREncodeDescriptor = {
    geometry: { width, height },
    channels: { model: 'rgba', count: 4 },
    numeric: { dataType: 'float16' },
  };

  return { data, descriptor };
}

describe("EXR Encoder", () => {
  beforeAll(async () => {
    await initEncoder();
    await initDecoder();
  });

  describe("initialization", () => {
    it("should initialize encoder", () => {
      expect(isEncoderInitialized()).toBe(true);
    });

    it("should initialize decoder", () => {
      expect(isDecoderInitialized()).toBe(true);
    });
  });

  describe("basic encoding", () => {
    it("should encode float16 image data", async () => {
      const imageData = createTestFloat16ImageData(64, 64);
      const result = await encode(imageData.data, imageData.descriptor);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should encode float32 image data", async () => {
      const imageData = createTestFloat32ImageData(64, 64);
      const result = await encode(imageData.data, imageData.descriptor);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should encode using encodeSimple", async () => {
      const imageData = new ImageData(64, 64);
      const result = await encodeSimple(imageData, "zip");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should produce valid EXR that can be decoded", async () => {
      const imageData = createTestFloat16ImageData(32, 32);
      const encoded = await encode(imageData.data, imageData.descriptor);

      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(32);
      expect(decoded.descriptor.geometry.height).toBe(32);
      expect(decoded.data.length).toBeGreaterThan(0);
    });

    it("encoded size should be smaller than raw data (with compression)", async () => {
      const imageData = createTestFloat16ImageData(64, 64);
      const rawSize = (imageData.data as Float16Array).byteLength;
      const encoded = await encode(imageData.data, imageData.descriptor, { compression: "zip" });

      expect(encoded.length).toBeLessThan(rawSize);
    });
  });

  describe("compression options", () => {
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
        const imageData = createTestFloat16ImageData(32, 32);
        const encoded = await encode(imageData.data, imageData.descriptor, { compression });

        expect(encoded.length).toBeGreaterThan(0);

        const decoded = await decode(encoded);
        const fs = decoded.descriptor.formatSpecific as EXRFormatSpecific;
        expect(fs.compression).toBe(compression);
      });
    });

    it("none compression should produce larger files than zip", async () => {
      const imageData = createTestFloat16ImageData(32, 32);

      const noCompression = await encode(imageData.data, imageData.descriptor, { compression: "none" });
      const zipCompression = await encode(imageData.data, imageData.descriptor, { compression: "zip" });

      expect(noCompression.length).toBeGreaterThan(zipCompression.length);
    });

    it("piz should provide good compression for gradients", async () => {
      const imageData = createTestFloat16ImageData(64, 64);

      const piz = await encode(imageData.data, imageData.descriptor, { compression: "piz" });
      const none = await encode(imageData.data, imageData.descriptor, { compression: "none" });

      expect(piz.length).toBeLessThan(none.length * 0.5);
    });
  });

  describe("color space options", () => {
    it("should encode with sRGB (bt709) color space", async () => {
      const imageData = createTestFloat16ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.color?.primaries).toBe("bt709");
    });

    it("should encode with Display P3 color space", async () => {
      const imageData = createTestFloat16ImageData(16, 16);
      const descriptorP3: EXREncodeDescriptor = {
        ...imageData.descriptor,
        color: { primaries: 'displayP3' },
      };
      const encoded = await encode(imageData.data, descriptorP3);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.color?.primaries).toBe("displayP3");
      const fs = decoded.descriptor.formatSpecific as EXRFormatSpecific;
      expect(fs.chromaticities).toBeDefined();
    });

    it("should encode with Rec.2020 color space", async () => {
      const imageData = createTestFloat16ImageData(16, 16);
      const descriptorBT2020: EXREncodeDescriptor = {
        ...imageData.descriptor,
        color: { primaries: 'bt2020' },
      };
      const encoded = await encode(imageData.data, descriptorBT2020);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.color?.primaries).toBe("bt2020");
      const fs = decoded.descriptor.formatSpecific as EXRFormatSpecific;
      expect(fs.chromaticities).toBeDefined();
    });
  });

  describe("dataType options", () => {
    it("should encode as float16", async () => {
      const imageData = createTestFloat16ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor, { dataType: "float16" });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.numeric.dataType).toBe("float16");
      expect(decoded.descriptor.numeric.bitDepth).toBe(16);
    });

    it("should encode as float32", async () => {
      const imageData = createTestFloat32ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor, { dataType: "float32" });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.numeric.dataType).toBe("float32");
      expect(decoded.descriptor.numeric.bitDepth).toBe(32);
    });

    it("should convert float32 input to float16 output", async () => {
      const imageData = createTestFloat32ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor, { dataType: "float16" });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.numeric.dataType).toBe("float16");
    });

    it("should convert float16 input to float32 output", async () => {
      const imageData = createTestFloat16ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor, { dataType: "float32" });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.numeric.dataType).toBe("float32");
    });
  });

  describe("round-trip integrity", () => {
    it("should preserve image dimensions through encode-decode", async () => {
      const width = 48;
      const height = 32;
      const imageData = createTestFloat16ImageData(width, height);

      const encoded = await encode(imageData.data, imageData.descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(width);
      expect(decoded.descriptor.geometry.height).toBe(height);
    });

    it("should preserve approximate float values with lossless compression", async () => {
      const r = 0.7, g = 0.3, b = 0.9;
      const imageData = createSolidFloat16ImageData(16, 16, r, g, b);

      const encoded = await encode(imageData.data, imageData.descriptor, { compression: "zip" });
      const decoded = await decode(encoded);

      const channels = decoded.descriptor.channels.count;
      const centerIdx = (8 * 16 + 8) * channels;
      const data = decoded.data;

      expect(Math.abs(Number(data[centerIdx]) - r)).toBeLessThan(0.01);
      expect(Math.abs(Number(data[centerIdx + 1]) - g)).toBeLessThan(0.01);
      expect(Math.abs(Number(data[centerIdx + 2]) - b)).toBeLessThan(0.01);
    });

    it("should preserve HDR values > 1.0", async () => {
      const imageData = createSolidFloat16ImageData(8, 8, 2.0, 5.0, 10.0);

      const encoded = await encode(imageData.data, imageData.descriptor, { compression: "none" });
      const decoded = await decode(encoded);

      const channels = decoded.descriptor.channels.count;
      const centerIdx = (4 * 8 + 4) * channels;
      const data = decoded.data;

      expect(Number(data[centerIdx])).toBeGreaterThan(1.5);
      expect(Number(data[centerIdx + 1])).toBeGreaterThan(4.0);
      expect(Number(data[centerIdx + 2])).toBeGreaterThan(9.0);
    });
  });

  describe("channels", () => {
    it("should encode RGB images (3 channels)", async () => {
      const imageData = createTestFloat16ImageData(16, 16, false);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.channels.count).toBe(3);
    });

    it("should encode RGBA images (4 channels)", async () => {
      const imageData = createTestFloat16ImageData(16, 16, true);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.channels.count).toBe(4);
    });
  });

  describe("validation", () => {
    it("should reject unsupported dataType (uint8)", async () => {
      const invalidDescriptor: any = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint8' },
      };

      await expect(
        encode(new Uint8Array(16 * 16 * 4) as any, invalidDescriptor)
      ).rejects.toThrow('EXR encoder: unsupported dataType "uint8"');
    });

    it("should reject unsupported dataType (uint16)", async () => {
      const invalidDescriptor: any = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'uint16' },
      };

      await expect(
        encode(new Uint16Array(16 * 16 * 4) as any, invalidDescriptor)
      ).rejects.toThrow('EXR encoder: unsupported dataType "uint16"');
    });

    it("should reject dataType mismatch (float16 with Float32Array)", async () => {
      const descriptor: EXREncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'float16' },
      };

      await expect(
        encode(new Float32Array(16 * 16 * 4) as any, descriptor)
      ).rejects.toThrow('dataType "float16" requires Float16Array');
    });

    it("should reject dataType mismatch (float32 with Float16Array)", async () => {
      const descriptor: EXREncodeDescriptor = {
        geometry: { width: 16, height: 16 },
        channels: { model: 'rgba', count: 4 },
        numeric: { dataType: 'float32' },
      };

      await expect(
        encode(new Float16Array(16 * 16 * 4), descriptor)
      ).rejects.toThrow('dataType "float32" requires Float32Array');
    });
  });

  describe("metadata preservation", () => {
    it("should always be HDR with linear transfer", async () => {
      const imageData = createTestFloat16ImageData(16, 16);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.luminance?.reference).toBe("hdr");
      expect(decoded.descriptor.transfer?.function).toBe("linear");
    });

    it("should set data and display windows", async () => {
      const width = 32;
      const height = 24;
      const imageData = createTestFloat16ImageData(width, height);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const decoded = await decode(encoded);

      const fs = decoded.descriptor.formatSpecific as EXRFormatSpecific;
      expect(fs.dataWindow).toBeDefined();
      expect(fs.displayWindow).toBeDefined();
      expect(fs.dataWindow.xMax).toBe(width - 1);
      expect(fs.dataWindow.yMax).toBe(height - 1);
    });
  });

  describe("edge cases", () => {
    it("should handle small images (1x1)", async () => {
      const imageData = createTestFloat16ImageData(1, 1);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(1);
      expect(decoded.descriptor.geometry.height).toBe(1);
    });

    it("should handle large images (512x512)", async () => {
      const imageData = createTestFloat16ImageData(512, 512);
      const encoded = await encode(imageData.data, imageData.descriptor, { compression: "zip" });
      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(512);
      expect(decoded.descriptor.geometry.height).toBe(512);
    });

    it("should handle non-square images", async () => {
      const imageData = createTestFloat16ImageData(64, 32);
      const encoded = await encode(imageData.data, imageData.descriptor);
      const decoded = await decode(encoded);

      expect(decoded.descriptor.geometry.width).toBe(64);
      expect(decoded.descriptor.geometry.height).toBe(32);
    });
  });
});
