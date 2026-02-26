/**
 * Worker pool tests for AVIF codec.
 *
 * Runs in both browser (Playwright) and Node.js environments.
 * Fixtures are loaded via fetch() — in Node.js the fetch polyfill in
 * tests/node/setup.ts serves files from tests/fixtures/.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createWorkerPool } from "@dimkatet/jcodecs-avif";
import type { AVIFWorkerHandle } from "@dimkatet/jcodecs-avif";

async function loadFixture(filename: string): Promise<Uint8Array> {
  const response = await fetch(`/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load fixture: ${filename}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

describe("AVIF Worker Pool", () => {
  let pool: AVIFWorkerHandle | undefined;

  afterEach(() => {
    pool?.terminate();
    pool = undefined;
  });

  it("should create a worker pool", async () => {
    pool = await createWorkerPool({ poolSize: 1 });
    expect(pool.isInitialized()).toBe(true);
  });

  it("should decode via worker pool", async () => {
    pool = await createWorkerPool({ poolSize: 1 });
    const data = await loadFixture("colors_sdr_srgb.avif");

    const result = await pool.decode(data);

    expect(result).toBeDefined();
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(result.descriptor.geometry.width).toBeGreaterThan(0);
    expect(result.descriptor.geometry.height).toBeGreaterThan(0);
    expect(result.descriptor.numeric.bitDepth).toBe(8);
    expect(result.descriptor.color?.primaries).toBe("bt709");
  });

  it("should decode HDR via worker pool", async () => {
    pool = await createWorkerPool({ poolSize: 1 });
    const data = await loadFixture("colors_hdr_rec2020.avif");

    const result = await pool.decode(data);

    expect(result.descriptor.transfer?.function).toBe("pq");
    expect(result.descriptor.color?.primaries).toBe("bt2020");
    expect(result.descriptor.numeric.bitDepth).toBeGreaterThanOrEqual(10);
  });

  it("should report pool stats", async () => {
    pool = await createWorkerPool({ poolSize: 2 });
    const stats = pool.getStats();

    expect(stats).not.toBeNull();
    expect(stats!.poolSize).toBe(2);
    expect(stats!.availableWorkers).toBe(2);
    expect(stats!.queuedTasks).toBe(0);
  });

  it("should handle concurrent decodes", async () => {
    pool = await createWorkerPool({ poolSize: 2 });
    const data = await loadFixture("colors_sdr_srgb.avif");

    const [r1, r2] = await Promise.all([
      pool.decode(data),
      pool.decode(data),
    ]);

    expect(r1.descriptor.geometry.width).toBe(r2.descriptor.geometry.width);
    expect(r1.descriptor.geometry.height).toBe(r2.descriptor.geometry.height);
  });
});
