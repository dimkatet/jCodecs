import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCodecWorker } from '../src/worker';

// ─── helpers ─────────────────────────────────────────────────────────────────

function createMockWorkerContext() {
  const listeners: Map<string, ((e: { data: unknown }) => void)[]> = new Map();
  const messages: { data: unknown; transfer?: Transferable[] }[] = [];

  return {
    addEventListener: (type: string, handler: (e: { data: unknown }) => void) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    postMessage: (data: unknown, transfer?: Transferable[]) => {
      messages.push({ data, transfer });
    },
    _dispatch: (type: string, data: unknown) => {
      for (const handler of listeners.get(type) ?? []) handler({ data });
    },
    _messages: messages,
  };
}

// ─── Browser (WorkerGlobalScope) path ────────────────────────────────────────

describe('createCodecWorker (browser path)', () => {
  let mockCtx: ReturnType<typeof createMockWorkerContext>;

  beforeEach(() => {
    mockCtx = createMockWorkerContext();
    (globalThis as any).WorkerGlobalScope = class WorkerGlobalScope {};
    (globalThis as any).self = mockCtx;
  });

  afterEach(() => {
    delete (globalThis as any).WorkerGlobalScope;
    delete (globalThis as any).self;
  });

  it('sends "loaded" on creation', () => {
    createCodecWorker({ init: vi.fn() });

    expect(mockCtx._messages).toHaveLength(1);
    expect(mockCtx._messages[0].data).toEqual({ type: 'loaded' });
  });

  it('calls init handler and sends "ready"', async () => {
    const initFn = vi.fn();
    createCodecWorker({ init: initFn });
    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: { foo: 'bar' } });
    await new Promise((r) => setTimeout(r, 0));

    expect(initFn).toHaveBeenCalledWith({ foo: 'bar' });
    expect(mockCtx._messages).toHaveLength(1);
    expect(mockCtx._messages[0].data).toEqual({ type: 'ready' });
  });

  it('rejects non-init messages before initialization', async () => {
    createCodecWorker({ init: vi.fn(), decode: vi.fn() });
    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'decode', id: 1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages[0].data).toEqual({
      id: 1,
      success: false,
      error: 'Worker not initialized. Call init() first.',
    });
  });

  it('dispatches to correct handler and returns result', async () => {
    const decodeFn = vi.fn().mockResolvedValue({ width: 100, height: 100 });
    createCodecWorker({ init: vi.fn(), decode: decodeFn });

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));
    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'decode', id: 42, payload: { data: 'test' } });
    await new Promise((r) => setTimeout(r, 0));

    expect(decodeFn).toHaveBeenCalledWith({ data: 'test' });
    expect(mockCtx._messages[0].data).toEqual({
      id: 42,
      success: true,
      data: { width: 100, height: 100 },
    });
  });

  it('sends error on unknown message type', async () => {
    createCodecWorker({ init: vi.fn() });
    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));
    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'unknown', id: 5, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages[0].data).toEqual({
      id: 5,
      success: false,
      error: 'Unknown message type: unknown',
    });
  });

  it('sends error when handler throws', async () => {
    createCodecWorker({
      init: vi.fn(),
      decode: vi.fn().mockRejectedValue(new Error('Decode failed')),
    });

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));
    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'decode', id: 10, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages[0].data).toEqual({
      id: 10,
      success: false,
      error: 'Decode failed',
    });
  });

  it('detects transferables in TypedArray result', async () => {
    const buffer = new ArrayBuffer(16);
    createCodecWorker({ init: vi.fn(), encode: vi.fn().mockResolvedValue(new Uint8Array(buffer)) });

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));
    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'encode', id: 1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages[0].transfer).toEqual([buffer]);
  });

  it('detects transferables in nested result object', async () => {
    const buffer = new ArrayBuffer(32);
    createCodecWorker({
      init: vi.fn(),
      decode: vi.fn().mockResolvedValue({ data: new Uint16Array(buffer), width: 4, height: 4 }),
    });

    mockCtx._dispatch('message', { type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));
    mockCtx._messages.length = 0;

    mockCtx._dispatch('message', { type: 'decode', id: 1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCtx._messages[0].transfer).toEqual([buffer]);
  });
});

// ─── Node.js (parentPort) path ────────────────────────────────────────────────

const { mockParentPort } = vi.hoisted(() => {
  const messages: { data: unknown; transfer?: Transferable[] }[] = [];
  const listeners: ((data: unknown) => void)[] = [];

  const mockParentPort = {
    postMessage: (data: unknown, transfer?: Transferable[]) => messages.push({ data, transfer }),
    on: (event: string, handler: (data: unknown) => void) => {
      if (event === 'message') listeners.push(handler);
    },
    get _messages() { return messages; },
    /** Reset everything between tests (beforeEach). */
    _reset: () => { messages.length = 0; listeners.length = 0; },
    /** Clear only recorded messages — keeps listeners intact. */
    _clearMessages: () => { messages.length = 0; },
    _dispatch: (data: unknown) => listeners.forEach((fn) => fn(data)),
  };

  return { mockParentPort };
});

vi.mock('node:worker_threads', () => ({ parentPort: mockParentPort }));

describe('createCodecWorker (Node.js path)', () => {
  beforeEach(() => {
    // Ensure WorkerGlobalScope is absent so the Node.js branch is taken
    delete (globalThis as any).WorkerGlobalScope;
    mockParentPort._reset();
  });

  it('sends "loaded" via parentPort on creation', async () => {
    createCodecWorker({ init: vi.fn() });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockParentPort._messages).toHaveLength(1);
    expect(mockParentPort._messages[0].data).toEqual({ type: 'loaded' });
  });

  it('calls init handler and sends "ready" via parentPort', async () => {
    const initFn = vi.fn();
    createCodecWorker({ init: initFn });
    await new Promise((r) => setTimeout(r, 0));
    mockParentPort._clearMessages();

    mockParentPort._dispatch({ type: 'init', id: -1, payload: { x: 1 } });
    await new Promise((r) => setTimeout(r, 0));

    expect(initFn).toHaveBeenCalledWith({ x: 1 });
    expect(mockParentPort._messages[0].data).toEqual({ type: 'ready' });
  });

  it('dispatches to handler and returns result via parentPort', async () => {
    const decodeFn = vi.fn().mockResolvedValue({ width: 64, height: 64 });
    createCodecWorker({ init: vi.fn(), decode: decodeFn });
    await new Promise((r) => setTimeout(r, 0));

    mockParentPort._dispatch({ type: 'init', id: -1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));
    mockParentPort._clearMessages();

    mockParentPort._dispatch({ type: 'decode', id: 7, payload: { data: 'buf' } });
    await new Promise((r) => setTimeout(r, 0));

    expect(decodeFn).toHaveBeenCalledWith({ data: 'buf' });
    expect(mockParentPort._messages[0].data).toEqual({
      id: 7,
      success: true,
      data: { width: 64, height: 64 },
    });
  });
});
