# @dimkatet/jcodecs-core

Shared types, WASM memory utilities, and worker pool for jCodecs packages.

> This package is installed automatically as a dependency of codec packages. You typically don't need to install it directly.

## Installation

```bash
npm install @dimkatet/jcodecs-core
```

## ImageDescriptor

The core type of the entire library. All codecs return `{ data: TypedArray; descriptor: ImageDescriptor }`.

```typescript
interface ImageDescriptor {
  // Always present
  geometry: GeometryInfo;    // width, height, orientation?, pixelAspectRatio?
  channels: ChannelsInfo;    // model, count, channels[]?
  numeric:  NumericInfo;     // sampleType, dataType, bitDepth, endianness?

  // Optional
  color?:    ColorInfo;      // primaries, whitePoint, matrix, custom*
  transfer?: TransferInfo;   // function, gammaValue, customCurve
  luminance?: LuminanceInfo; // reference, diffuseWhite, peakBrightness, minBrightness
  sampling?: SamplingInfo;   // layout, chromaSubsampling, chromaSamplePosition
  alpha?:    AlphaInfo;      // mode, colorSpace, matteColor
  hdr?:      HDRMetadata;    // maxCLL, maxPALL, masteringDisplay, toneMappingHint
  rendering?: RenderingInfo; // intent, domain
  iccProfile?: Uint8Array;
  formatSpecific?: unknown;  // Codec-specific (e.g. EXRFormatSpecific)
}
```

### Key enum types

```typescript
type ChannelModel     = 'rgb' | 'rgba' | 'gray' | 'graya' | 'ycbcr' | 'ycbcra' | 'cmyk' | 'xyz' | 'lab' | 'custom';
type DataType         = 'uint8' | 'uint16' | 'float16' | 'float32';
type SampleType       = 'uint' | 'sint' | 'float';
type ColorPrimaries   = 'bt709' | 'bt2020' | 'displayP3' | 'dciP3' | 'aces' | ...;
type TransferFunction = 'linear' | 'srgb' | 'bt709' | 'pq' | 'hlg' | 'gamma' | ...;
type ChromaSubsampling = '444' | '422' | '420' | '400';
type SampleLayout     = 'interleaved' | 'planar' | 'semiPlanar';
type AlphaMode        = 'none' | 'straight' | 'premultiplied';
type LuminanceReference = 'sdr' | 'hdr';
```

### HDRMetadata

```typescript
interface HDRMetadata {
  maxCLL?: number;               // Maximum Content Light Level (nits)
  maxPALL?: number;              // Maximum Picture Average Light Level (nits)
  masteringDisplay?: {
    primaries: { red: [x, y]; green: [x, y]; blue: [x, y] };
    whitePoint: [x, y];
    luminance: { min: number; max: number };
  };
  toneMappingHint?: 'none' | 'clip' | 'reinhard' | 'filmic' | 'aces' | 'custom';
}
```

## CodecImageData

The return type of all `decode()` functions:

```typescript
interface CodecImageData {
  data: Uint8Array | Uint16Array | Float16Array | Float32Array;
  descriptor: ImageDescriptor;
}
```

## Multi-threading

```typescript
import { isMultiThreadSupported, validateThreadCount } from '@dimkatet/jcodecs-core';

// Check SharedArrayBuffer availability
if (isMultiThreadSupported()) {
  // Can use preferMT: true and maxThreads > 1
}

// Clamp thread count to prevent deadlock
const { validatedCount, warning } = validateThreadCount(
  requestedThreads,  // user-requested count
  maxAllowed,        // PTHREAD_POOL_SIZE (8)
  isMultiThreadedModule,
  'codec-name',
);
if (warning) console.warn(warning);
```

Multi-threading requires HTTP headers:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## WASM Memory Utilities

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
  withWasmBuffer,
} from '@dimkatet/jcodecs-core';

// Copy to WASM heap — returns pointer (caller must free)
const ptr = copyToWasm(module, uint8Data);
const ptr16f = copyToWasm16f(module, float16Data);
const ptr32f = copyToWasm32f(module, float32Data);

// Copy from WASM heap
const uint8   = copyFromWasm(module, ptr, len);
const uint16  = copyFromWasm16(module, ptr, len);
const float16 = copyFromWasm16f(module, ptr, len);
const float32 = copyFromWasm32f(module, ptr, len);

// Type-safe copy — return type inferred from DataType
const data = copyFromWasmByType(module, ptr, len, 'float16'); // → Float16Array

// RAII helper — auto-frees pointer after callback
const result = await withWasmBuffer(module, data, (ptr, len) => {
  return module.processData(ptr, len);
});
```

## TypedArray Mapping

| `DataType` | `TypedArray` |
|------------|--------------|
| `'uint8'` | `Uint8Array` |
| `'uint16'` | `Uint16Array` |
| `'float16'` | `Float16Array` |
| `'float32'` | `Float32Array` |

## Worker Pool

Used internally by all codec packages. You can also use it directly for custom workers:

```typescript
import { WorkerPool } from '@dimkatet/jcodecs-core';

const pool = new WorkerPool({
  size: 4,
  workerUrl: new URL('./worker.js', import.meta.url),
});

const result = await pool.execute(taskData);
pool.terminate();
```

## Exports

```typescript
// Main entry point
import { ... } from '@dimkatet/jcodecs-core';

// Worker-side handler (for codec worker implementations)
import { createCodecWorker } from '@dimkatet/jcodecs-core/codec-worker';

// Client-side pool (for codec packages)
import { CodecWorkerClient } from '@dimkatet/jcodecs-core/codec-worker-client';
```

## Requirements

- **Node.js / Browser**: `Float16Array` support required for float16 data
- **Multi-threading**: `SharedArrayBuffer` + COOP/COEP headers

## License

MIT
