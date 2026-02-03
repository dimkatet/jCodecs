# jCodecs Browser Example (React)

React-based example application for testing jCodecs (AVIF, JPEG-XL).

## Features

- **Format selector**: Choose output format independently from input (e.g., decode AVIF → encode to JXL)
- **Format-agnostic architecture**: Easy to add new formats
- **Dynamic controls**: Input controls automatically adapt to selected format
- **Metadata display**: Full metadata visualization for decoded images
- **API mode switching**: Easy toggle between Direct API and Worker Pool API
- **Clean component structure**: Fully decomposed React components

## Project Structure

```
src/
├── components/
│   ├── FileUpload.tsx          # File upload component
│   ├── ImagePreview.tsx        # Canvas + metadata display
│   ├── DynamicControls.tsx     # Dynamic form controls
│   └── FormatSelector.tsx      # Output format selector
├── config/
│   ├── api-mode.ts             # API mode configuration (Direct/Worker)
│   └── formats.ts              # Format definitions (AVIF, JXL)
├── types/
│   └── format-config.ts        # Type definitions for formats
├── utils/
│   ├── codec.ts                # Codec abstraction layer
│   └── image.ts                # Image utilities
├── App.tsx                     # Main application
└── main.tsx                    # Entry point
```

## How to Switch API Mode

Open [src/config/api-mode.ts](src/config/api-mode.ts) and change `API_MODE`:

```typescript
// Use Direct API (blocks main thread, simpler)
export const API_MODE: ApiMode = 'direct';

// Use Worker Pool API (non-blocking, better for heavy tasks)
export const API_MODE: ApiMode = 'worker';
```

Configuration options for each mode:

```typescript
// Worker Pool config
export const WORKER_CONFIG = {
  poolSize: 1,        // Number of workers
  preferMT: true,     // Use multi-threaded WASM
  lazyInit: false,    // Initialize immediately
};

// Direct API config
export const DIRECT_CONFIG = {
  preferMT: true,     // Use multi-threaded WASM
};

// Threading config (both modes)
export const THREAD_CONFIG = {
  maxThreads: 8,      // Max threads per encode/decode
};
```

## How to Add a New Format

1. **Add format config** in [src/config/formats.ts](src/config/formats.ts):

```typescript
export const WEBP_FORMAT: FormatConfig = {
  name: 'WebP',
  extension: 'webp',
  mimeType: 'image/webp',
  controls: [
    {
      type: 'slider',
      key: 'quality',
      label: 'Quality',
      min: 0,
      max: 100,
      defaultValue: 80,
    },
    {
      type: 'checkbox',
      key: 'lossless',
      label: 'Lossless',
      defaultValue: false,
    },
  ],
};

// Add to FORMATS registry
export const FORMATS: Record<string, FormatConfig> = {
  avif: AVIF_FORMAT,
  jxl: JXL_FORMAT,
  webp: WEBP_FORMAT, // <-- Add here
};
```

2. **Add codec support** in [src/utils/codec.ts](src/utils/codec.ts):

```typescript
import { decode as decodeWebp, encode as encodeWebp } from '@jcodecs/webp';

// In decode():
if (format === 'webp') {
  return await decodeWebp(data, options, DIRECT_CONFIG);
}

// In encode():
if (format === 'webp') {
  return await encodeWebp(imageData, encodeOptions, DIRECT_CONFIG);
}
```

3. **Update accepted formats** in [src/App.tsx](src/App.tsx):

```typescript
<FileUpload
  onFileSelect={handleFileSelect}
  acceptedFormats={['avif', 'jxl', 'webp']}
/>
```

## Control Types

Three control types are supported:

### Slider

```typescript
{
  type: 'slider',
  key: 'quality',
  label: 'Quality',
  min: 0,
  max: 100,
  defaultValue: 75,
  step?: 1,
}
```

### Select

```typescript
{
  type: 'select',
  key: 'bitDepth',
  label: 'Bit Depth',
  options: [
    { value: 8, label: '8-bit' },
    { value: 10, label: '10-bit' },
  ],
  defaultValue: 8,
}
```

### Checkbox

```typescript
{
  type: 'checkbox',
  key: 'lossless',
  label: 'Lossless',
  defaultValue: false,
}
```

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build
pnpm build
```

## Notes

- The old vanilla TypeScript code is saved as `main.ts.old` for reference
- Multi-threaded WASM requires COOP/COEP headers (configured in [vite.config.ts](vite.config.ts))
- Metadata is automatically extracted and displayed for decoded images
