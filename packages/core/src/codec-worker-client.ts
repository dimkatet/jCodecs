/**
 * Generic codec worker client.
 *
 * Wraps WorkerPool with singleton lifecycle management and typed
 * method invocation. Each codec creates one module-level instance.
 */

import { WorkerPool } from './worker-pool';
import type { WorkerTask } from './worker-pool';

export interface CodecWorkerClientConfig {
  /** URL to the worker script */
  workerUrl: string | URL;
  /** Number of workers in the pool (defaults to navigator.hardwareConcurrency) */
  poolSize?: number;
  /** Payload sent as the 'init' message to each worker */
  initPayload?: unknown;
}

export class CodecWorkerClient {
  private pool: WorkerPool | null = null;
  private config: CodecWorkerClientConfig | null = null;

  /**
   * Initialize the worker pool.
   * Idempotent — subsequent calls are no-ops if already initialized.
   */
  async init(config?: CodecWorkerClientConfig): Promise<void> {
    if (this.pool) return;

    if (config) {
      this.config = config;
    }

    if (!this.config) {
      throw new Error(
        'CodecWorkerClient: config is required on first init() call',
      );
    }

    const { workerUrl, poolSize, initPayload } = this.config;

    this.pool = new WorkerPool(
      () => {
        const worker = new Worker(workerUrl, { type: 'module' });
        worker.postMessage({
          type: 'init',
          id: -1,
          payload: initPayload,
        });
        return worker;
      },
      poolSize,
    );

    await this.pool.init();
  }

  /**
   * Invoke a method on a worker.
   * Auto-initializes the pool if not yet initialized.
   */
  async call<TResult = unknown>(
    method: string,
    payload: unknown,
    transferables?: Transferable[],
  ): Promise<TResult> {
    if (!this.pool) {
      await this.init();
    }

    const task: WorkerTask<unknown> = {
      type: method,
      payload,
      transferables,
    };

    return this.pool!.execute(task) as Promise<TResult>;
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
