# @jcodecs/auto

Auto-detect image format and unified codec API for jCodecs.

Automatically selects the appropriate codec (AVIF or JPEG-XL) based on file magic bytes.

## Installation

```bash
# Install with both codecs
npm install @jcodecs/auto @jcodecs/avif @jcodecs/jxl

# Or with only the codecs you need
npm install @jcodecs/auto @jcodecs/avif   # AVIF only
npm install @jcodecs/auto @jcodecs/jxl    # JPEG-XL only
```

## Features

- **Auto-detection** - Detects format from magic bytes
- **Unified API** - Same interface for all codecs
- **Peer Dependencies** - Install only codecs you need
- **Type Safety** - Discriminated unions for format-specific metadata
- **Transcode** - Convert between formats in one call

## Quick Start

### Decode (Auto-detect)

```typescript
import { decode, detectFormat } from '@jcodecs/auto';

// Load unknown image
const buffer = await fetch('image.unknown').then(r => r.arrayBuffer());

// Check format before decoding
const format = detectFormat(buffer);
console.log(format); // 'avif' | 'jxl' | 'unknown'

// Decode with auto-detection
const decoded = await decode(buffer);
console.log(decoded.format);  // 'avif' or 'jxl'
console.log(decoded.width, decoded.height);
console.log(decoded.metadata); // Format-specific metadata
```

### Encode

```typescript
import { encode, encodeSimple } from '@jcodecs/auto';

// Encode to AVIF
const avifBytes = await encode(imageData, {
  format: 'avif',
  quality: 80,
});

// Encode to JXL
const jxlBytes = await encode(imageData, {
  format: 'jxl',
  quality: 85,
  lossless: true,
});

// Simple encode (quality only)
const simple = await encodeSimple(imageData, 'avif', 75);
```

### Transcode

```typescript
import { transcode } from '@jcodecs/auto';

// Convert AVIF to JXL
const jxlBytes = await transcode(avifBuffer, 'jxl', {
  quality: 90,
});

// Convert JXL to AVIF
const avifBytes = await transcode(jxlBuffer, 'avif', {
  quality: 80,
  bitDepth: 10,
});
```

### Type Narrowing

```typescript
import { decode, isAVIFImageData, isJXLImageData } from '@jcodecs/auto';

const decoded = await decode(buffer);

if (isAVIFImageData(decoded)) {
  // TypeScript knows this is AVIF
  console.log(decoded.metadata.matrixCoefficients);
}

if (isJXLImageData(decoded)) {
  // TypeScript knows this is JXL
  console.log(decoded.metadata.isAnimated);
  console.log(decoded.metadata.frameCount);
}
```

### Format-Specific Options

```typescript
import { encode } from '@jcodecs/auto';

// Common options apply to both formats
const result = await encode(imageData, {
  format: 'avif',
  quality: 80,
  bitDepth: 10,
  colorSpace: 'display-p3',
});

// Override with format-specific options
const result2 = await encode(imageData, {
  format: 'avif',
  quality: 80,
  avif: {
    speed: 4,
    chromaSubsampling: '4:4:4',
    tune: 'ssim',
  },
});

const result3 = await encode(imageData, {
  format: 'jxl',
  quality: 85,
  jxl: {
    effort: 9,
    progressive: true,
  },
});
```

### Check Available Codecs

```typescript
import { isCodecAvailable, getAvailableFormats } from '@jcodecs/auto';

// Check specific codec
if (isCodecAvailable('avif')) {
  console.log('AVIF codec is installed');
}

// List all available codecs
const formats = getAvailableFormats();
console.log(formats); // ['avif', 'jxl'] or subset
```

## Worker Pool

```typescript
import {
  createWorkerPool,
  decodeInWorker,
  encodeInWorker,
  transcodeInWorker,
  terminateWorkerPool,
} from '@jcodecs/auto';

// Create pool
const pool = await createWorkerPool({
  poolSize: 4,
  preferMT: true,
});

// Decode in worker (auto-detects format)
const decoded = await decodeInWorker(pool, buffer);

// Encode in worker
const encoded = await encodeInWorker(pool, decoded, {
  format: 'jxl',
  quality: 85,
});

// Transcode in worker (decode + encode in single call)
const transcoded = await transcodeInWorker(pool, avifBuffer, 'jxl', {
  quality: 90,
});

// Cleanup
terminateWorkerPool(pool);
```

## API Reference

### Decode Functions

| Function | Description |
|----------|-------------|
| `decode(buffer, options?)` | Decode to `AutoImageData` (preserves bit depth) |
| `decodeToImageData(buffer, options?)` | Decode to standard `ImageData` (8-bit) |
| `getImageInfo(buffer, options?)` | Get dimensions/metadata without full decode |

### Encode Functions

| Function | Description |
|----------|-------------|
| `encode(imageData, options)` | Encode with full options |
| `encodeSimple(imageData, format, quality?)` | Simple quality-only encode |
| `transcode(buffer, targetFormat, options?)` | Decode + encode in one call |

### Format Detection

| Function | Description |
|----------|-------------|
| `detectFormat(buffer)` | Returns `'avif'` \| `'jxl'` \| `'unknown'` |
| `getFormatExtension(format)` | Returns `'.avif'` \| `'.jxl'` \| `''` |
| `getMimeType(format)` | Returns `'image/avif'` \| `'image/jxl'` \| `'application/octet-stream'` |
| `isCodecAvailable(format)` | Check if codec is installed |
| `getAvailableFormats()` | List installed codecs |

### Types

```typescript
type ImageFormat = 'avif' | 'jxl' | 'unknown';

interface AutoImageData {
  data: Uint8Array | Uint16Array | Float16Array | Float32Array;
  dataType: 'uint8' | 'uint16' | 'float16' | 'float32';
  bitDepth: number;
  width: number;
  height: number;
  channels: number;
  format: ImageFormat;
  metadata: AutoMetadata;
}

type AutoMetadata =
  | ({ format: 'avif' } & AVIFMetadata)
  | ({ format: 'jxl' } & JXLMetadata);
```

## Error Handling

```typescript
import {
  decode,
  CodecNotInstalledError,
  UnsupportedFormatError,
} from '@jcodecs/auto';

try {
  const decoded = await decode(buffer);
} catch (error) {
  if (error instanceof CodecNotInstalledError) {
    console.error(`Install @jcodecs/${error.format} to decode this format`);
  } else if (error instanceof UnsupportedFormatError) {
    console.error('Unknown image format');
  }
}
```

## License

MIT
