# @jcodecs/core

Shared utilities for jCodecs packages.

## Installation

```bash
npm install @jcodecs/core
```

> Note: This package is installed automatically as a dependency of codec packages.

## Features

- **DataType System** - Type-safe pixel data handling (uint8, uint16, float16, float32)
- **WASM Memory Utils** - Efficient copy to/from WASM heap
- **Worker Pool** - Generic worker pool for non-blocking operations
- **Thread Utilities** - Multi-threading support detection and validation

## API

### Types

```typescript
import type { DataType, ExtendedImageData } from '@jcodecs/core';

// Supported pixel data types
type DataType = 'uint8' | 'uint16' | 'float16' | 'float32';

// Generic image data with typed pixel array
interface ExtendedImageData<TDataType extends DataType, TMeta> {
  data: TypedArrayForDataType<TDataType>;  // Typed array matching dataType
  dataType: TDataType;
  bitDepth: number;
  width: number;
  height: number;
  channels: number;
  metadata: TMeta;
}
```

### Multi-threading

```typescript
import { isMultiThreadSupported, validateThreadCount } from '@jcodecs/core';

// Check SharedArrayBuffer support
if (isMultiThreadSupported()) {
  // Can use multi-threaded WASM modules
}

// Validate and clamp thread count
const result = validateThreadCount(
  requestedThreads,
  maxAllowed,
  isMultiThreadedModule,
  'codec-name'
);
if (result.warning) console.warn(result.warning);
const safeThreadCount = result.validatedCount;
```

### WASM Memory Utilities

```typescript
import {
  copyToWasm,
  copyToWasm16f,
  copyToWasm32f,
  copyFromWasm,
  copyFromWasm16,
  copyFromWasm16f,
  copyFromWasm32f,
  copyFromWasmByType,
} from '@jcodecs/core';

// Copy to WASM heap (returns pointer, caller must free)
const ptr = copyToWasm(module, uint8Data);
const ptr16f = copyToWasm16f(module, float16Data);
const ptr32f = copyToWasm32f(module, float32Data);

// Copy from WASM heap
const uint8 = copyFromWasm(module, ptr, length);
const uint16 = copyFromWasm16(module, ptr, length);
const float16 = copyFromWasm16f(module, ptr, length);
const float32 = copyFromWasm32f(module, ptr, length);

// Type-safe copy with inference
const data = copyFromWasmByType(module, ptr, length, 'float16'); // → Float16Array
```

### Worker Pool

```typescript
import { WorkerPool } from '@jcodecs/core';

const pool = new WorkerPool({
  size: 4,
  workerUrl: new URL('./worker.js', import.meta.url),
});

// Execute task in pool
const result = await pool.execute(taskData);

// Cleanup
pool.terminate();
```

## TypedArray Mapping

| DataType | TypedArray |
|----------|------------|
| `'uint8'` | `Uint8Array` |
| `'uint16'` | `Uint16Array` |
| `'float16'` | `Float16Array` |
| `'float32'` | `Float32Array` |

## Requirements

- **Float16Array**: Requires browser/runtime support for `Float16Array`
- **Multi-threading**: Requires `SharedArrayBuffer` and COOP/COEP headers

## License

MIT
