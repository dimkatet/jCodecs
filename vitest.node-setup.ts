/**
 * Shared Node.js test setup — polyfills browser-only globals.
 *
 * Referenced via setupFiles in every *-node vitest project.
 * Each project sets VITEST_FIXTURES_DIR in its env config so fetch()
 * knows where to read fixture files from disk.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ImageData is a browser-only Web API — polyfill for Node.js.
// The struct semantics (data/width/height container) are fully compatible.
if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = class ImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace: PredefinedColorSpace = "srgb";

    constructor(dataOrWidth: Uint8ClampedArray | number, w: number, h?: number) {
      if (typeof dataOrWidth === "number") {
        this.width = dataOrWidth;
        this.height = w;
        this.data = new Uint8ClampedArray(dataOrWidth * w * 4);
      } else {
        this.data = dataOrWidth;
        this.width = w;
        this.height = h ?? dataOrWidth.length / 4 / w;
      }
    }
  } as unknown as typeof ImageData;
}

// fetch polyfill — serves fixture files from disk.
// Browser tests load fixtures via fetch("/<filename>") from publicDir;
// this intercepts those requests using the path set by VITEST_FIXTURES_DIR.
const fixturesDir = process.env.VITEST_FIXTURES_DIR;

if (fixturesDir) {
  globalThis.fetch = async (input: string | URL | Request) => {
    const filename = String(input).replace(/^\//, "");
    const data = await readFile(join(fixturesDir, filename));
    return {
      ok: true,
      arrayBuffer: () =>
        Promise.resolve(
          data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
        ),
    } as Response;
  };
}
