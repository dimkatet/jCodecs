# @dimkatet/jcodecs-exr

OpenEXR encoder/decoder for browsers via WebAssembly.

Built with [OpenEXR](https://github.com/AcademySoftwareFoundation/openexr) 3.x.

## Installation

```bash
npm install @dimkatet/jcodecs-exr
```

## Features

- float16 and float32 pixel formats (industry-standard HDR)
- Multiple compression codecs: none, RLE, ZIP, PIZ, PXR24, DWAA, DWAB
- Decoder auto-detects data type from file header
- EXR chromaticities mapped to standard `ColorPrimaries`
- Multi-threaded decoding (up to 8 threads)
- Non-blocking Worker Pool API
- `formatSpecific` exposes EXR-native metadata (data/display windows, chromaticities)

## Quick Start

### Decode

```typescript
import { decode, decodeToImageData, getImageInfo } from '@dimkatet/jcodecs-exr';

const exrBytes = await fetch('image.exr').then(r => r.arrayBuffer());

// Decode to CodecImageData — data type auto-detected from file
const { data, descriptor } = await decode(new Uint8Array(exrBytes));

console.log(descriptor.numeric.dataType);   // 'float16' | 'float32'
console.log(descriptor.geometry.width);
console.log(descriptor.color?.primaries);   // 'bt709' | 'displayP3' | 'bt2020' | undefined
console.log(descriptor.transfer?.function); // 'linear' (EXR is always scene-linear)

// EXR-specific metadata
const exrInfo = descriptor.formatSpecific as EXRFormatSpecific;
console.log(exrInfo.compression);           // 'zip' | 'piz' | ...
console.log(exrInfo.dataWindow);            // { xMin, yMin, xMax, yMax }
console.log(exrInfo.chromaticities);        // { red, green, blue, white } or undefined

// Force a specific data type
const { data: f32 } = await decode(exrBytes, { dataType: 'float32' });

// Decode to standard ImageData (tonemapped to 8-bit, for canvas preview)
const imageData = await decodeToImageData(exrBytes);
ctx.putImageData(imageData, 0, 0);

// Read metadata without decoding pixels
const info = await getImageInfo(exrBytes);
```

### Encode

```typescript
import { encode, encodeSimple } from '@dimkatet/jcodecs-exr';

// Full API — encode float TypedArray with an explicit descriptor
const exrBytes = await encode(
  float32Data,  // Float16Array | Float32Array
  {
    geometry: { width: 1920, height: 1080 },
    channels: { model: 'rgba', count: 4 },
    numeric: { dataType: 'float32' },
    color: { primaries: 'bt709' },
  },
  { compression: 'piz' },
);

// float16 encode with ZIP compression (default)
const exrBytes2 = await encode(
  float16Data,
  {
    geometry: { width, height },
    channels: { model: 'rgb', count: 3 },
    numeric: { dataType: 'float16' },
  },
  // compression defaults to 'zip'
);

// Override output data type (e.g. encode float16 as float32)
const promoted = await encode(float16Data, descriptor, { dataType: 'float32' });

// Simple API — encode from standard ImageData (converts uint8 → float32)
const simple = await encodeSimple(imageData, 'piz');
```

### Worker Pool

```typescript
import {
  createWorkerPool,
  encodeInWorker,
  decodeInWorker,
  terminateWorkerPool,
} from '@dimkatet/jcodecs-exr';

const pool = await createWorkerPool({
  type: 'decoder',
  poolSize: 4,
  preferMT: true,
});

const { data, descriptor } = await decodeInWorker(pool, exrBytes);
const encoded = await encodeInWorker(pool, data, descriptor, { compression: 'zip' });

terminateWorkerPool(pool);
```

## API Reference

### `decode(input, options?, config?)`

```typescript
decode(
  input: Uint8Array | ArrayBuffer,
  options?: EXRDecodeOptions,
  config?: InitConfig,
): Promise<{ data: Float16Array | Float32Array; descriptor: ImageDescriptor }>

interface EXRDecodeOptions {
  dataType?: 'auto' | 'float16' | 'float32';  // default: 'auto' (from file)
  maxThreads?: number;                          // 0 = auto, max: 8
}
```

### `encode(data, descriptor, options?, config?)`

```typescript
encode(
  data: Float16Array | Float32Array,
  descriptor: EXREncodeDescriptor,
  options?: EXREncodeOptions,
  config?: InitConfig,
): Promise<Uint8Array>

interface EXREncodeDescriptor {
  geometry: { width: number; height: number };
  channels: {
    model: 'rgb' | 'rgba';
    count: 3 | 4;
  };
  numeric: { dataType: 'float16' | 'float32' };
  color?: { primaries?: 'bt709' | 'displayP3' | 'bt2020' };
}

interface EXREncodeOptions {
  compression?: EXRCompression;  // default: 'zip'
  dataType?: 'float16' | 'float32';  // Override output type (default: from descriptor)
  maxThreads?: number;           // 0 = auto, max: 8
}
```

### `encodeSimple(imageData, compression?)`

```typescript
encodeSimple(
  imageData: ImageData,
  compression?: EXRCompression,
): Promise<Uint8Array>
// Converts uint8 [0, 255] → float32 [0, 1]
// compression defaults to 'zip'
```

### `getImageInfo(input)`

```typescript
getImageInfo(input: Uint8Array | ArrayBuffer): Promise<ImageDescriptor>
```

### `decodeToImageData(input, options?)`

```typescript
decodeToImageData(
  input: Uint8Array | ArrayBuffer,
  options?: EXRDecodeOptions,
): Promise<ImageData>
// Tonemaps float data to 8-bit for canvas display
```

### Worker Pool API

```typescript
interface WorkerPoolConfig {
  type?: 'decoder' | 'encoder' | 'both';
  poolSize?: number;
  preferMT?: boolean;
  lazyInit?: boolean;
}

createWorkerPool(config?: WorkerPoolConfig): Promise<EXRWorkerClient>
decodeInWorker(client, input, options?): Promise<{ data; descriptor }>
encodeInWorker(client, data, descriptor, options?): Promise<Uint8Array>
getWorkerPoolStats(client): PoolStats
terminateWorkerPool(client): void
isWorkerPoolInitialized(client): boolean
```

### Init

```typescript
interface InitConfig {
  jsUrl?: string;      // Custom WASM module URL
  preferMT?: boolean;
}

init(config?: InitConfig): Promise<void>
isInitialized(): boolean
isMultiThreaded(): boolean
```

## Compression Modes

| Mode | Type | Best for |
|------|------|----------|
| `'none'` | Lossless | Maximum speed, largest files |
| `'rle'` | Lossless | Images with flat areas |
| `'zips'` | Lossless | Single scanline ZIP |
| `'zip'` | Lossless | **Default.** General purpose |
| `'piz'` | Lossless | Noisy/grainy images (film grain, renders) |
| `'pxr24'` | Lossy | Smaller files, slight precision loss for float32 |
| `'dwaa'` | Lossy | Best compression ratio (32-scanline blocks) |
| `'dwab'` | Lossy | Best compression ratio (256-scanline blocks) |

```typescript
type EXRCompression = 'none' | 'rle' | 'zips' | 'zip' | 'piz' | 'pxr24' | 'dwaa' | 'dwab';
```

## Data Types

EXR only supports floating-point pixel data:

| `dataType` | `data` array | Precision | Use case |
|------------|--------------|-----------|----------|
| `'float16'` | `Float16Array` | half (5e + 10m) | Render outputs, HDR video |
| `'float32'` | `Float32Array` | single (8e + 23m) | VFX, maximum precision |

`'auto'` (default decode option) preserves the file's native type.

## EXR Format-Specific Metadata

Accessible via `descriptor.formatSpecific`:

```typescript
interface EXRFormatSpecific {
  compression: EXRCompression;
  dataWindow: {
    xMin: number; yMin: number;
    xMax: number; yMax: number;
  };
  displayWindow: {
    xMin: number; yMin: number;
    xMax: number; yMax: number;
  };
  chromaticities?: {
    red:   [x: number, y: number];
    green: [x: number, y: number];
    blue:  [x: number, y: number];
    white: [x: number, y: number];
  };
}

// Usage
const { descriptor } = await decode(exrBytes);
const exr = descriptor.formatSpecific as EXRFormatSpecific;
console.log(exr.compression);       // 'piz'
console.log(exr.dataWindow.xMax);   // pixel width - 1
```

## Color Space

EXR files embed chromaticity coordinates. The decoder maps them to `ColorPrimaries`:

| EXR chromaticities | `descriptor.color.primaries` |
|--------------------|------------------------------|
| Rec. 709 / sRGB | `'bt709'` |
| DCI-P3 | `'displayP3'` |
| Rec. 2020 | `'bt2020'` |
| Other / missing | `undefined` (raw in `formatSpecific.chromaticities`) |

EXR images are always scene-linear, so `descriptor.transfer.function` is `'linear'`.

## Multi-threading

Requires HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

```typescript
import { isMultiThreadSupported } from '@dimkatet/jcodecs-exr';

if (isMultiThreadSupported()) {
  // Can use preferMT: true
}
```

## Example: Load EXR and draw on canvas

```typescript
import { decode } from '@dimkatet/jcodecs-exr';

const { data, descriptor } = await decode(exrBytes);
const { width, height } = descriptor.geometry;

// Manual tonemapping (simple linear → display)
const imageData = new ImageData(width, height);
for (let i = 0; i < width * height; i++) {
  // data is Float32Array with RGBA channels
  imageData.data[i * 4 + 0] = Math.min(255, data[i * 4 + 0] * 255);
  imageData.data[i * 4 + 1] = Math.min(255, data[i * 4 + 1] * 255);
  imageData.data[i * 4 + 2] = Math.min(255, data[i * 4 + 2] * 255);
  imageData.data[i * 4 + 3] = 255;
}
ctx.putImageData(imageData, 0, 0);

// Or use decodeToImageData() for automatic tonemapping:
const preview = await decodeToImageData(exrBytes);
ctx.putImageData(preview, 0, 0);
```

## Native Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| OpenEXR | 3.x | EXR codec |
| Imath | latest | Math / half-float |
| IlmThread | latest | Threading support |

## License

MIT
