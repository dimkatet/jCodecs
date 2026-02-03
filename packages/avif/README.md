# @jcodecs/avif

AVIF encoder/decoder for browsers via WebAssembly.

Built with [libavif](https://github.com/AOMediaCodec/libavif) + [dav1d](https://code.videolan.org/videolan/dav1d) (decoder) + [aom](https://aomedia.googlesource.com/aom) (encoder).

## Installation

```bash
npm install @jcodecs/avif
```

## Features

- **HDR Support** - 8/10/12/16-bit integer formats
- **Wide Color Gamut** - sRGB, Display-P3, Rec.2020
- **Transfer Functions** - sRGB, PQ (HDR10), HLG, Linear
- **Multi-threaded** - Up to 8 threads via SharedArrayBuffer
- **Web Workers** - Non-blocking Worker Pool API
- **Full Metadata** - ICC profiles, mastering display, content light level

## Quick Start

### Decode

```typescript
import { decode, decodeToImageData } from '@jcodecs/avif';

// Decode to ExtendedImageData (preserves bit depth)
const avifBytes = await fetch('image.avif').then(r => r.arrayBuffer());
const decoded = await decode(new Uint8Array(avifBytes));

console.log(decoded.width, decoded.height);
console.log(decoded.bitDepth);           // 8, 10, 12, or 16
console.log(decoded.metadata.isHDR);
console.log(decoded.metadata.colorPrimaries);  // 'bt709', 'bt2020', etc.

// Decode to standard ImageData (8-bit sRGB)
const imageData = await decodeToImageData(avifBytes);
ctx.putImageData(imageData, 0, 0);
```

### Encode

```typescript
import { encode } from '@jcodecs/avif';

// Basic encoding
const encoded = await encode(imageData, {
  quality: 80,
  speed: 6,
});

// HDR encoding
const hdrEncoded = await encode(hdrImageData, {
  quality: 90,
  bitDepth: 10,
  transferFunction: 'pq',
  colorSpace: 'rec2020',
  chromaSubsampling: '4:4:4',
});

// Download
const blob = new Blob([encoded], { type: 'image/avif' });
```

### Worker Pool

```typescript
import {
  createWorkerPool,
  encodeInWorker,
  decodeInWorker,
  terminateWorkerPool,
} from '@jcodecs/avif';

// Create pool for decoding
const pool = await createWorkerPool({
  type: 'decoder',
  poolSize: 4,
  preferMT: true,
});

// Decode in worker (non-blocking)
const decoded = await decodeInWorker(pool, avifBytes);

// Cleanup
terminateWorkerPool(pool);
```

## API Reference

### `decode(data, options?, config?)`

Decode AVIF to ExtendedImageData.

```typescript
interface AVIFDecodeOptions {
  maxThreads?: number;           // Max threads (default: 0 = auto, max: 8)
  ignoreColorProfile?: boolean;  // Ignore ICC profile
}

const decoded = await decode(avifBytes, { maxThreads: 4 });
// decoded.data: Uint8Array | Uint16Array
// decoded.dataType: 'uint8' | 'uint16'
// decoded.bitDepth: 8 | 10 | 12 | 16
// decoded.metadata: AVIFMetadata
```

### `encode(imageData, options?, config?)`

Encode ImageData or ExtendedImageData to AVIF.

```typescript
interface AVIFEncodeOptions {
  quality?: number;              // 0-100 (default: 75)
  qualityAlpha?: number;         // 0-100 (default: 100)
  speed?: number;                // 0-10 (default: 6, higher = faster)
  bitDepth?: number;             // 8, 10, 12 (default: 8)
  chromaSubsampling?: string;    // '4:4:4', '4:2:2', '4:2:0', '4:0:0'
  colorSpace?: string;           // 'srgb', 'display-p3', 'rec2020'
  transferFunction?: string;     // 'srgb', 'pq', 'hlg', 'linear'
  lossless?: boolean;            // Lossless mode
  maxThreads?: number;           // Max threads (default: 0 = auto, max: 8)
}

const encoded = await encode(imageData, { quality: 80, speed: 6 });
```

### `getImageInfo(data)`

Read metadata without full decoding.

```typescript
const info = await getImageInfo(avifBytes);
console.log(info.width, info.height, info.bitDepth);
console.log(info.metadata.isHDR);
```

### Worker Pool API

```typescript
interface WorkerPoolConfig {
  type?: 'decoder' | 'encoder' | 'both';  // default: 'both'
  poolSize?: number;                       // default: hardwareConcurrency / 2
  preferMT?: boolean;                      // Use MT WASM (default: false)
  lazyInit?: boolean;                      // Delay init (default: false)
}

const pool = await createWorkerPool(config);
const decoded = await decodeInWorker(pool, data, options);
const encoded = await encodeInWorker(pool, imageData, options);
terminateWorkerPool(pool);
```

## Metadata

```typescript
interface AVIFMetadata {
  colorPrimaries: 'bt709' | 'bt2020' | 'display-p3' | 'unknown';
  transferFunction: 'srgb' | 'pq' | 'hlg' | 'linear' | 'bt709' | 'unknown';
  matrixCoefficients: string;
  fullRange: boolean;
  maxCLL?: number;               // Max Content Light Level
  maxPALL?: number;              // Max Picture Average Light Level
  masteringDisplay?: {
    primaries: { red, green, blue };
    whitePoint: [x, y];
    luminance: { min, max };
  };
  iccProfile?: Uint8Array;
  isHDR: boolean;
}
```

## Multi-threading

Requires HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Check support:

```typescript
import { isMultiThreadSupported } from '@jcodecs/avif';

if (isMultiThreadSupported()) {
  // Can use preferMT: true and maxThreads > 1
}
```

## Performance Tips

1. **Decoding many images**: Use `preferMT: true` + `poolSize: 4-8`
2. **Encoding large images**: Use `preferMT: true` + `poolSize: 1` + `maxThreads: 8`
3. **Lazy init**: Set `lazyInit: true` for encoder if not always needed

## Native Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| libavif | 1.3.0 | AVIF container |
| dav1d | 1.5.3 | AV1 decoder |
| aom | v3.11.0 | AV1 encoder |

## License

MIT
