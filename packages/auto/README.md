# @dimkatet/jcodecs-auto

Unified image codec API with automatic format detection.

Supports AVIF, JPEG-XL, and OpenEXR. Install only the codecs you need — they are optional peer dependencies.

## Installation

```bash
# All codecs
npm install @dimkatet/jcodecs-auto @dimkatet/jcodecs-avif @dimkatet/jcodecs-jxl @dimkatet/jcodecs-exr

# Or only the formats you support
npm install @dimkatet/jcodecs-auto @dimkatet/jcodecs-avif @dimkatet/jcodecs-jxl
npm install @dimkatet/jcodecs-auto @dimkatet/jcodecs-exr
```

## Features

- Auto-detects format from magic bytes (EXR → JXL → AVIF)
- Unified `decode` / `encode` / `transcode` API across all codecs
- All codecs return the same `ImageDescriptor` type — no format-specific metadata handling
- Type guards for format-narrowing (`isAVIFImageData`, `isJXLImageData`, `isEXRImageData`)
- Graceful handling of missing codecs (`CodecNotInstalledError`)
- Per-format option overrides

## Quick Start

### Decode

```typescript
import { decode, decodeToImageData, getImageInfo, detectFormat } from '@dimkatet/jcodecs-auto';

const buffer = await fetch('unknown.img').then(r => r.arrayBuffer());

// Optional: inspect format before decoding
const format = detectFormat(buffer); // 'avif' | 'jxl' | 'exr' | 'unknown'

// Auto-detect and decode
const { data, descriptor, format: fmt } = await decode(buffer);

console.log(fmt);                              // 'avif' | 'jxl' | 'exr'
console.log(descriptor.geometry.width);
console.log(descriptor.numeric.dataType);      // 'uint8' | 'float32' | ...
console.log(descriptor.color?.primaries);      // 'bt709' | 'bt2020' | ...
console.log(descriptor.transfer?.function);    // 'pq' | 'hlg' | 'linear' | ...
console.log(descriptor.hdr?.maxCLL);

// Decode to standard 8-bit ImageData (for canvas)
const imageData = await decodeToImageData(buffer);
ctx.putImageData(imageData, 0, 0);

// Metadata only (no pixel decode)
const { descriptor: info, format: infoFmt } = await getImageInfo(buffer);
```

### Encode

```typescript
import { encode, encodeSimple } from '@dimkatet/jcodecs-auto';

// Encode from decoded AutoImageData
const avifBytes = await encode(decoded, { format: 'avif', quality: 80 });
const jxlBytes  = await encode(decoded, { format: 'jxl',  quality: 85, lossless: false });
const exrBytes  = await encode(decoded, { format: 'exr',  exr: { compression: 'piz' } });

// Encode from standard ImageData
const avif2 = await encode(imageData, { format: 'avif', quality: 75 });

// Simple encode (ImageData + format + optional quality)
const simple = await encodeSimple(imageData, 'avif', 80);
const simpleJxl = await encodeSimple(imageData, 'jxl');
```

### Transcode

```typescript
import { transcode } from '@dimkatet/jcodecs-auto';

// Convert any format to another in one call
const jxlBytes  = await transcode(avifBuffer, 'jxl',  { quality: 90 });
const avifBytes = await transcode(jxlBuffer,  'avif', { quality: 80 });
const exrBytes  = await transcode(avifBuffer, 'exr',  { exr: { compression: 'zip' } });
```

### Format-Specific Options

```typescript
import { encode } from '@dimkatet/jcodecs-auto';

// Common options apply across formats
const result = await encode(decoded, {
  format: 'avif',
  quality: 80,
  maxThreads: 4,
});

// Per-codec overrides take precedence
const result2 = await encode(decoded, {
  format: 'avif',
  quality: 80,
  avif: { speed: 4, tune: 'ssim' },
});

const result3 = await encode(decoded, {
  format: 'jxl',
  quality: 85,
  jxl: { effort: 9, progressive: true },
});

const result4 = await encode(decoded, {
  format: 'exr',
  exr: { compression: 'dwab', dataType: 'float16' },
});
```

### Type Guards

```typescript
import { decode, isAVIFImageData, isJXLImageData, isEXRImageData } from '@dimkatet/jcodecs-auto';

const decoded = await decode(buffer);

if (isAVIFImageData(decoded)) {
  // decoded.format === 'avif'
  // TypeScript knows this
}

if (isJXLImageData(decoded)) {
  // decoded.format === 'jxl'
}

if (isEXRImageData(decoded)) {
  // decoded.format === 'exr'
  // EXR-specific info in decoded.descriptor.formatSpecific
}
```

### Check Available Codecs

```typescript
import { isCodecAvailable, getAvailableFormats } from '@dimkatet/jcodecs-auto';

isCodecAvailable('avif'); // true if @dimkatet/jcodecs-avif is installed
isCodecAvailable('exr');  // true if @dimkatet/jcodecs-exr is installed

const formats = getAvailableFormats(); // e.g. ['avif', 'jxl', 'exr']
```

### Worker Pool

```typescript
import {
  createWorkerPool,
  decodeInWorker,
  encodeInWorker,
  transcodeInWorker,
  terminateWorkerPool,
} from '@dimkatet/jcodecs-auto';

const pool = await createWorkerPool({
  poolSize: 4,
  preferMT: true,
  // Per-codec pool config
  avif: { poolSize: 4 },
  jxl:  { poolSize: 4 },
  exr:  { poolSize: 2 },
});

// Decode (format auto-detected)
const decoded = await decodeInWorker(pool, buffer);

// Encode in worker
const encoded = await encodeInWorker(pool, decoded, { format: 'jxl', quality: 85 });

// Transcode in worker (decode + encode in single call)
const transcoded = await transcodeInWorker(pool, avifBuffer, 'exr', {
  exr: { compression: 'piz' },
});

terminateWorkerPool(pool);
```

## API Reference

### Format Detection

```typescript
detectFormat(data: Uint8Array | ArrayBuffer): ImageFormat
// 'avif' | 'jxl' | 'exr' | 'unknown'

getFormatExtension(format: ImageFormat): string
// '.avif' | '.jxl' | '.exr' | ''

getMimeType(format: ImageFormat): string
// 'image/avif' | 'image/jxl' | 'image/x-exr' | 'application/octet-stream'
```

**Detection order** (priority): EXR → JXL → AVIF

| Format | Magic bytes |
|--------|-------------|
| EXR | `76 2F 31 01` |
| JXL codestream | `FF 0A` |
| JXL container | 12-byte box signature |
| AVIF | `ftyp` box at offset 4, brand `avif`/`avis`/`mif1` at offset 8 |

### Decode Functions

```typescript
decode(
  input: Uint8Array | ArrayBuffer,
  options?: AutoDecodeOptions,
): Promise<AutoImageData>

decodeToImageData(
  input: Uint8Array | ArrayBuffer,
  options?: AutoDecodeOptions,
): Promise<ImageData & { format: ImageFormat }>

getImageInfo(
  input: Uint8Array | ArrayBuffer,
  options?: Pick<AutoDecodeOptions, 'format'>,
): Promise<AutoImageInfo>
```

### Encode Functions

```typescript
encode(
  input: AutoImageData | ImageData,
  options: AutoEncodeOptions,
): Promise<Uint8Array>

encodeSimple(
  imageData: ImageData,
  format: 'avif' | 'jxl' | 'exr',
  quality?: number,
): Promise<Uint8Array>

transcode(
  input: Uint8Array | ArrayBuffer,
  targetFormat: 'avif' | 'jxl' | 'exr',
  options?: Omit<AutoEncodeOptions, 'format'>,
): Promise<Uint8Array>
```

### Options

```typescript
interface AutoDecodeOptions {
  format?: ImageFormat;              // Force format (skip detection)
  bitDepth?: 0 | 8 | 10 | 12 | 16;  // 0 = auto (default)
  maxThreads?: number;               // 0 = auto (default)
  ignoreColorProfile?: boolean;      // default: false
  avif?: AVIFDecodeOptions;
  jxl?: JXLDecodeOptions;
  exr?: EXRDecodeOptions;
}

interface AutoEncodeOptions {
  format: 'avif' | 'jxl' | 'exr';  // required
  quality?: number;                  // 0–100, default: 75
  maxThreads?: number;               // default: 0 (auto)
  lossless?: boolean;                // default: false (AVIF/JXL only)
  avif?: AVIFEncodeOptions;
  jxl?: JXLEncodeOptions;
  exr?: EXREncodeOptions;
}
```

### Types

```typescript
type ImageFormat = 'avif' | 'jxl' | 'exr' | 'unknown';

interface AutoImageData {
  data: Uint8Array | Uint16Array | Float16Array | Float32Array;
  descriptor: ImageDescriptor;
  format: 'avif' | 'jxl' | 'exr';
}

interface AutoImageInfo {
  descriptor: ImageDescriptor;
  format: 'avif' | 'jxl' | 'exr';
}

// Type guards
isAVIFImageData(data: AutoImageData): boolean
isJXLImageData(data: AutoImageData): boolean
isEXRImageData(data: AutoImageData): boolean
```

## Error Handling

```typescript
import {
  decode,
  CodecNotInstalledError,
  CodecLoadError,
  UnsupportedFormatError,
} from '@dimkatet/jcodecs-auto';

try {
  const decoded = await decode(buffer);
} catch (error) {
  if (error instanceof CodecNotInstalledError) {
    // Install the missing package
    console.error(`Install @dimkatet/jcodecs-${error.format}`);
  } else if (error instanceof UnsupportedFormatError) {
    console.error('Unknown image format');
  } else if (error instanceof CodecLoadError) {
    console.error(`Failed to load ${error.format} codec:`, error.cause);
  }
}
```

## Multi-threading

Requires HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

```typescript
import { isMultiThreadSupported } from '@dimkatet/jcodecs-auto';

if (isMultiThreadSupported()) {
  // Can use preferMT: true in worker pool config
}
```

## License

MIT
