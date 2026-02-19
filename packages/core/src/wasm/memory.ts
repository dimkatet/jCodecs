/**
 * WASM Memory Manager
 *
 * Provides safe utilities for working with WASM memory,
 * preventing issues with detached ArrayBuffers after memory growth.
 */

export interface WASMModule {
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
}

/**
 * Safe wrapper for WASM memory operations
 */
export class WASMMemoryManager {
  private module: WASMModule;
  private lastMemorySize: number;

  constructor(module: WASMModule) {
    this.module = module;
    this.lastMemorySize = module.HEAPU8.byteLength;
  }

  /**
   * Check if WASM memory has grown (invalidates existing views)
   */
  private checkMemoryGrowth(): boolean {
    const currentSize = this.module.HEAPU8.byteLength;
    if (currentSize !== this.lastMemorySize) {
      this.lastMemorySize = currentSize;
      return true;
    }
    return false;
  }

  /**
   * Get fresh Uint8 view of WASM memory
   */
  getHeap8(): Uint8Array {
    this.checkMemoryGrowth();
    return this.module.HEAPU8;
  }

  /**
   * Get fresh Uint16 view of WASM memory
   */
  getHeap16(): Uint16Array {
    this.checkMemoryGrowth();
    return this.module.HEAPU16;
  }

  /**
   * Get fresh Uint32 view of WASM memory
   */
  getHeap32(): Uint32Array {
    this.checkMemoryGrowth();
    return this.module.HEAPU32;
  }

  /**
   * Get fresh Float32 view of WASM memory
   */
  getHeapF32(): Float32Array {
    this.checkMemoryGrowth();
    return this.module.HEAPF32;
  }

  /**
   * Allocate memory and run callback, then free
   */
  allocateWithCleanup<T>(
    size: number,
    callback: (ptr: number, heap: Uint8Array) => T
  ): T {
    const ptr = this.module._malloc(size);
    if (ptr === 0) {
      throw new Error(`Failed to allocate ${size} bytes in WASM memory`);
    }

    try {
      const heap = this.getHeap8();
      return callback(ptr, heap);
    } finally {
      this.module._free(ptr);
    }
  }

  /**
   * Copy data from WASM memory to a new JS ArrayBuffer
   * Always creates a copy to avoid detached buffer issues
   */
  copyFromWASM(ptr: number, size: number): Uint8Array {
    const heap = this.getHeap8();
    const copy = new Uint8Array(size);
    copy.set(heap.subarray(ptr, ptr + size));
    return copy;
  }

  /**
   * Copy data from WASM memory as Uint16Array
   */
  copyFromWASM16(ptr: number, length: number): Uint16Array {
    const heap = this.getHeap16();
    const startIndex = ptr / 2;
    const copy = new Uint16Array(length);
    copy.set(heap.subarray(startIndex, startIndex + length));
    return copy;
  }

  /**
   * Copy JS data to WASM memory
   */
  copyToWASM(data: Uint8Array, ptr: number): void {
    const heap = this.getHeap8();
    heap.set(data, ptr);
  }

  /**
   * Allocate and copy data to WASM, returns pointer
   * Caller is responsible for freeing memory!
   */
  allocateAndCopy(data: Uint8Array): number {
    const ptr = this.module._malloc(data.byteLength);
    if (ptr === 0) {
      throw new Error(`Failed to allocate ${data.byteLength} bytes`);
    }
    this.copyToWASM(data, ptr);
    return ptr;
  }

  /**
   * Free WASM memory
   */
  free(ptr: number): void {
    if (ptr !== 0) {
      this.module._free(ptr);
    }
  }
}

/**
 * FinalizationRegistry for automatic cleanup of WASM resources
 * when JS objects are garbage collected
 */
export class WASMResourceRegistry {
  private registry: FinalizationRegistry<{
    ptr: number;
    free: (ptr: number) => void;
  }>;
  private pointers = new Map<object, number>();

  constructor() {
    this.registry = new FinalizationRegistry((held) => {
      held.free(held.ptr);
    });
  }

  /**
   * Register a WASM resource for automatic cleanup
   */
  register(
    target: object,
    ptr: number,
    free: (ptr: number) => void
  ): void {
    this.pointers.set(target, ptr);
    this.registry.register(target, { ptr, free }, target);
  }

  /**
   * Explicitly free a resource (removes from registry)
   */
  unregister(target: object, free: (ptr: number) => void): void {
    const ptr = this.pointers.get(target);
    if (ptr !== undefined) {
      free(ptr);
      this.pointers.delete(target);
      this.registry.unregister(target);
    }
  }
}
