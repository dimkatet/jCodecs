# jCodecs

Image codecs for the browser using WebAssembly. Currently supports AVIF encoding/decoding with plans to add more formats.

## Features

- **AVIF Codec** - Full encoding and decoding support via libavif
- **HDR Support** - 8, 10, 12, and 16-bit images with wide color gamut (Display P3, Rec.2020)
- **Web Workers** - Non-blocking image processing via Worker Pool
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
import { encode, decode, init } from '@jcodecs/avif';

// Initialize WASM (required once)
await init();

// Decode AVIF to ImageData
const response = await fetch('image.avif');
const avifData = new Uint8Array(await response.arrayBuffer());
const imageData = await decode(avifData);

// Encode ImageData to AVIF
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);

const avifBytes = await encode(pixels, {
  quality: 80,
  speed: 6,
});

// Download the result
const blob = new Blob([avifBytes], { type: 'image/avif' });
const url = URL.createObjectURL(blob);
```

## API Reference

### Encode Options

```typescript
interface AVIFEncodeOptions {
  quality?: number;           // 0-100, default: 75
  qualityAlpha?: number;      // 0-100, default: 100
  speed?: number;             // 0-10 (10=fastest), default: 6
  chromaSubsampling?: '4:4:4' | '4:2:2' | '4:2:0' | '4:0:0';
  bitDepth?: 8 | 10 | 12;     // default: 8
  colorSpace?: 'srgb' | 'display-p3' | 'rec2020';
  lossless?: boolean;         // default: false
  threads?: number;           // 0=auto, default: 0
}
```

### Decode Options

```typescript
interface AVIFDecodeOptions {
  bitDepth?: 0 | 8 | 10 | 12 | 16;  // 0=auto
  useThreads?: boolean;              // default: true
  maxThreads?: number;               // 0=auto
}
```

### Web Workers API

For heavy workloads, use the Worker Pool to avoid blocking the main thread:

```typescript
import { initWorkerPool, encodeInWorker, decodeInWorker } from '@jcodecs/avif/worker';

// Initialize worker pool (4 workers by default)
await initWorkerPool({ poolSize: 4 });

// Encode in worker
const avifBytes = await encodeInWorker(imageData, { quality: 80 });

// Decode in worker
const decoded = await decodeInWorker(avifData);
```

### HDR Images

```typescript
import { decode, encode, getImageInfo } from '@jcodecs/avif';

// Check if image is HDR
const info = await getImageInfo(avifData);
console.log('Is HDR:', info.isHDR);
console.log('Bit depth:', info.bitDepth);

// Decode as 10-bit
const hdrImage = await decode(avifData, { bitDepth: 10 });
// hdrImage.data is Uint16Array for >8 bit

// Encode HDR
const encoded = await encode(hdrImage, {
  bitDepth: 10,
  colorSpace: 'rec2020',
});
```

## Building from Source

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for WASM build)
- Emscripten SDK 3.1.61+ (or use Docker)

### Build Steps

```bash
# Clone the repository
git clone https://github.com/your-org/jcodecs.git
cd jcodecs

# Install dependencies
pnpm install

# Build WASM (requires Docker or Emscripten)
# Option 1: Using Docker
docker run -v $(pwd):/build -w /build emscripten/emsdk:3.1.61 bash scripts/build-avif.sh

# Option 2: With Emscripten installed locally
./scripts/build-avif.sh

# Build TypeScript
pnpm build

# Run tests
pnpm test
```

## Project Structure

```
jCodecs/
├── packages/
│   ├── core/           # Shared utilities and types
│   │   └── src/
│   │       ├── types.ts
│   │       ├── memory.ts
│   │       └── worker-pool.ts
│   └── avif/           # AVIF codec
│       ├── src/
│       │   ├── wasm/   # C++ wrappers
│       │   ├── encode.ts
│       │   ├── decode.ts
│       │   └── ...
│       └── wasm/       # Compiled WASM files
├── native/             # Native library sources
│   ├── libavif/
│   ├── aom/
│   └── dav1d/
└── scripts/            # Build scripts
```

## Roadmap

- [x] AVIF encode/decode
- [x] HDR support (10/12-bit, wide gamut)
- [x] Web Workers API
- [ ] JPEG-XL codec
- [ ] WebP codec
- [ ] OpenEXR codec
- [ ] Streaming API
- [ ] Node.js support

## License

MIT

## Credits

Built on top of:
- [libavif](https://github.com/AOMediaCodec/libavif) - AVIF library
- [aom](https://aomedia.googlesource.com/aom/) - AV1 encoder
- [dav1d](https://code.videolan.org/videolan/dav1d) - AV1 decoder
- [Emscripten](https://emscripten.org/) - WASM compiler
