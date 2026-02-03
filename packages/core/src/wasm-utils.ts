/**
 * WASM utility functions (standalone, not class-based)
 *
 * These are simple functions for common WASM memory operations.
 * For more advanced use cases with memory growth tracking, use WASMMemoryManager.
 */

import type { WASMModule } from "./memory";
import type { DataType } from "./types";

/**
 * Maps DataType to corresponding TypedArray type
 */
type TypedArrayForDataType<T extends DataType> =
  T extends 'uint8' ? Uint8Array :
  T extends 'uint16' ? Uint16Array :
  T extends 'float16' ? Float16Array :
  T extends 'float32' ? Float32Array :
  never;

/**
 * Copy Float32Array data to WASM heap.
 * @param module - WASM module
 * @param data - Float32Array to copy
 * @returns Pointer to allocated memory (caller must free!)
 */
export function copyToWasm32f(
  module: Pick<WASMModule, '_malloc' | 'HEAPU8'>,
  data: Float32Array,
): number {
  const size = data.byteLength;
  const ptr = module._malloc(size);

  if (ptr === 0) {
    throw new Error(`Failed to allocate ${size} bytes in WASM memory`);
  }

  const heap = new Float32Array(module.HEAPU8.buffer, ptr, data.length);
  heap.set(data);
  return ptr;
}

/**
 * Copy Float16Array data to WASM heap.
 * @param module - WASM module
 * @param data - Float16Array to copy
 * @returns Pointer to allocated memory (caller must free!)
 */
export function copyToWasm16f(
  module: Pick<WASMModule, '_malloc' | 'HEAPU8'>,
  data: Float16Array,
): number {
  const size = data.byteLength;
  const ptr = module._malloc(size);

  if (ptr === 0) {
    throw new Error(`Failed to allocate ${size} bytes in WASM memory`);
  }

  const heap = new Float16Array(module.HEAPU8.buffer, ptr, data.length);
  heap.set(data);
  return ptr;
}

/**
 * Copy TypedArray data to WASM heap and return pointer.
 * Supports Uint8Array, Uint16Array, Float16Array, and Float32Array.
 *
 * @param module - WASM module with _malloc and HEAPU8
 * @param data - Data to copy
 * @returns Pointer to allocated memory (caller must free!)
 */
export function copyToWasm(
  module: Pick<WASMModule, '_malloc' | 'HEAPU8'>,
  data: Uint8Array | Uint16Array | Float16Array | Float32Array,
): number {
  if (data instanceof Float32Array) {
    return copyToWasm32f(module, data);
  }
  if (data instanceof Float16Array) {
    return copyToWasm16f(module, data);
  }

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
 * Copy data from WASM heap as Float32Array.
 *
 * @param module - WASM module with HEAPU8
 * @param ptr - Pointer to WASM memory (byte offset)
 * @param length - Number of Float32 elements (not bytes!)
 */
export function copyFromWasm32f(
  module: Pick<WASMModule, 'HEAPU8'>,
  ptr: number,
  length: number,
): Float32Array {
  const result = new Float32Array(length);
  result.set(new Float32Array(module.HEAPU8.buffer, ptr, length));
  return result;
}

/**
 * Copy data from WASM heap as Float16Array.
 *
 * @param module - WASM module with HEAPU8
 * @param ptr - Pointer to WASM memory (byte offset)
 * @param length - Number of Float16 elements (not bytes!)
 */
export function copyFromWasm16f(
  module: Pick<WASMModule, 'HEAPU8'>,
  ptr: number,
  length: number,
): Float16Array {
  const result = new Float16Array(length);
  result.set(new Float16Array(module.HEAPU8.buffer, ptr, length));
  return result;
}

/**
 * Copy data from WASM heap with automatic type detection.
 * Returns the correct TypedArray type based on dataType parameter.
 *
 * @param module - WASM module with HEAPU8
 * @param ptr - Pointer to WASM memory (byte offset)
 * @param length - Number of elements (not bytes!)
 * @param dataType - Data type string
 * @returns Typed array of the correct type
 */
export function copyFromWasmByType<T extends DataType>(
  module: Pick<WASMModule, 'HEAPU8'>,
  ptr: number,
  length: number,
  dataType: T,
): TypedArrayForDataType<T> {
  switch (dataType) {
    case 'float32':
      return copyFromWasm32f(module, ptr, length) as TypedArrayForDataType<T>;
    case 'float16':
      return copyFromWasm16f(module, ptr, length) as TypedArrayForDataType<T>;
    case 'uint16':
      return copyFromWasm16(module, ptr, length) as TypedArrayForDataType<T>;
    case 'uint8':
      return copyFromWasm(module, ptr, length) as TypedArrayForDataType<T>;
    default:
      throw new Error(`Unsupported dataType: ${dataType}`);
  }
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
