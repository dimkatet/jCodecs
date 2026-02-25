# jCodecs

Browser-native image codecs powered by WebAssembly. Full HDR support with a unified TypeScript API.

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@dimkatet/jcodecs-core`](./packages/core) | Shared types, WASM utilities, worker pool | 0.6.0 |
| [`@dimkatet/jcodecs-avif`](./packages/avif) | AVIF encoder/decoder (libavif + dav1d/aom) | 0.6.1 |
| [`@dimkatet/jcodecs-jxl`](./packages/jxl) | JPEG-XL encoder/decoder (libjxl) | 0.3.1 |
| [`@dimkatet/jcodecs-exr`](./packages/exr) | OpenEXR encoder/decoder (OpenEXR 3.x) | 0.1.0 |
| [`@dimkatet/jcodecs-auto`](./packages/auto) | Auto-detect format, unified API | 0.5.0 |

## Features

- **HDR** — float16, float32, uint8, uint16 (8/10/12/16-bit)
- **Wide Color Gamut** — sRGB, Display-P3, Rec.2020
- **Transfer Functions** — sRGB, PQ (HDR10), HLG, Linear
- **OpenEXR** — industry-standard HDR format, float16/float32
- **Multi-threaded** — up to 8 threads via SharedArrayBuffer
- **Web Workers** — non-blocking Worker Pool API
- **Unified Metadata** — all codecs share the same `ImageDescriptor` type

## Installation

```bash
# All codecs via unified API (recommended)
npm install @dimkatet/jcodecs-auto @dimkatet/jcodecs-avif @dimkatet/jcodecs-jxl @dimkatet/jcodecs-exr

# Or pick what you need
npm install @dimkatet/jcodecs-auto @dimkatet/jcodecs-avif   # AVIF only
npm install @dimkatet/jcodecs-auto @dimkatet/jcodecs-jxl    # JXL only
npm install @dimkatet/jcodecs-auto @dimkatet/jcodecs-exr    # EXR only
npm install @dimkatet/jcodecs-avif                           # AVIF standalone
```

## Quick Start

### Auto-detect and decode any format

```typescript
import { decode, detectFormat } from '@dimkatet/jcodecs-auto';

const buffer = await fetch('image.avif').then(r => r.arrayBuffer());

// Optional: check format before decoding
const format = detectFormat(buffer); // 'avif' | 'jxl' | 'exr' | 'unknown'

// Decode with auto-detection
const { data, descriptor, format: fmt } = await decode(buffer);

console.log(fmt);                              // 'avif'
console.log(descriptor.geometry.width);        // e.g. 1920
console.log(descriptor.numeric.dataType);      // 'uint8' | 'float32' | ...
console.log(descriptor.transfer?.function);    // 'pq' | 'hlg' | 'srgb' | ...
console.log(descriptor.color?.primaries);      // 'bt709' | 'bt2020' | ...
```

### Encode

```typescript
import { encode, encodeSimple, transcode } from '@dimkatet/jcodecs-auto';

// Encode to a specific format
const avifBytes = await encode(decoded, { format: 'avif', quality: 80 });
const jxlBytes  = await encode(decoded, { format: 'jxl', quality: 85 });
const exrBytes  = await encode(decoded, { format: 'exr', exr: { compression: 'piz' } });

// Simple encode from ImageData
const simple = await encodeSimple(imageData, 'avif', 80);

// Transcode between formats
const jxlBytes2 = await transcode(avifBuffer, 'jxl', { quality: 90 });
```

### AVIF

```typescript
import { decode, encode } from '@dimkatet/jcodecs-avif';

// Decode
const { data, descriptor } = await decode(new Uint8Array(avifBytes));

// Encode (data + descriptor is the full-fidelity path)
const encoded = await encode(data, {
  geometry: { width: descriptor.geometry.width, height: descriptor.geometry.height },
  channels: { model: 'rgba', count: 4 },
  numeric: { dataType: 'uint8' },
}, { quality: 80, speed: 6 });

// Convenience: encode from ImageData
const simple = await encodeSimple(imageData, 80);
```

### JPEG-XL

```typescript
import { decode, encode } from '@dimkatet/jcodecs-jxl';

// Decode — format auto-detected from file (uint8/uint16/float16/float32)
const { data, descriptor } = await decode(new Uint8Array(jxlBytes));
console.log(descriptor.numeric.dataType); // e.g. 'float32'

// Encode
const encoded = await encode(data, {
  geometry: { width, height },
  channels: { model: 'rgba', count: 4 },
  numeric: { dataType: 'float32' },
}, { quality: 90, effort: 7 });
```

### OpenEXR

```typescript
import { decode, encode } from '@dimkatet/jcodecs-exr';

// Decode EXR — always returns float16 or float32
const { data, descriptor } = await decode(new Uint8Array(exrBytes));
console.log(descriptor.numeric.dataType); // 'float16' | 'float32'

// Encode float data to EXR
const exrBytes = await encode(float32Data, {
  geometry: { width, height },
  channels: { model: 'rgba', count: 4 },
  numeric: { dataType: 'float32' },
}, { compression: 'piz' });

// Convenience: encode from ImageData (converts to float32)
const simple = await encodeSimple(imageData, 'zip');
```

### Worker Pool (non-blocking)

```typescript
import { createWorkerPool, decodeInWorker, encodeInWorker } from '@dimkatet/jcodecs-auto';

const pool = await createWorkerPool({ poolSize: 4, preferMT: true });

const decoded  = await decodeInWorker(pool, buffer);
const encoded  = await encodeInWorker(pool, decoded, { format: 'jxl', quality: 85 });

terminateWorkerPool(pool);
```

## ImageDescriptor

All codecs share a unified `ImageDescriptor` type instead of format-specific metadata:

```typescript
interface ImageDescriptor {
  geometry: { width: number; height: number };          // always present
  channels: { model: ChannelModel; count: number };     // always present
  numeric: { dataType: DataType; bitDepth: number };    // always present
  color?:    { primaries?: ColorPrimaries; ... };
  transfer?: { function?: TransferFunction; ... };
  luminance?: { peakBrightness?: number; ... };
  alpha?:    { mode?: AlphaMode; ... };
  hdr?:      { maxCLL?: number; masteringDisplay?: ...; };
  sampling?: { chromaSubsampling?: ChromaSubsampling; ... };
  iccProfile?: Uint8Array;
  formatSpecific?: unknown; // e.g. EXRFormatSpecific
}
```

## Multi-threading

Requires these HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

```typescript
import { isMultiThreadSupported } from '@dimkatet/jcodecs-core';

if (isMultiThreadSupported()) {
  // Use preferMT: true in worker pool config
}
```

## Building from Source

Prerequisites: Node.js ≥ 20, pnpm ≥ 9, Docker.

```bash
git clone <repo>
cd jCodecs
pnpm install

pnpm build:wasm   # Build all WASM modules (Docker)
pnpm build:ts     # Build TypeScript
pnpm test         # Run tests
```

## Project Structure

```
jCodecs/
├── packages/
│   ├── core/    # @dimkatet/jcodecs-core  — shared types & utilities
│   ├── avif/    # @dimkatet/jcodecs-avif  — AVIF codec
│   ├── jxl/     # @dimkatet/jcodecs-jxl   — JPEG-XL codec
│   ├── exr/     # @dimkatet/jcodecs-exr   — OpenEXR codec
│   └── auto/    # @dimkatet/jcodecs-auto  — unified API
├── examples/browser-esm/
├── Dockerfile
└── CLAUDE.md    # Developer documentation
```

## Roadmap

- [x] AVIF (libavif + dav1d/aom)
- [x] JPEG-XL (libjxl)
- [x] OpenEXR (OpenEXR 3.x)
- [x] HDR float16/float32
- [x] Multi-threaded encoding/decoding
- [x] Web Workers API
- [x] Unified format auto-detection
- [ ] WebP codec
- [ ] Streaming decode API

## Credits

- [libavif](https://github.com/AOMediaCodec/libavif)
- [libjxl](https://github.com/libjxl/libjxl)
- [OpenEXR](https://github.com/AcademySoftwareFoundation/openexr)
- [dav1d](https://code.videolan.org/videolan/dav1d)
- [aom](https://aomedia.googlesource.com/aom)
- [Emscripten](https://emscripten.org/)

## License

MIT
