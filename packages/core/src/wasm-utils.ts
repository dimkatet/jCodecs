/**
 * WASM utility functions (standalone, not class-based)
 *
 * These are simple functions for common WASM memory operations.
 * For more advanced use cases with memory growth tracking, use WASMMemoryManager.
 */

import type { WASMModule } from "./memory";

/**
 * Copy TypedArray data to WASM heap and return pointer.
 * Supports Uint8Array and Uint16Array.
 *
 * @param module - WASM module with _malloc and HEAPU8
 * @param data - Data to copy
 * @returns Pointer to allocated memory (caller must free!)
 */
export function copyToWasm(
  module: Pick<WASMModule, '_malloc' | 'HEAPU8'>,
  data: Uint8Array | Uint16Array,
): number {
  const byteLength =
    data instanceof Uint16Array ? data.byteLength : data.length;
  const ptr = module._malloc(byteLength);

  if (ptr === 0) {
    throw new Error(`Failed to allocate ${byteLength} bytes in WASM memory`);
  }

  if (data instanceof Uint16Array) {
    module.HEAPU8.set(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      ptr,
    );
  } else {
    module.HEAPU8.set(data, ptr);
  }

  return ptr;
}

/**
 * Copy data from WASM heap to a new Uint8Array.
 * Always creates a copy (safe against detached buffers).
 *
 * @param module - WASM module with HEAPU8
 * @param ptr - Pointer to WASM memory
 * @param size - Number of bytes to copy
 */
export function copyFromWasm(
  module: Pick<WASMModule, 'HEAPU8'>,
  ptr: number,
  size: number,
): Uint8Array {
  const result = new Uint8Array(size);
  result.set(new Uint8Array(module.HEAPU8.buffer, ptr, size));
  return result;
}

/**
 * Copy data from WASM heap as Uint16Array.
 *
 * @param module - WASM module with HEAPU8
 * @param ptr - Pointer to WASM memory (byte offset)
 * @param length - Number of Uint16 elements (not bytes!)
 */
export function copyFromWasm16(
  module: Pick<WASMModule, 'HEAPU8'>,
  ptr: number,
  length: number,
): Uint16Array {
  const result = new Uint16Array(length);
  result.set(new Uint16Array(module.HEAPU8.buffer, ptr, length));
  return result;
}

/**
 * Execute a function with allocated WASM memory, then free it.
 * Provides safe cleanup pattern (RAII-style).
 *
 * @param module - WASM module
 * @param data - Data to copy to WASM
 * @param fn - Function to execute with pointer
 */
export async function withWasmBuffer<T>(
  module: Pick<WASMModule, '_malloc' | 'HEAPU8' | '_free'>,
  data: Uint8Array | Uint16Array,
  fn: (ptr: number, byteLength: number) => T | Promise<T>,
): Promise<T> {
  const ptr = copyToWasm(module, data);
  const byteLength =
    data instanceof Uint16Array ? data.byteLength : data.length;

  try {
    return await fn(ptr, byteLength);
  } finally {
    module._free(ptr);
  }
}
