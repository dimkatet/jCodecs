/**
 * Generic codec worker client and ergonomic WorkerHandle abstraction.
 *
 * Wraps WorkerPool with singleton lifecycle management and typed
 * method invocation. Each codec creates one module-level instance.
 *
 * WorkerHandle provides a higher-level API with typed decode/encode methods,
 * input normalization, and transfer list management.
 */

import { CodecWorkerHandlers, InitPayloadType } from "./protocol";
import { WorkerPool } from "./pool";
import type { WorkerTask } from "./pool";

export interface CodecWorkerClientConfig<P = unknown> {
  /** URL to the worker script */
  workerUrl: string | URL;
  /** Number of workers in the pool (defaults to navigator.hardwareConcurrency) */
  poolSize?: number;
  /** Payload sent as the 'init' message to each worker */
  initPayload?: P;
}

export class CodecWorkerClient<
  H extends CodecWorkerHandlers = CodecWorkerHandlers,
> {
  private pool: WorkerPool | null = null;
  private config: CodecWorkerClientConfig | null = null;

  /**
   * Initialize the worker pool.
   * Idempotent — subsequent calls are no-ops if already initialized.
   */
  async init(config?: CodecWorkerClientConfig<InitPayloadType<H>>): Promise<void> {
    if (this.pool) return;

    if (config) {
      this.config = config;
    }

    if (!this.config) {
      throw new Error(
        "CodecWorkerClient: config is required on first init() call",
      );
    }

    const { workerUrl, poolSize, initPayload } = this.config;

    this.pool = new WorkerPool(() => {
      const worker = new Worker(workerUrl, { type: "module" });
      worker.postMessage({
        type: "init",
        id: -1,
        payload: initPayload,
      });
      return worker;
    }, poolSize);

    await this.pool.init();
  }

  /**
   * Invoke a method on a worker.
   * Auto-initializes the pool if not yet initialized.
   */
  async call<K extends Exclude<keyof H, "init">>(
    method: K,
    payload: Parameters<H[K]>[0],
    transferables?: Transferable[],
  ): Promise<Awaited<ReturnType<H[K]>>> {
    if (!this.pool) {
      await this.init();
    }

    const task: WorkerTask<Parameters<H[K]>[0]> = {
      type: method as string,
      payload,
      transferables,
    };
    return this.pool!.execute(task) as Promise<Awaited<ReturnType<H[K]>>>;
  }

  getStats(): {
    poolSize: number;
    availableWorkers: number;
    queuedTasks: number;
  } | null {
    return this.pool?.getStats() ?? null;
  }

  terminate(): void {
    this.pool?.terminate();
    this.pool = null;
  }

  isInitialized(): boolean {
    return this.pool?.isInitialized() ?? false;
  }
}

// ============================================================================
// WorkerHandle — ergonomic user-facing API
// ============================================================================

/**
 * Normalizes a decode input to a transferable Uint8Array.
 * Creates a copy so the buffer can be safely transferred to a worker.
 */
export function normalizeWorkerInput(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof ArrayBuffer
    ? new Uint8Array(input.slice(0))
    : new Uint8Array(
        input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength),
      );
}

/**
 * Ergonomic handle returned by createWorkerPool in each codec package.
 * Provides typed decode/encode methods instead of the raw call() interface.
 */
export interface WorkerHandle<
  TDecodeOptions = unknown,
  TDecodeResult = unknown,
  TEncodeData = unknown,
  TEncodeDescriptor = unknown,
  TEncodeOptions = unknown,
> {
  decode(input: Uint8Array | ArrayBuffer, options?: TDecodeOptions): Promise<TDecodeResult>;
  encode(data: TEncodeData, descriptor: TEncodeDescriptor, options?: TEncodeOptions): Promise<Uint8Array>;
  getStats(): ReturnType<CodecWorkerClient['getStats']>;
  terminate(): void;
  isInitialized(): boolean;
}

/**
 * Creates a WorkerHandle wrapping a CodecWorkerClient.
 *
 * @param raw - The initialized CodecWorkerClient
 * @param opts.encodeTransfer - Whether to transfer data.buffer on encode (default: true).
 *   Pass false for codecs where encode data must not be detached (e.g. EXR).
 */
export function createWorkerHandle<H extends CodecWorkerHandlers>(
  raw: CodecWorkerClient<H>,
  opts?: { encodeTransfer?: boolean },
): WorkerHandle {
  return {
    async decode(input, options) {
      const data = normalizeWorkerInput(input);
      return raw.call(
        "decode" as Exclude<keyof H, "init">,
        { data, options } as Parameters<H[Exclude<keyof H, "init">]>[0],
        [data.buffer],
      ) as Promise<unknown>;
    },
    async encode(data, descriptor, options) {
      const transfers = opts?.encodeTransfer !== false ? [(data as { buffer: ArrayBuffer }).buffer] : [];
      return raw.call(
        "encode" as Exclude<keyof H, "init">,
        { data, descriptor, options } as Parameters<H[Exclude<keyof H, "init">]>[0],
        transfers,
      ) as Promise<Uint8Array>;
    },
    getStats: () => raw.getStats(),
    terminate: () => raw.terminate(),
    isInitialized: () => raw.isInitialized(),
  };
}
