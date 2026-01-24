import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerPool } from '../src/worker-pool';

// Mock Worker for Node.js environment
class MockWorker {
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private errorHandler: ((e: ErrorEvent) => void) | null = null;

  addEventListener(type: string, handler: EventListener) {
    if (type === 'message') {
      this.messageHandler = handler as (e: MessageEvent) => void;
    } else if (type === 'error') {
      this.errorHandler = handler as (e: ErrorEvent) => void;
    }
  }

  removeEventListener(type: string, _handler: EventListener) {
    if (type === 'message') {
      this.messageHandler = null;
    } else if (type === 'error') {
      this.errorHandler = null;
    }
  }

  postMessage(data: unknown) {
    // Simulate async response
    setTimeout(() => {
      if (data && typeof data === 'object' && 'type' in data) {
        const msg = data as { type: string; id?: number; payload?: unknown };

        if (msg.type === 'init') {
          this.messageHandler?.({ data: { type: 'ready' } } as MessageEvent);
        } else {
          this.messageHandler?.({
            data: {
              id: msg.id,
              success: true,
              data: `processed: ${JSON.stringify(msg.payload)}`,
            },
          } as MessageEvent);
        }
      }
    }, 10);
  }

  terminate() {
    // noop
  }
}

describe('WorkerPool', () => {
  let pool: WorkerPool<unknown, string>;

  beforeEach(() => {
    pool = new WorkerPool(() => new MockWorker() as unknown as Worker, 2);
  });

  afterEach(() => {
    pool.terminate();
  });

  it('should initialize workers', async () => {
    await pool.init();
    expect(pool.isInitialized()).toBe(true);
  });

  it('should execute tasks', async () => {
    await pool.init();

    const result = await pool.execute({
      type: 'test',
      payload: { value: 42 },
    });

    expect(result).toContain('42');
  });

  it('should handle multiple tasks in parallel', async () => {
    await pool.init();

    const results = await pool.executeAll([
      { type: 'test', payload: { id: 1 } },
      { type: 'test', payload: { id: 2 } },
      { type: 'test', payload: { id: 3 } },
    ]);

    expect(results).toHaveLength(3);
  });

  it('should report stats', async () => {
    await pool.init();

    const stats = pool.getStats();

    expect(stats.poolSize).toBe(2);
    expect(stats.availableWorkers).toBe(2);
    expect(stats.queuedTasks).toBe(0);
  });

  it('should throw after termination', async () => {
    await pool.init();
    pool.terminate();

    await expect(
      pool.execute({ type: 'test', payload: {} })
    ).rejects.toThrow('terminated');
  });
});
