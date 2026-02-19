/**
 * Worker Pool for parallel image processing
 */

export interface WorkerTask<TInput, _TOutput = unknown> {
  type: string;
  payload: TInput;
  transferables?: Transferable[];
}

export interface WorkerResult<TOutput> {
  success: boolean;
  data?: TOutput;
  error?: string;
}

interface QueuedTask<TInput, TOutput> {
  task: WorkerTask<TInput, TOutput>;
  resolve: (value: TOutput) => void;
  reject: (error: Error) => void;
}

/**
 * Generic Worker Pool for executing tasks in parallel
 */
export class WorkerPool<TInput = unknown, TOutput = unknown> {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: QueuedTask<TInput, TOutput>[] = [];
  private terminated = false;
  private initPromise: Promise<void> | null = null;

  constructor(
    private workerFactory: () => Worker,
    private poolSize: number = typeof navigator !== 'undefined'
      ? navigator.hardwareConcurrency || 4
      : 4
  ) {}

  /**
   * Initialize the worker pool
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initWorkers();
    return this.initPromise;
  }

  private async initWorkers(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < this.poolSize; i++) {
      const worker = this.workerFactory();

      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Worker ${i} initialization timeout`));
        }, 30000);

        const handler = (e: MessageEvent) => {
          if (e.data.type === 'ready') {
            clearTimeout(timeoutId);
            worker.removeEventListener('message', handler);
            resolve();
          } else if (e.data.type === 'error') {
            clearTimeout(timeoutId);
            worker.removeEventListener('message', handler);
            reject(new Error(e.data.error));
          }
        };

        worker.addEventListener('message', handler);
        worker.addEventListener('error', (err) => {
          clearTimeout(timeoutId);
          reject(new Error(`Worker error: ${err.message}`));
        });
      });

      initPromises.push(readyPromise);
      this.workers.push(worker);
    }

    await Promise.all(initPromises);
    this.availableWorkers = [...this.workers];
  }

  /**
   * Execute a task in the worker pool
   */
  async execute(task: WorkerTask<TInput, TOutput>): Promise<TOutput> {
    if (this.terminated) {
      throw new Error('Worker pool has been terminated');
    }

    if (!this.initPromise) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const worker = this.availableWorkers.pop()!;
      const { task, resolve, reject } = this.taskQueue.shift()!;

      const messageHandler = (e: MessageEvent<WorkerResult<TOutput>>) => {
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        this.availableWorkers.push(worker);
        this.processQueue();

        if (e.data.success) {
          resolve(e.data.data!);
        } else {
          reject(new Error(e.data.error || 'Unknown worker error'));
        }
      };

      const errorHandler = (e: ErrorEvent) => {
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        this.availableWorkers.push(worker);
        this.processQueue();
        reject(new Error(`Worker error: ${e.message}`));
      };

      worker.addEventListener('message', messageHandler);
      worker.addEventListener('error', errorHandler);
      worker.postMessage(task, task.transferables || []);
    }
  }

  /**
   * Execute multiple tasks in parallel
   */
  async executeAll(tasks: WorkerTask<TInput, TOutput>[]): Promise<TOutput[]> {
    return Promise.all(tasks.map((task) => this.execute(task)));
  }

  /**
   * Get current pool statistics
   */
  getStats(): {
    poolSize: number;
    availableWorkers: number;
    queuedTasks: number;
  } {
    return {
      poolSize: this.poolSize,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
    };
  }

  /**
   * Terminate all workers and reject pending tasks
   */
  terminate(): void {
    this.terminated = true;

    // Terminate all workers
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];

    // Reject all pending tasks
    for (const { reject } of this.taskQueue) {
      reject(new Error('Worker pool terminated'));
    }
    this.taskQueue = [];
  }

  /**
   * Check if pool is initialized
   */
  isInitialized(): boolean {
    return this.workers.length > 0 && !this.terminated;
  }
}
