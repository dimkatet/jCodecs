/**
 * Generic codec worker factory.
 *
 * Sets up a message listener that dispatches incoming messages to the provided
 * handlers, manages init/ready handshake, and auto-detects transferables.
 *
 * Supports both browser Web Workers (via `self` / WorkerGlobalScope) and
 * Node.js Worker Threads (via `parentPort` from node:worker_threads).
 */

import {
  CodecWorkerHandlers,
  RefineHandlers,
  WorkerInboundMessage,
} from "./protocol";

/**
 * Walk a result object one level deep, collecting ArrayBuffer instances
 * for use as transferables in postMessage.
 */
function collectTransferables(result: unknown): Transferable[] {
  if (result == null || typeof result !== "object") {
    return [];
  }

  const buffers = new Set<ArrayBuffer | ArrayBufferLike>();

  if (result instanceof ArrayBuffer) {
    buffers.add(result);
  } else if (ArrayBuffer.isView(result)) {
    buffers.add(result.buffer);
  } else {
    for (const value of Object.values(result as Record<string, unknown>)) {
      if (value instanceof ArrayBuffer) {
        buffers.add(value);
      } else if (ArrayBuffer.isView(value)) {
        buffers.add(value.buffer);
      }
    }
  }

  return [...buffers];
}

type SendFn = (msg: unknown, transferables?: Transferable[]) => void;

/**
 * Creates the message handler used by both browser and Node.js worker contexts.
 * Parameterized by a `send` function so the transport layer can be swapped.
 */
function createMessageHandler<H extends CodecWorkerHandlers>(
  handlers: RefineHandlers<H>,
  send: SendFn,
): (e: { data: WorkerInboundMessage<RefineHandlers<H>> }) => void {
  let initialized = false;

  return async (e) => {
    const { type, id, payload } = e.data;

    try {
      if (type === "init") {
        await handlers.init(payload);
        initialized = true;
        send({ type: "ready" });
        return;
      }

      if (!initialized) {
        throw new Error("Worker not initialized. Call init() first.");
      }

      const handler = handlers[type];
      if (!handler) {
        throw new Error(`Unknown message type: ${type}`);
      }

      const result = await handler(payload);
      const transferables = collectTransferables(result);
      send({ id, success: true, data: result }, transferables);
    } catch (error) {
      send({
        id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/**
 * Create a codec worker that listens for messages and dispatches to handlers.
 *
 * Protocol:
 * - On load: sends { type: 'loaded' }
 * - On 'init' message: calls handlers.init(payload), then sends { type: 'ready' }
 * - On other messages: calls handlers[type](payload), sends { id, success, data }
 *   with auto-detected transferables
 * - On error: sends { id, success: false, error }
 *
 * Works in both browser Web Workers and Node.js Worker Threads.
 */
export function createCodecWorker<H extends CodecWorkerHandlers>(
  handlers: RefineHandlers<H>,
): void {
  // Browser Web Worker: WorkerGlobalScope is defined in browser worker contexts
  if (typeof WorkerGlobalScope !== "undefined") {
    const ctx = self as unknown as DedicatedWorkerGlobalScope;
    const send: SendFn = (msg, tx) => ctx.postMessage(msg, tx ?? []);
    ctx.addEventListener(
      "message",
      createMessageHandler(handlers, send),
    );
    ctx.postMessage({ type: "loaded" });
    return;
  }

  // Node.js Worker Thread: use parentPort via async IIFE.
  // Node.js MessagePort queues messages at the native level until a listener
  // is attached, so the 'init' message sent by the pool won't be lost.
  void (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { parentPort } = (await import("node:worker_threads")) as any;
    if (!parentPort)
      throw new Error(
        "createCodecWorker: not in a worker thread (parentPort is null)",
      );

    const send: SendFn = (msg, tx) => parentPort.postMessage(msg, tx ?? []);
    const handler = createMessageHandler(handlers, send);
    parentPort.on("message", (data: unknown) => handler({ data } as any));
    parentPort.postMessage({ type: "loaded" });
  })();
}
