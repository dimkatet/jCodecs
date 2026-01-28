import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCodecWorker } from '../src/codec-worker';

// Mock Worker context (self)
function createMockWorkerContext() {
  const listeners: Map<string, ((e: MessageEvent) => void)[]> = new Map();
  const messages: { data: unknown; transfer?: Transferable[] }[] = [];

  const ctx = {
    addEventListener: (type: string, handler: (e: MessageEvent) => void) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    postMessage: (data: unknown, transfer?: Transferable[]) => {
      messages.push({ data, transfer });
    },
    // Helper to simulate incoming message
    _dispatch: (type: string, data: unknown) => {
      const handlers = listeners.get(type) || [];
      for (const handler of handlers) {
        handler({ data } as MessageEvent);
      }
    },
    _messages: messages,
  };

  return ctx;
}

describe('createCodecWorker', () => {
  let originalSelf: typeof globalThis.self;
  let mockCtx: ReturnType<typeof createMockWorkerContext>;

  beforeEach(() => {
    originalSelf = globalThis.self;
    mockCtx = createMockWorkerContext();
    (globalThis as any).self = mockCtx;
  });

  afterEach(() => {
    (globalThis as any).self = originalSelf;
  });

  it('sends "loaded" message on creation', () => {
    createCodecWorker({
      init: vi.fn(),
    });

    expect(mockCtx._messages).toHaveLength(1);
    expect(mockCtx._messages[0].data).toEqual({ type: 'loaded' });
  });

  it('calls init handler and sends "ready" on init message', async () => {
    const initFn = vi.fn();
    createCodecWorker({ init: initFn });

    mockCtx._messages.length = 0; // Clear 'loaded' message

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: { foo: 'bar' } });

    // Wait for async handler
    await new Promise((r) => setTimeout(r, 0));

    expect(initFn).toHaveBeenCalledWith({ foo: 'bar' });
    expect(mockCtx._messages).toHaveLength(1);
    expect(mockCtx._messages[0].data).toEqual({ type: 'ready' });
  });

  it('rejects non-init messages before initialization', async () => {
    createCodecWorker({
      init: vi.fn(),
      decode: vi.fn(),
    });

    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'decode', id: 1, payload: {} });

    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages).toHaveLength(1);
    expect(mockCtx._messages[0].data).toEqual({
      id: 1,
      success: false,
      error: 'Worker not initialized. Call init() first.',
    });
  });

  it('dispatches to correct handler and returns result', async () => {
    const decodeFn = vi.fn().mockResolvedValue({ width: 100, height: 100 });

    createCodecWorker({
      init: vi.fn(),
      decode: decodeFn,
    });

    // Initialize first
    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'decode', id: 42, payload: { data: 'test' } });
    await new Promise((r) => setTimeout(r, 0));

    expect(decodeFn).toHaveBeenCalledWith({ data: 'test' });
    expect(mockCtx._messages).toHaveLength(1);
    expect(mockCtx._messages[0].data).toEqual({
      id: 42,
      success: true,
      data: { width: 100, height: 100 },
    });
  });

  it('sends error response on unknown message type', async () => {
    createCodecWorker({ init: vi.fn() });

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'unknown', id: 5, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages).toHaveLength(1);
    expect(mockCtx._messages[0].data).toEqual({
      id: 5,
      success: false,
      error: 'Unknown message type: unknown',
    });
  });

  it('sends error response when handler throws', async () => {
    createCodecWorker({
      init: vi.fn(),
      decode: vi.fn().mockRejectedValue(new Error('Decode failed')),
    });

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'decode', id: 10, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages).toHaveLength(1);
    expect(mockCtx._messages[0].data).toEqual({
      id: 10,
      success: false,
      error: 'Decode failed',
    });
  });

  it('detects transferables in result with TypedArray', async () => {
    const buffer = new ArrayBuffer(16);
    const data = new Uint8Array(buffer);

    createCodecWorker({
      init: vi.fn(),
      encode: vi.fn().mockResolvedValue(data),
    });

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'encode', id: 1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages[0].transfer).toEqual([buffer]);
  });

  it('detects transferables in result object with nested TypedArray', async () => {
    const buffer = new ArrayBuffer(32);
    const result = {
      data: new Uint16Array(buffer),
      width: 4,
      height: 4,
    };

    createCodecWorker({
      init: vi.fn(),
      decode: vi.fn().mockResolvedValue(result),
    });

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'decode', id: 1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages[0].transfer).toEqual([buffer]);
  });
});
