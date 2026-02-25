# @dimkatet/jcodecs-avif

AVIF encoder/decoder for browsers via WebAssembly.

Built with [libavif](https://github.com/AOMediaCodec/libavif) 1.3.0 + [dav1d](https://code.videolan.org/videolan/dav1d) 1.5.3 (decoder) + [aom](https://aomedia.googlesource.com/aom) v3.11.0 (encoder).

## Installation

```bash
npm install @dimkatet/jcodecs-avif
```

## Features

- 8/10/12-bit integer pixel formats
- Wide color gamut: sRGB, Display-P3, Rec.2020
- Transfer functions: sRGB, PQ (HDR10), HLG, Linear
- Multi-threaded encoding/decoding (up to 8 threads)
- Non-blocking Worker Pool API
- HDR metadata: mastering display, MaxCLL, MaxPALL
- ICC profile support
- Chroma subsampling: 4:4:4, 4:2:2, 4:2:0, 4:0:0

## Quick Start

### Decode

```typescript
import { decode, decodeToImageData, getImageInfo } from '@dimkatet/jcodecs-avif';

const avifBytes = await fetch('image.avif').then(r => r.arrayBuffer());

// Decode to CodecImageData (preserves bit depth)
const { data, descriptor } = await decode(new Uint8Array(avifBytes));

console.log(descriptor.geometry.width, descriptor.geometry.height);
console.log(descriptor.numeric.dataType);      // 'uint8' | 'uint16'
console.log(descriptor.numeric.bitDepth);      // 8 | 10 | 12
console.log(descriptor.color?.primaries);      // 'bt709' | 'bt2020' | 'displayP3'
console.log(descriptor.transfer?.function);    // 'srgb' | 'pq' | 'hlg' | 'linear'
console.log(descriptor.hdr?.maxCLL);           // nits, if present

// Decode to standard ImageData (8-bit sRGB, for canvas)
const imageData = await decodeToImageData(avifBytes);
ctx.putImageData(imageData, 0, 0);

// Read metadata without full decode
const info = await getImageInfo(avifBytes);
console.log(info.geometry.width, info.numeric.bitDepth);
```

### Encode

```typescript
import { encode, encodeSimple } from '@dimkatet/jcodecs-avif';

// Full API — encode TypedArray with an explicit descriptor
const encoded = await encode(
  data,  // Uint8Array | Uint16Array
  {
    geometry: { width: 1920, height: 1080 },
    channels: { model: 'rgba', count: 4 },
    numeric: { dataType: 'uint8' },
    color: { primaries: 'bt709' },
    transfer: { function: 'srgb' },
  },
  { quality: 80, speed: 6 },
);

// HDR encode
const hdrEncoded = await encode(
  uint16Data,
  {
    geometry: { width, height },
    channels: { model: 'rgb', count: 3 },
    numeric: { dataType: 'uint16', bitDepth: 10 },
    color: { primaries: 'bt2020' },
    transfer: { function: 'pq' },
    sampling: { chromaSubsampling: '444' },
    hdr: { maxCLL: 1000, maxPALL: 400 },
  },
  { quality: 90 },
);

// Simple API — encode from standard ImageData
const simple = await encodeSimple(imageData, 80);
```

### Worker Pool

```typescript
import { createWorkerPool } from '@dimkatet/jcodecs-avif';

// Decoder pool (multi-threaded WASM, 4 workers)
const pool = await createWorkerPool({
  type: 'decoder',
  poolSize: 4,
  preferMT: true,
});

const { data, descriptor } = await pool.decode(avifBytes);
const encoded = await pool.encode(data, descriptor, { quality: 80 });

pool.terminate();
```

## API Reference

### `decode(input, options?, config?)`

```typescript
decode(
  input: Uint8Array | ArrayBuffer,
  options?: AVIFDecodeOptions,
  config?: InitConfig,
): Promise<{ data: Uint8Array | Uint16Array; descriptor: ImageDescriptor }>

interface AVIFDecodeOptions {
  maxThreads?: number;           // 0 = auto (default), max: 8
  ignoreColorProfile?: boolean;  // Ignore ICC profile (default: false)
}
```

### `encode(data, descriptor, options?, config?)`

```typescript
encode(
  data: Uint8Array | Uint16Array,
  descriptor: AVIFEncodeDescriptor,
  options?: AVIFEncodeOptions,
  config?: InitConfig,
): Promise<Uint8Array>

interface AVIFEncodeDescriptor {
  geometry: { width: number; height: number };
  channels: { model: 'rgb' | 'rgba' | 'gray' | 'graya'; count: number };
  numeric: { dataType: 'uint8' | 'uint16'; bitDepth?: number };
  color?: { primaries?: ColorPrimaries };
  transfer?: { function?: TransferFunction };
  sampling?: { chromaSubsampling?: '444' | '422' | '420' | '400' };
  hdr?: { maxCLL?: number; maxPALL?: number; masteringDisplay?: MasteringDisplay };
}

interface AVIFEncodeOptions {
  quality?: number;        // 0–100 (default: 75)
  qualityAlpha?: number;   // 0–100 (default: 100)
  speed?: number;          // 0–10 (default: 6, higher = faster)
  lossless?: boolean;      // (default: false)
  tune?: 'psnr' | 'ssim';
  maxThreads?: number;     // 0 = auto, max: 8
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
  options?: AVIFDecodeOptions,
): Promise<ImageData>
```

### Worker Pool API

```typescript
interface WorkerPoolConfig {
  type?: 'decoder' | 'encoder' | 'both';  // default: 'both'
  poolSize?: number;                       // default: hardwareConcurrency / 2
  preferMT?: boolean;                      // Use MT WASM (default: false)
  lazyInit?: boolean;                      // Delay WASM init (default: false)
}

createWorkerPool(config?: WorkerPoolConfig): Promise<AVIFWorkerHandle>

// Pool methods
pool.decode(input, options?): Promise<{ data; descriptor }>
pool.encode(data, descriptor, options?): Promise<Uint8Array>
pool.getStats(): PoolStats
pool.terminate(): void
pool.isInitialized(): boolean
```

### Init

```typescript
interface InitConfig {
  jsUrl?: string;      // Custom WASM module URL (for self-hosting)
  preferMT?: boolean;  // Prefer multi-threaded module
}

initDecoder(config?: InitConfig): Promise<void>
initEncoder(config?: InitConfig): Promise<void>
isDecoderInitialized(): boolean
isEncoderInitialized(): boolean
isDecoderMultiThreaded(): boolean
```

## Multi-threading

Requires HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

```typescript
import { isMultiThreadSupported } from '@dimkatet/jcodecs-avif';

if (isMultiThreadSupported()) {
  // Can use preferMT: true and maxThreads > 1
}
```

## Performance Tips

| Use case | Config |
|----------|--------|
| Batch decoding | `type: 'decoder', poolSize: 4–8, preferMT: true` |
| Encoding large images | `type: 'encoder', poolSize: 1, preferMT: true, maxThreads: 8` |
| Lazy encoder init | `lazyInit: true` — defers WASM load until first encode |

## Native Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| libavif | 1.3.0 | AVIF container |
| dav1d | 1.5.3 | AV1 decoder |
| aom | v3.11.0 | AV1 encoder |

## License

MIT
