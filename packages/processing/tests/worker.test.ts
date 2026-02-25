import { createWorkerPool } from "@dimkatet/jcodecs-processing";
import { describe, expect, it } from "vitest";
import { makeUint8Image } from "./helpers";

describe("worker pool — lifecycle", () => {
  it("createWorkerPool returns a handle", async () => {
    const handle = await createWorkerPool({ poolSize: 1 });

    expect(handle).toBeDefined();
    expect(handle.isInitialized()).toBe(true);
  });

  it("getStats returns pool info", async () => {
    const handle = await createWorkerPool({ poolSize: 1 });
    const stats = handle.getStats();
    expect(stats).not.toBeNull();
    expect(typeof stats?.poolSize).toBe("number");
    expect(typeof stats?.availableWorkers).toBe("number");
    expect(typeof stats?.queuedTasks).toBe("number");
  });
});

describe("worker pool — resize", () => {
  it("resizes via worker", async () => {
    const handle = await createWorkerPool({ poolSize: 1 });
    const src = makeUint8Image(64, 64, 4);
    const dst = await handle.resize(src, { width: 32, height: 32 });

    expect(dst.descriptor.geometry.width).toBe(32);
    expect(dst.descriptor.geometry.height).toBe(32);
    expect(dst.data.length).toBe(32 * 32 * 4);
  });

  it("resize with algorithm option", async () => {
    const handle = await createWorkerPool({ poolSize: 1 });
    const src = makeUint8Image(64, 64, 4);
    const dst = await handle.resize(
      src,
      { width: 32, height: 32 },
      { algorithm: "mitchell" },
    );

    expect(dst.data.length).toBe(32 * 32 * 4);
  });
});

describe("worker pool — crop", () => {
  it("crops via worker", async () => {
    const handle = await createWorkerPool({ poolSize: 1 });
    const src = makeUint8Image(64, 64, 4);
    const dst = await handle.crop(src, { x: 0, y: 0, width: 32, height: 32 });

    expect(dst.descriptor.geometry.width).toBe(32);
    expect(dst.descriptor.geometry.height).toBe(32);
    expect(dst.data.length).toBe(32 * 32 * 4);
  });
});

describe("worker pool — rotate", () => {
  it("rotates 90° via worker", async () => {
    const handle = await createWorkerPool({ poolSize: 1 });
    const src = makeUint8Image(64, 32, 4);
    const dst = await handle.rotate(src, 90);

    expect(dst.descriptor.geometry.width).toBe(32);
    expect(dst.descriptor.geometry.height).toBe(64);
  });
});

describe("worker pool — concurrent operations", () => {
  it("handles multiple concurrent tasks", async () => {
    const handle = await createWorkerPool({ poolSize: 1 });
    const src = makeUint8Image(32, 32, 4);

    const results = await Promise.all([
      handle.resize(src, { width: 16, height: 16 }),
      handle.crop(src, { x: 0, y: 0, width: 16, height: 16 }),
      handle.rotate(src, 180),
    ]);

    expect(results[0].descriptor.geometry.width).toBe(16);
    expect(results[1].descriptor.geometry.width).toBe(16);
    expect(results[2].descriptor.geometry.width).toBe(32);
  });
});
