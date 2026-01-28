# jCodecs

Browser-native image codecs powered by WebAssembly.

## Features

- **AVIF Decoder** - High-performance decoding via libavif + dav1d
- **HDR Support** - 8, 10, 12-bit with full HDR metadata (PQ, HLG, color primaries)
- **Multi-threaded** - Optional SharedArrayBuffer-based parallelism
- **Web Workers** - Non-blocking processing via Worker Pool
- **TypeScript** - Full type definitions included
- **Tree-shakeable** - Import only what you need

## Installation

```bash
npm install @jcodecs/avif
# or
pnpm add @jcodecs/avif
```

## Quick Start

```typescript
import { decode, decodeToImageData } from '@jcodecs/avif';

// Decode AVIF to raw pixel data with metadata
const response = await fetch('image.avif');
const avifData = new Uint8Array(await response.arrayBuffer());
const result = await decode(avifData);

console.log(result.width, result.height);
console.log(result.metadata.transferFunction); // "pq" | "hlg" | "srgb"
console.log(result.metadata.isHDR);

// Or decode directly to Canvas ImageData (8-bit sRGB)
const imageData = await decodeToImageData(avifData);
ctx.putImageData(imageData, 0, 0);
```

## API Reference

### Decode Options

```typescript
interface AVIFDecodeOptions {
  bitDepth?: 0 | 8 | 10 | 12 | 16;  // 0=auto (preserve original)
  useThreads?: boolean;              // default: true
  maxThreads?: number;               // 0=auto
}
```

### Decode Result

```typescript
interface AVIFImageData {
  data: Uint8Array | Uint16Array;  // Uint16Array for >8 bit
  width: number;
  height: number;
  bitDepth: number;
  metadata: {
    isHDR: boolean;
    transferFunction: 'srgb' | 'pq' | 'hlg';
    colorPrimaries: 'bt709' | 'bt2020' | 'p3';
    // ... ICC profile, CICP values, etc.
  };
}
```

### Web Workers API

For heavy workloads, use the Worker Pool to avoid blocking the main thread:

```typescript
import {
  initWorkerPool,
  decodeInWorker,
  terminateWorkerPool,
} from '@jcodecs/avif';

// Initialize worker pool (uses navigator.hardwareConcurrency by default)
await initWorkerPool({ poolSize: 4 });

// Decode multiple images in parallel
const results = await Promise.all(
  images.map(img => decodeInWorker(img))
);

// Cleanup when done
terminateWorkerPool();
```

### HDR Images

```typescript
import { decode, getImageInfo } from '@jcodecs/avif';

// Check if image is HDR before decoding
const info = await getImageInfo(avifData);
console.log('Is HDR:', info.isHDR);
console.log('Bit depth:', info.bitDepth);
console.log('Transfer:', info.transferFunction); // "pq" | "hlg" | "srgb"

// Decode preserving original bit depth
const hdrImage = await decode(avifData, { bitDepth: 0 });
// hdrImage.data is Uint16Array for >8 bit images
```

## Building from Source

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker

### Build Steps

```bash
# Clone the repository
git clone https://github.com/anthropics/jcodecs.git
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
```

## Project Structure

```
jCodecs/
├── packages/
│   ├── core/              # Shared utilities and types
│   │   └── src/
│   │       ├── worker-pool.ts        # Worker pool with task queue
│   │       ├── codec-worker.ts       # Worker-side helper
│   │       └── codec-worker-client.ts # Main thread helper
│   └── avif/              # AVIF codec
│       ├── src/
│       │   ├── wasm/      # C++ sources + compiled WASM
│       │   ├── decode.ts
│       │   ├── worker.ts
│       │   └── worker-api.ts
│       └── tests/
├── examples/
│   └── browser-esm/       # Browser example
├── Dockerfile             # Multi-stage WASM build
└── turbo.json             # Monorepo configuration
```

## Roadmap

- [x] AVIF decoder (libavif + dav1d)
- [x] HDR metadata support (PQ, HLG, color primaries)
- [x] Multi-threaded decoding (SharedArrayBuffer)
- [x] Web Workers API with pool
- [ ] AVIF encoder (blocked: aom requires SSE2)
- [ ] JPEG-XL codec
- [ ] WebP codec
- [ ] OpenEXR codec

## License

MIT

## Credits

Built on top of:
- [libavif](https://github.com/AOMediaCodec/libavif) - AVIF library
- [dav1d](https://code.videolan.org/videolan/dav1d) - AV1 decoder
- [Emscripten](https://emscripten.org/) - WASM compiler
