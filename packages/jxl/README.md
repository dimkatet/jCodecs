# @dimkatet/jcodecs-jxl

JPEG-XL encoder/decoder for browsers via WebAssembly.

Built with [libjxl](https://github.com/libjxl/libjxl) 0.11.x.

## Installation

```bash
npm install @dimkatet/jcodecs-jxl
```

## Features

- All pixel formats: uint8, uint16, float16, float32
- Decoder auto-detects format from the file (no manual selection needed)
- Wide color gamut: sRGB, Display-P3, Rec.2020
- Transfer functions: sRGB, PQ (HDR10), HLG, Linear
- Lossless compression
- Progressive decoding support
- Multi-threaded encoding/decoding (up to 8 threads)
- Non-blocking Worker Pool API

## Quick Start

### Decode

```typescript
import { decode, decodeToImageData, getImageInfo } from '@dimkatet/jcodecs-jxl';

const jxlBytes = await fetch('image.jxl').then(r => r.arrayBuffer());

// Decode to CodecImageData — format auto-detected from file
const { data, descriptor } = await decode(new Uint8Array(jxlBytes));

console.log(descriptor.numeric.dataType);      // 'uint8' | 'uint16' | 'float16' | 'float32'
console.log(descriptor.numeric.bitDepth);      // 8 | 10 | 12 | 16 | 32
console.log(descriptor.geometry.width);
console.log(descriptor.color?.primaries);      // 'bt709' | 'bt2020' | 'displayP3'
console.log(descriptor.transfer?.function);    // 'srgb' | 'pq' | 'hlg' | 'linear'

// Decode to standard ImageData (8-bit sRGB, for canvas)
const imageData = await decodeToImageData(jxlBytes);
ctx.putImageData(imageData, 0, 0);

// Read metadata without full decode
const info = await getImageInfo(jxlBytes);
```

### Encode

```typescript
import { encode, encodeSimple } from '@dimkatet/jcodecs-jxl';

// Full API — encode TypedArray with an explicit descriptor
const encoded = await encode(
  data,  // Uint8Array | Uint16Array | Float16Array | Float32Array
  {
    geometry: { width: 1920, height: 1080 },
    channels: { model: 'rgba', count: 4 },
    numeric: { dataType: 'uint8' },
    color: { primaries: 'bt709' },
    transfer: { function: 'srgb' },
  },
  { quality: 85, effort: 7 },
);

// HDR float32 encode
const hdrEncoded = await encode(
  float32Data,
  {
    geometry: { width, height },
    channels: { model: 'rgb', count: 3 },
    numeric: { dataType: 'float32' },
    color: { primaries: 'bt2020' },
    transfer: { function: 'pq' },
    hdr: { maxCLL: 1000, maxPALL: 400 },
  },
  { quality: 90, effort: 9 },
);

// Lossless encode
const lossless = await encode(data, descriptor, { lossless: true });

// Simple API — encode from standard ImageData
const simple = await encodeSimple(imageData, 85);
```

### Worker Pool

```typescript
import {
  createWorkerPool,
  encodeInWorker,
  decodeInWorker,
  terminateWorkerPool,
} from '@dimkatet/jcodecs-jxl';

const pool = await createWorkerPool({
  type: 'decoder',
  poolSize: 4,
  preferMT: true,
});

const { data, descriptor } = await decodeInWorker(pool, jxlBytes);

terminateWorkerPool(pool);
```

## API Reference

### `decode(input, options?, config?)`

```typescript
decode(
  input: Uint8Array | ArrayBuffer,
  options?: JXLDecodeOptions,
  config?: InitConfig,
): Promise<{ data: Uint8Array | Uint16Array | Float16Array | Float32Array; descriptor: ImageDescriptor }>

interface JXLDecodeOptions {
  maxThreads?: number;           // 0 = auto (default), max: 8
  ignoreColorProfile?: boolean;  // Ignore ICC profile (default: false)
}
```

### `encode(data, descriptor, options?, config?)`

```typescript
encode(
  data: Uint8Array | Uint16Array | Float16Array | Float32Array,
  descriptor: JXLEncodeDescriptor,
  options?: JXLEncodeOptions,
  config?: InitConfig,
): Promise<Uint8Array>

interface JXLEncodeDescriptor {
  geometry: { width: number; height: number };
  channels: { model: 'rgb' | 'rgba' | 'gray' | 'graya'; count: number };
  numeric: { dataType: 'uint8' | 'uint16' | 'float16' | 'float32' };
  color?: { primaries?: ColorPrimaries };
  transfer?: { function?: TransferFunction };
  hdr?: { maxCLL?: number; maxPALL?: number; masteringDisplay?: MasteringDisplay };
}

interface JXLEncodeOptions {
  quality?: number;       // 0–100 (default: 75)
  effort?: number;        // 1–10 (default: 7, higher = slower/smaller files)
  lossless?: boolean;     // (default: false)
  progressive?: boolean;  // (default: false)
  maxThreads?: number;    // 0 = auto, max: 8
}
```

### `encodeSimple(imageData, quality?)`

```typescript
encodeSimple(imageData: ImageData, quality?: number): Promise<Uint8Array>
// quality: 0–100 (default: 75)
```

### `getImageInfo(input)`

```typescript
getImageInfo(input: Uint8Array | ArrayBuffer): Promise<ImageDescriptor>
```

### `decodeToImageData(input, options?)`

```typescript
decodeToImageData(
  input: Uint8Array | ArrayBuffer,
  options?: JXLDecodeOptions,
): Promise<ImageData>
```

### Worker Pool API

```typescript
interface WorkerPoolConfig {
  type?: 'decoder' | 'encoder' | 'both';
  poolSize?: number;
  preferMT?: boolean;
  lazyInit?: boolean;
}

createWorkerPool(config?: WorkerPoolConfig): Promise<JXLWorkerClient>
decodeInWorker(client, input, options?): Promise<{ data; descriptor }>
encodeInWorker(client, data, descriptor, options?): Promise<Uint8Array>
terminateWorkerPool(client): void
```

### Init

```typescript
interface InitConfig {
  jsUrl?: string;
  preferMT?: boolean;
}

initDecoder(config?: InitConfig): Promise<void>
initEncoder(config?: InitConfig): Promise<void>
isDecoderInitialized(): boolean
isDecoderMultiThreaded(): boolean
```

## Data Types

JXL natively stores float data. The decoder reads the format from the file:

| File format | Decoded `dataType` | `data` array |
|-------------|-------------------|--------------|
| 8-bit integer | `'uint8'` | `Uint8Array` |
| 10/12/16-bit integer | `'uint16'` | `Uint16Array` |
| float16 | `'float16'` | `Float16Array` |
| float32 | `'float32'` | `Float32Array` |

Encoding respects the `numeric.dataType` in the descriptor:

```typescript
// Encode float16 — file stores 16-bit float, decoder returns Float16Array
const encoded = await encode(float16Data, {
  ...descriptor,
  numeric: { dataType: 'float16' },
});
const decoded = await decode(encoded);
console.log(decoded.descriptor.numeric.dataType); // 'float16'
console.log(decoded.data instanceof Float16Array); // true
```

## Quality vs Effort

| Setting | Range | Effect |
|---------|-------|--------|
| `quality` | 0–100 | Compression ratio. 100 = best quality, largest files |
| `effort` | 1–10 | Encoding speed. 10 = slowest, smallest files |

Recommended presets:

| Use case | quality | effort |
|----------|---------|--------|
| Fast preview | 70 | 3 |
| Balanced | 85 | 7 |
| Maximum quality | 95 | 9 |
| Lossless | — | 7 | set `lossless: true` |

## Multi-threading

Requires HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

```typescript
import { isMultiThreadSupported } from '@dimkatet/jcodecs-jxl';

if (isMultiThreadSupported()) {
  // Can use preferMT: true
}
```

## Native Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| libjxl | 0.11.x | JPEG-XL codec |
| highway | latest | SIMD operations |
| brotli | latest | Compression |

## License

MIT
