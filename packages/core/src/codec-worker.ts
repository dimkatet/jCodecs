/**
 * Generic codec worker factory.
 *
 * Sets up a message listener on `self` that dispatches incoming messages
 * to the provided handlers, manages init/ready handshake, and
 * auto-detects transferables in responses.
 */

export type CodecWorkerHandlers = {
  init: (payload: unknown) => void | Promise<void>;
} & {
  [method: string]: (payload: unknown) => unknown | Promise<unknown>;
};

interface WorkerInboundMessage {
  type: string;
  id: number;
  payload: unknown;
}

/**
 * Walk a result object one level deep, collecting ArrayBuffer instances
 * for use as transferables in postMessage.
 */
function collectTransferables(result: unknown): Transferable[] {
  if (result == null || typeof result !== 'object') {
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

/**
 * Create a codec worker that listens for messages and dispatches to handlers.
 *
 * Protocol:
 * - On load: sends { type: 'loaded' }
 * - On 'init' message: calls handlers.init(payload), then sends { type: 'ready' }
 * - On other messages: calls handlers[type](payload), sends { id, success, data }
 *   with auto-detected transferables
 * - On error: sends { id, success: false, error }
 */
export function createCodecWorker(handlers: CodecWorkerHandlers): void {
  const ctx = self as unknown as Worker;
  let initialized = false;

  ctx.addEventListener(
    'message',
    async (e: MessageEvent<WorkerInboundMessage>) => {
      const { type, id, payload } = e.data;

      try {
        if (type === 'init') {
          await handlers.init(payload);
          initialized = true;
          ctx.postMessage({ type: 'ready' });
          return;
        }

        if (!initialized) {
          throw new Error('Worker not initialized. Call init() first.');
        }

        const handler = handlers[type];
        if (!handler) {
          throw new Error(`Unknown message type: ${type}`);
        }

        const result = await handler(payload);
        const transferables = collectTransferables(result);
        ctx.postMessage({ id, success: true, data: result }, transferables);
      } catch (error) {
        ctx.postMessage({
          id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  ctx.postMessage({ type: 'loaded' });
}
