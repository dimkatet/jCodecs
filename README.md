# jCodecs

Browser-native image codecs powered by WebAssembly.

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [@jcodecs/core](./packages/core) | Shared utilities, types, worker pool | Stable |
| [@jcodecs/avif](./packages/avif) | AVIF encoder/decoder (libavif + dav1d/aom) | Stable |
| [@jcodecs/jxl](./packages/jxl) | JPEG-XL encoder/decoder (libjxl) | Stable |
| [@jcodecs/auto](./packages/auto) | Auto-detect format, unified API | Stable |

## Features

- **HDR Support** - float16, float32, 10/12/16-bit integer formats
- **Wide Color Gamut** - sRGB, Display-P3, Rec.2020
- **Transfer Functions** - sRGB, PQ (HDR10), HLG, Linear
- **Multi-threaded** - Up to 8 threads via SharedArrayBuffer
- **Web Workers** - Non-blocking processing via Worker Pool API
- **TypeScript** - Full type definitions with generics
- **Tree-shakeable** - Import only what you need

## Installation

```bash
# Auto-detect format (recommended for most use cases)
npm install @jcodecs/auto @jcodecs/avif @jcodecs/jxl

# Or install individual codecs
npm install @jcodecs/avif  # AVIF only
npm install @jcodecs/jxl   # JPEG-XL only
```

## Quick Start

### Auto-detect Format

```typescript
import { decode, encode, transcode, detectFormat } from '@jcodecs/auto';

// Auto-detect and decode any supported format
const buffer = await fetch('image.unknown').then(r => r.arrayBuffer());
const decoded = await decode(buffer);
console.log(decoded.format, decoded.width, decoded.height);

// Encode to specific format
const avifBytes = await encode(decoded, { format: 'avif', quality: 80 });

// Transcode between formats
const jxlBytes = await transcode(avifBuffer, 'jxl', { quality: 90 });
```

### AVIF

```typescript
import { decode, encode } from '@jcodecs/avif';

// Decode AVIF
const avifBytes = await fetch('image.avif').then(r => r.arrayBuffer());
const decoded = await decode(new Uint8Array(avifBytes));
console.log(decoded.width, decoded.height, decoded.metadata.isHDR);

// Encode to AVIF
const encoded = await encode(imageData, { quality: 80, speed: 6 });
```

### JPEG-XL

```typescript
import { decode, encode } from '@jcodecs/jxl';

// Decode JXL (auto-detects format: uint8/uint16/float16/float32)
const jxlBytes = await fetch('image.jxl').then(r => r.arrayBuffer());
const decoded = await decode(new Uint8Array(jxlBytes));
console.log(decoded.dataType); // 'uint8' | 'uint16' | 'float16' | 'float32'

// Encode HDR image
const encoded = await encode(hdrImageData, {
  quality: 90,
  effort: 7,
  transferFunction: 'pq',
  colorSpace: 'rec2020',
});
```

### Worker Pool (Non-blocking)

```typescript
import { createWorkerPool, encodeInWorker, decodeInWorker } from '@jcodecs/avif';

const pool = await createWorkerPool({
  type: 'decoder',
  poolSize: 4,
  preferMT: true,
});

const decoded = await decodeInWorker(pool, avifBytes);
```

## Documentation

- [@jcodecs/auto README](./packages/auto/README.md) - Auto-detect format, unified API
- [@jcodecs/avif README](./packages/avif/README.md) - AVIF codec documentation
- [@jcodecs/jxl README](./packages/jxl/README.md) - JPEG-XL codec documentation
- [@jcodecs/core README](./packages/core/README.md) - Core types and utilities

## Multi-threading

Multi-threaded WASM requires HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Check support:

```typescript
import { isMultiThreadSupported } from '@jcodecs/core';

if (isMultiThreadSupported()) {
  // Can use preferMT: true
}
```

## Building from Source

```bash
# Prerequisites: Node.js 20+, pnpm 9+, Docker

git clone https://github.com/anthropics/jcodecs.git
cd jcodecs
pnpm install

# Build WASM modules (requires Docker)
pnpm build:wasm

# Build TypeScript
pnpm build:ts

# Run tests
pnpm test
```

## Project Structure

```
jCodecs/
├── packages/
│   ├── core/          # @jcodecs/core - Shared utilities
│   ├── avif/          # @jcodecs/avif - AVIF codec
│   ├── jxl/           # @jcodecs/jxl  - JPEG-XL codec
│   └── auto/          # @jcodecs/auto - Auto-detect, unified API
├── examples/
│   └── browser-esm/   # Browser demo
├── Dockerfile         # Multi-stage WASM build
└── CLAUDE.md          # Developer documentation
```

## Roadmap

- [x] AVIF codec (libavif + dav1d/aom)
- [x] JPEG-XL codec (libjxl)
- [x] HDR float16/float32 support
- [x] Multi-threaded encoding/decoding
- [x] Web Workers API
- [x] Auto-detect format API
- [ ] WebP codec
- [ ] OpenEXR codec
- [ ] Streaming API

## License

MIT

## Credits

- [libavif](https://github.com/AOMediaCodec/libavif) - AVIF library
- [libjxl](https://github.com/libjxl/libjxl) - JPEG-XL library
- [dav1d](https://code.videolan.org/videolan/dav1d) - AV1 decoder
- [aom](https://aomedia.googlesource.com/aom) - AV1 encoder
- [Emscripten](https://emscripten.org/) - WASM compiler
