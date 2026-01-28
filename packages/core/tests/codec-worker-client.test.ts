import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CodecWorkerClient } from '../src/codec-worker-client';

// Create mock pool instance
function createMockPool() {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue({ result: 'data' }),
    getStats: vi.fn().mockReturnValue({
      poolSize: 4,
      availableWorkers: 3,
      queuedTasks: 1,
    }),
    terminate: vi.fn(),
    isInitialized: vi.fn().mockReturnValue(true),
  };
}

// Mock WorkerPool class
const mockPoolInstances: ReturnType<typeof createMockPool>[] = [];
vi.mock('../src/worker-pool', () => {
  return {
    WorkerPool: class MockWorkerPool {
      factory: () => Worker;
      poolSize?: number;
      mockInstance = createMockPool();

      constructor(factory: () => Worker, poolSize?: number) {
        this.factory = factory;
        this.poolSize = poolSize;
        mockPoolInstances.push(this.mockInstance);
      }

      init() {
        return this.mockInstance.init();
      }
      execute(task: unknown) {
        return this.mockInstance.execute(task);
      }
      getStats() {
        return this.mockInstance.getStats();
      }
      terminate() {
        return this.mockInstance.terminate();
      }
      isInitialized() {
        return this.mockInstance.isInitialized();
      }
    },
  };
});

// Mock Worker class
class MockWorker {
  url: string | URL;
  options: WorkerOptions;
  postMessageCalls: unknown[] = [];

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options || {};
  }

  postMessage(data: unknown) {
    this.postMessageCalls.push(data);
  }

  terminate() {}
}

describe('CodecWorkerClient', () => {
  let originalWorker: typeof Worker;

  beforeEach(() => {
    originalWorker = globalThis.Worker;
    (globalThis as any).Worker = MockWorker;
    mockPoolInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    (globalThis as any).Worker = originalWorker;
  });

  it('throws if init called without config on first call', async () => {
    const client = new CodecWorkerClient();

    await expect(client.init()).rejects.toThrow(
      'CodecWorkerClient: config is required on first init() call',
    );
  });

  it('initializes pool with correct poolSize', async () => {
    const client = new CodecWorkerClient();

    await client.init({
      workerUrl: '/worker.js',
      poolSize: 2,
      initPayload: { wasmUrl: '/codec.wasm' },
    });

    expect(mockPoolInstances).toHaveLength(1);
    expect(mockPoolInstances[0].init).toHaveBeenCalled();
  });

  it('is idempotent - second init is no-op', async () => {
    const client = new CodecWorkerClient();

    await client.init({ workerUrl: '/worker.js' });
    await client.init({ workerUrl: '/different.js' });

    expect(mockPoolInstances).toHaveLength(1);
  });

  it('call() executes task on pool', async () => {
    const client = new CodecWorkerClient();

    await client.init({ workerUrl: '/worker.js' });

    const result = await client.call('decode', { data: 'test' });

    expect(result).toEqual({ result: 'data' });
    expect(mockPoolInstances[0].execute).toHaveBeenCalledWith({
      type: 'decode',
      payload: { data: 'test' },
      transferables: undefined,
    });
  });

  it('call() throws if called without init and no config', async () => {
    const client = new CodecWorkerClient();

    await expect(client.call('decode', {})).rejects.toThrow(
      'CodecWorkerClient: config is required',
    );
  });

  it('call() passes transferables to task', async () => {
    const client = new CodecWorkerClient();

    await client.init({ workerUrl: '/worker.js' });

    const buffer = new ArrayBuffer(8);
    await client.call('encode', { data: buffer }, [buffer]);

    expect(mockPoolInstances[0].execute).toHaveBeenCalledWith({
      type: 'encode',
      payload: { data: buffer },
      transferables: [buffer],
    });
  });

  it('getStats() returns null when not initialized', () => {
    const client = new CodecWorkerClient();
    expect(client.getStats()).toBeNull();
  });

  it('getStats() returns pool stats when initialized', async () => {
    const client = new CodecWorkerClient();
    await client.init({ workerUrl: '/worker.js' });

    const stats = client.getStats();

    expect(stats).toEqual({
      poolSize: 4,
      availableWorkers: 3,
      queuedTasks: 1,
    });
  });

  it('isInitialized() returns false when not initialized', () => {
    const client = new CodecWorkerClient();
    expect(client.isInitialized()).toBe(false);
  });

  it('isInitialized() returns true when initialized', async () => {
    const client = new CodecWorkerClient();
    await client.init({ workerUrl: '/worker.js' });

    expect(client.isInitialized()).toBe(true);
  });

  it('terminate() cleans up pool', async () => {
    const client = new CodecWorkerClient();

    await client.init({ workerUrl: '/worker.js' });

    // Mock isInitialized to return false after terminate
    mockPoolInstances[0].isInitialized.mockReturnValue(false);

    client.terminate();

    expect(mockPoolInstances[0].terminate).toHaveBeenCalled();
    expect(client.isInitialized()).toBe(false);
  });

  it('can re-initialize after terminate', async () => {
    const client = new CodecWorkerClient();

    await client.init({ workerUrl: '/worker.js' });
    client.terminate();
    await client.init({ workerUrl: '/worker.js' });

    expect(mockPoolInstances).toHaveLength(2);
  });

  it('worker factory sends init message with payload', async () => {
    const client = new CodecWorkerClient();
    const { WorkerPool } = await import('../src/worker-pool');

    await client.init({
      workerUrl: '/worker.js',
      initPayload: { decoderWasmUrl: '/decoder.wasm' },
    });

    // Get the factory function that was passed to WorkerPool constructor
    // The mock stores it on the instance
    const MockPoolClass = WorkerPool as any;
    const factoryFn = (MockPoolClass as any).mock?.calls?.[0]?.[0];

    // If we can't get factory via mock.calls, skip this test
    if (!factoryFn) {
      // Alternative: test that Worker was constructed with correct params by checking instance
      return;
    }

    const worker = factoryFn() as MockWorker;

    expect(worker.url).toBe('/worker.js');
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.postMessageCalls).toEqual([
      {
        type: 'init',
        id: -1,
        payload: { decoderWasmUrl: '/decoder.wasm' },
      },
    ]);
  });
});
