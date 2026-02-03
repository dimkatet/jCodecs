# @jcodecs/jxl

JPEG-XL encoder/decoder for browsers via WebAssembly.

Built with [libjxl](https://github.com/libjxl/libjxl).

## Installation

```bash
npm install @jcodecs/jxl
```

## Features

- **HDR Support** - float16, float32, 8/10/12/16-bit integer
- **Auto-detection** - Decoder automatically detects format from file
- **Wide Color Gamut** - sRGB, Display-P3, Rec.2020
- **Transfer Functions** - sRGB, PQ (HDR10), HLG, Linear
- **Multi-threaded** - Up to 8 threads via SharedArrayBuffer
- **Progressive** - Optional progressive decoding support
- **Lossless** - Full lossless compression support

## Quick Start

### Decode

```typescript
import { decode, decodeToImageData } from '@jcodecs/jxl';

// Decode (auto-detects format)
const jxlBytes = await fetch('image.jxl').then(r => r.arrayBuffer());
const decoded = await decode(new Uint8Array(jxlBytes));

console.log(decoded.dataType);  // 'uint8' | 'uint16' | 'float16' | 'float32'
console.log(decoded.data);      // Uint8Array | Uint16Array | Float16Array | Float32Array
console.log(decoded.metadata.isHDR);
console.log(decoded.metadata.transferFunction);

// Decode to standard ImageData (8-bit sRGB)
const imageData = await decodeToImageData(jxlBytes);
ctx.putImageData(imageData, 0, 0);
```

### Encode

```typescript
import { encode } from '@jcodecs/jxl';

// Basic encoding
const encoded = await encode(imageData, {
  quality: 85,
  effort: 7,
});

// HDR float encoding
const hdrData = {
  data: new Float16Array(width * height * 4),
  dataType: 'float16',
  width,
  height,
  channels: 4,
  bitDepth: 16,
  metadata: {
    colorPrimaries: 'bt2020',
    transferFunction: 'pq',
    isHDR: true,
  },
};

const hdrEncoded = await encode(hdrData, {
  quality: 90,
  effort: 7,
  colorSpace: 'rec2020',
  transferFunction: 'pq',
});

// Lossless encoding
const lossless = await encode(imageData, { lossless: true });
```

### Worker Pool

```typescript
import {
  createWorkerPool,
  encodeInWorker,
  decodeInWorker,
  terminateWorkerPool,
} from '@jcodecs/jxl';

const pool = await createWorkerPool({
  type: 'decoder',
  poolSize: 4,
  preferMT: true,
});

const decoded = await decodeInWorker(pool, jxlBytes);

terminateWorkerPool(pool);
```

## API Reference

### `decode(data, options?, config?)`

Decode JXL to ExtendedImageData. Format is auto-detected from file.

```typescript
interface JXLDecodeOptions {
  maxThreads?: number;           // Max threads (default: 0 = auto, max: 8)
  ignoreColorProfile?: boolean;  // Ignore ICC profile
}

const decoded = await decode(jxlBytes, { maxThreads: 4 });
// decoded.data: Uint8Array | Uint16Array | Float16Array | Float32Array
// decoded.dataType: 'uint8' | 'uint16' | 'float16' | 'float32'
// decoded.bitDepth: 8 | 10 | 12 | 16 | 32
// decoded.metadata: JXLMetadata
```

### `encode(imageData, options?, config?)`

Encode ImageData or ExtendedImageData to JXL.

```typescript
interface JXLEncodeOptions {
  quality?: number;              // 0-100 (default: 75)
  effort?: number;               // 1-10 (default: 7, higher = slower/smaller)
  lossless?: boolean;            // Lossless mode (default: false)
  progressive?: boolean;         // Progressive decoding support
  bitDepth?: number;             // 8, 10, 12, 16 for integers
  colorSpace?: string;           // 'srgb', 'display-p3', 'rec2020'
  transferFunction?: string;     // 'srgb', 'pq', 'hlg', 'linear'
  maxThreads?: number;           // Max threads (default: 0 = auto, max: 8)
}

const encoded = await encode(imageData, { quality: 85, effort: 7 });
```

### `getImageInfo(data)`

Read metadata without full decoding.

```typescript
const info = await getImageInfo(jxlBytes);
console.log(info.width, info.height, info.bitDepth);
console.log(info.metadata.isHDR);
```

### Worker Pool API

```typescript
interface WorkerPoolConfig {
  type?: 'decoder' | 'encoder' | 'both';
  poolSize?: number;
  preferMT?: boolean;
  lazyInit?: boolean;
}

const pool = await createWorkerPool(config);
const decoded = await decodeInWorker(pool, data, options);
const encoded = await encodeInWorker(pool, imageData, options);
terminateWorkerPool(pool);
```

## Data Types

JXL supports multiple pixel formats. The decoder auto-detects format from the file:

| DataType | TypedArray | Use Case |
|----------|------------|----------|
| `'uint8'` | `Uint8Array` | Standard 8-bit images |
| `'uint16'` | `Uint16Array` | 10/12/16-bit HDR |
| `'float16'` | `Float16Array` | HDR with wide range |
| `'float32'` | `Float32Array` | Maximum precision HDR |

### Encoding with DataType

```typescript
// Float16 HDR
const float16Data = {
  data: new Float16Array(w * h * 4),
  dataType: 'float16',
  width: w,
  height: h,
  channels: 4,
  bitDepth: 16,
  metadata: { transferFunction: 'linear', isHDR: true },
};

const encoded = await encode(float16Data);

// Decode preserves format
const decoded = await decode(encoded);
console.log(decoded.dataType);  // 'float16'
console.log(decoded.data);      // Float16Array
```

## Metadata

```typescript
interface JXLMetadata {
  colorPrimaries: 'bt709' | 'bt2020' | 'display-p3' | 'unknown';
  transferFunction: 'srgb' | 'pq' | 'hlg' | 'linear' | 'bt709' | 'unknown';
  matrixCoefficients: string;
  fullRange: boolean;
  maxCLL?: number;
  maxPALL?: number;
  masteringDisplay?: {
    primaries: { red, green, blue };
    whitePoint: [x, y];
    luminance: { min, max };
  };
  iccProfile?: Uint8Array;
  isHDR: boolean;
  isAnimated: boolean;
  frameCount: number;
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
import { isMultiThreadSupported } from '@jcodecs/jxl';

if (isMultiThreadSupported()) {
  // Can use preferMT: true and maxThreads > 1
}
```

## Quality vs Effort

- **quality** (0-100): Controls compression ratio. 100 = best quality, larger files
- **effort** (1-10): Controls encoding speed. 10 = slowest, smallest files

Recommended settings:
- Fast preview: `quality: 70, effort: 3`
- Balanced: `quality: 85, effort: 7`
- Maximum quality: `quality: 95, effort: 9`

## Native Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| libjxl | 0.11.x | JPEG-XL codec |
| highway | latest | SIMD operations |
| brotli | latest | Compression |

## License

MIT
