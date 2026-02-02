# jCodecs

Browser-native image codecs powered by WebAssembly.

## Features

- **AVIF Encoder & Decoder** - High-performance encoding/decoding via libavif + aom/dav1d
- **HDR Support** - 8, 10, 12-bit with full HDR metadata (PQ, HLG, color primaries)
- **Multi-threaded** - Optional SharedArrayBuffer-based parallelism (up to 8 threads)
- **Web Workers** - Non-blocking processing via configurable Worker Pools
- **TypeScript** - Full type definitions included
- **Tree-shakeable** - Import only what you need

## Installation

```bash
npm install @jcodecs/avif
# or
pnpm add @jcodecs/avif
```

## Usage Scenarios

### Scenario 1: Direct Usage (No Workers)

Simple, blocking API for quick tasks:

```typescript
import { decode, encode } from '@jcodecs/avif';

// Decode AVIF
const response = await fetch('image.avif');
const avifData = new Uint8Array(await response.arrayBuffer());
const decoded = await decode(avifData);

console.log(decoded.width, decoded.height);
console.log(decoded.metadata.isHDR);

// Encode to AVIF
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d')!;
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

const encoded = await encode(imageData, {
  quality: 80,
  speed: 6,
});

// Download
const blob = new Blob([encoded], { type: 'image/avif' });
const url = URL.createObjectURL(blob);
```

**When to use:**
- Simple one-off encoding/decoding
- Small images
- Non-critical path (acceptable to block main thread briefly)

---

### Scenario 2: Worker Pool - Combined (Encoder + Decoder)

Single worker pool for both encoding and decoding:

```typescript
import {
  createWorkerPool,
  encodeInWorker,
  decodeInWorker,
  terminateWorkerPool
} from '@jcodecs/avif';

// Create combined pool (both encoder and decoder)
const workerPool = await createWorkerPool({
  poolSize: 2,           // Number of workers
  preferMT: true,        // Use multi-threaded WASM if available
});

// Decode multiple images in parallel
const images = [img1, img2, img3];
const decoded = await Promise.all(
  images.map(img => decodeInWorker(workerPool, img))
);

// Encode
const encoded = await encodeInWorker(workerPool, imageData, {
  quality: 85,
  maxThreads: 8,  // Auto-clamped to available threads
});

// Cleanup
terminateWorkerPool(workerPool);
```

**When to use:**
- Need both encoding and decoding
- Medium workload
- Want to keep worker count low

**Configuration:**
- `poolSize`: Number of workers (default: `navigator.hardwareConcurrency / 2`)
- `preferMT`: Use multi-threaded WASM modules (requires SharedArrayBuffer)
- `lazyInit`: Delay WASM initialization until first call

---

### Scenario 3: Separate Worker Pools (Recommended)

Different pools for encoding and decoding with optimal configurations:

```typescript
import { createWorkerPool, encodeInWorker, decodeInWorker } from '@jcodecs/avif';

// Decoder: Multi-threaded WASM + small worker pool (for parallel images)
const decoderPool = await createWorkerPool({
  type: 'decoder',
  poolSize: 4,        // 4 workers for parallel decoding
  preferMT: true,     // Each worker uses multi-threaded WASM
});

// Encoder: Multi-threaded WASM + single worker (encoder already multi-threaded internally)
const encoderPool = await createWorkerPool({
  type: 'encoder',
  poolSize: 1,        // Single worker (aom encoder is multi-threaded)
  preferMT: true,     // Use multi-threaded WASM
  lazyInit: true,     // Initialize only when first used
});

// Decode multiple images in parallel (4 at a time)
const results = await Promise.all(
  images.map(img => decodeInWorker(decoderPool, img, { maxThreads: 4 }))
);

// Encode with all available threads
const encoded = await encodeInWorker(encoderPool, imageData, {
  quality: 90,
  maxThreads: 8,      // Use all 8 threads for fast encoding
});

// Cleanup
terminateWorkerPool(decoderPool);
terminateWorkerPool(encoderPool);
```

**When to use:**
- Heavy workloads (batch processing, image galleries)
- Need to optimize separately for encoding vs decoding
- Want maximum performance

**Decoder strategy:**
- `preferMT: true` + `poolSize: 4-8` = Decode multiple images in parallel, each using multi-threading

**Encoder strategy:**
- `preferMT: true` + `poolSize: 1` = Single encoder instance using all available threads

---

### Scenario 4: Dynamic Configuration

Adapt to user's hardware:

```typescript
import { createWorkerPool, isMultiThreadSupported } from '@jcodecs/avif';

const isMTAvailable = isMultiThreadSupported(); // Check SharedArrayBuffer

const config = isMTAvailable
  ? {
      poolSize: 2,
      preferMT: true,  // Multi-threaded WASM
    }
  : {
      poolSize: Math.min(navigator.hardwareConcurrency, 4),  // More workers
      preferMT: false,  // Single-threaded WASM
    };

const pool = await createWorkerPool(config);
```

---

## API Reference

### Decoding

#### `decode(data, options?, config?)`

Decode AVIF to raw pixel data.

```typescript
const result = await decode(avifBytes, {
  bitDepth: 0,        // 0=auto (preserve original), 8/10/12/16=convert
  maxThreads: 8,      // Max threads (auto-clamped to 8)
});

// result.data is Uint8Array (8-bit) or Uint16Array (>8-bit)
// result.metadata contains HDR info, color space, etc.
```

#### `decodeToImageData(data, options?)`

Decode AVIF directly to Canvas ImageData (8-bit sRGB).

```typescript
const imageData = await decodeToImageData(avifBytes);
ctx.putImageData(imageData, 0, 0);
```

#### `getImageInfo(data)`

Read metadata without decoding pixels.

```typescript
const info = await getImageInfo(avifBytes);
console.log(info.width, info.height, info.bitDepth);
console.log(info.metadata.isHDR);
```

---

### Encoding

#### `encode(imageData, options?, config?)`

Encode ImageData to AVIF format.

```typescript
const avifBytes = await encode(imageData, {
  quality: 75,               // 0-100 (default: 75)
  qualityAlpha: 100,         // Alpha quality (default: 100)
  speed: 6,                  // 0-10, faster=larger (default: 6)
  bitDepth: 8,               // 8, 10, or 12 (default: 8)
  chromaSubsampling: '4:2:0', // '4:4:4', '4:2:2', '4:2:0', '4:0:0'
  transferFunction: 'srgb',  // 'srgb', 'pq', 'hlg', 'linear'
  colorSpace: 'srgb',        // 'srgb', 'display-p3', 'rec2020'
  lossless: false,           // Lossless encoding
  maxThreads: 8,             // Max threads (default: 0=auto)
});
```

**HDR Encoding:**

```typescript
// Encode HDR image (10-bit PQ Rec.2020)
const hdrAvif = await encode(hdrImageData, {
  bitDepth: 10,
  transferFunction: 'pq',
  colorSpace: 'rec2020',
  chromaSubsampling: '4:4:4',  // No chroma subsampling for HDR
  quality: 90,
});
```

---

### Worker Pool API

#### `createWorkerPool(config?)`

Create a worker pool for non-blocking operations.

```typescript
interface WorkerPoolConfig {
  poolSize?: number;           // Number of workers (default: navigator.hardwareConcurrency / 2)
  workerUrl?: string | URL;    // Custom worker script URL
  preferMT?: boolean;          // Use multi-threaded WASM (default: false)
  type?: 'decoder' | 'encoder' | 'both';  // Which modules to load (default: 'both')
  lazyInit?: boolean;          // Delay initialization (default: false)
}
```

#### `encodeInWorker(pool, imageData, options?)`

Encode in worker pool.

```typescript
const encoded = await encodeInWorker(pool, imageData, {
  quality: 80,
  maxThreads: 8,
});
```

#### `decodeInWorker(pool, data, options?)`

Decode in worker pool.

```typescript
const decoded = await decodeInWorker(pool, avifBytes, {
  maxThreads: 4,
});
```

#### `terminateWorkerPool(pool)`

Cleanup worker pool.

```typescript
terminateWorkerPool(pool);
```

---

## Threading & Performance

### Thread Limits

**Maximum threads:** 8 (defined at compile-time via `PTHREAD_POOL_SIZE`)

- If you specify `maxThreads > 8`, it will be auto-clamped to 8 with a warning
- Default `maxThreads: 0` lets libavif auto-select based on image size and hardware

**Why 8 threads?**
- dav1d (decoder): optimal at 4-8 threads
- aom (encoder): good performance up to 8 threads
- Higher thread counts have diminishing returns and increased overhead

### Multi-threading Requirements

Multi-threaded WASM requires:
1. `SharedArrayBuffer` support
2. HTTP headers: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`

Check support:
```typescript
import { isMultiThreadSupported } from '@jcodecs/avif';

if (isMultiThreadSupported()) {
  // Can use preferMT: true
}
```

### Performance Tips

1. **For decoding many images:** Use `preferMT: true` + `poolSize: 4-8`
2. **For encoding large images:** Use `preferMT: true` + `poolSize: 1` + `maxThreads: 8`
3. **For small images:** Use direct API (no workers) or single-threaded WASM
4. **Lazy init:** Set `lazyInit: true` if encoder/decoder might not be used

---

## Building from Source

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker

### Build Steps

```bash
# Clone repository
git clone https://github.com/you/jcodecs.git
cd jcodecs

# Install dependencies
pnpm install

# Full build (WASM + TypeScript)
pnpm build

# Or step by step:
pnpm build:wasm    # Build WASM modules via Docker
pnpm build:ts      # Build TypeScript

# Run tests
pnpm test
pnpm test:browser  # Browser tests (requires built WASM)
```

---

## Project Structure

```
jCodecs/
├── packages/
│   ├── core/              # @jcodecs/core - Shared utilities
│   │   └── src/
│   │       ├── worker-pool.ts           # Generic worker pool
│   │       ├── codec-worker.ts          # Worker helper
│   │       └── codec-worker-client.ts   # Main thread helper
│   └── avif/              # @jcodecs/avif - AVIF codec
│       ├── src/
│       │   ├── wasm/                    # C++ + compiled WASM
│       │   │   ├── avif_dec.cpp         # Decoder
│       │   │   ├── avif_enc.cpp         # Encoder
│       │   │   └── CMakeLists.txt       # Build config
│       │   ├── decode.ts                # Decode API
│       │   ├── encode.ts                # Encode API
│       │   ├── worker.ts                # Worker implementation
│       │   └── worker-api.ts            # Worker pool API
│       └── tests/
├── examples/
│   └── browser-esm/       # Browser demo
├── Dockerfile             # Multi-stage WASM build
└── turbo.json             # Monorepo config
```

---

## Roadmap

- [x] AVIF decoder (libavif + dav1d)
- [x] AVIF encoder (libavif + aom)
- [x] HDR metadata support (PQ, HLG, Rec.2020)
- [x] Multi-threaded encoding/decoding
- [x] Web Workers API with configurable pools
- [ ] JPEG-XL codec
- [ ] WebP codec
- [ ] OpenEXR codec

---

## License

MIT

## Credits

Built with:
- [libavif](https://github.com/AOMediaCodec/libavif) - AVIF library
- [dav1d](https://code.videolan.org/videolan/dav1d) - AV1 decoder
- [aom](https://aomedia.googlesource.com/aom) - AV1 encoder
- [Emscripten](https://emscripten.org/) - WASM compiler
