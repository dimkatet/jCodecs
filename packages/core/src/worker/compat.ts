/**
 * Cross-environment Worker compatibility layer.
 *
 * Normalizes Web Worker and Node.js Worker Threads APIs behind a single
 * WorkerLike interface, allowing WorkerPool to be used in both environments.
 */

/**
 * Normalized interface compatible with both Web Worker and Node.js Worker Thread.
 */
export interface WorkerLike {
  postMessage(data: unknown, transferables?: Transferable[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: 'message', handler: (e: { data: any }) => void): void;
  addEventListener(type: 'error', handler: (e: { message: string }) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeEventListener(type: 'message', handler: (e: { data: any }) => void): void;
  removeEventListener(type: 'error', handler: (e: { message: string }) => void): void;
  terminate(): void;
}

/**
 * Adapts a node:worker_threads Worker to the WorkerLike interface.
 *
 * Maps Node.js EventEmitter API (on/off) to addEventListener/removeEventListener,
 * and wraps raw message data into MessageEvent-like objects ({ data }).
 *
 * The worker parameter is typed as `any` to avoid a hard @types/node dependency.
 */
export class NodeWorkerAdapter implements WorkerLike {
  private msgListeners = new Map<Function, Function>();
  private errListeners = new Map<Function, Function>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private worker: any) {}

  postMessage(data: unknown, transferables?: Transferable[]): void {
    this.worker.postMessage(data, transferables);
  }

  addEventListener(type: 'message' | 'error', handler: Function): void {
    if (type === 'message') {
      const wrapped = (data: unknown) => handler({ data });
      this.msgListeners.set(handler, wrapped);
      this.worker.on('message', wrapped);
    } else {
      const wrapped = (err: Error) => handler({ message: err.message });
      this.errListeners.set(handler, wrapped);
      this.worker.on('error', wrapped);
    }
  }

  removeEventListener(type: 'message' | 'error', handler: Function): void {
    const map = type === 'message' ? this.msgListeners : this.errListeners;
    const wrapped = map.get(handler);
    if (wrapped) {
      this.worker.off(type, wrapped);
      map.delete(handler);
    }
  }

  terminate(): void {
    void this.worker.terminate();
  }
}
