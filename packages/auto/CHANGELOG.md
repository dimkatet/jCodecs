# @dimkatet/jcodecs-auto

## 0.4.0

### Minor Changes

- Introduce Canonical Image Descriptor (CID) — breaking API change.

  All codecs now return `{ data, descriptor: ImageDescriptor }` instead of flat
  `ExtendedImageData`. Encoders take `(data, descriptor, options?)` instead of
  `(imageData, options)`.

  - **core**: new `ImageDescriptor` type hierarchy (geometry, channels, numeric,
    color, transfer, luminance, sampling, alpha, hdr, rendering); C++ descriptor
    builder with Embind bindings; `normalizeDescriptor()` helper
  - **avif**: `AVIFImageData` and `AVIFEncodeDescriptor`; `bitDepth` in decode
    options; remove `AVIFMetadata`, `ColorPrimaries`, `MasteringDisplay` etc.
  - **jxl**: `JXLImageData` and `JXLEncodeDescriptor`; restore `bitDepth` in
    decode options; float16/float32 encode support via `copyToWasm16f/32f`
  - **auto**: `AutoImageData` uses `ImageDescriptor` directly; unified encode
    builds descriptor from source image + option overrides

### Patch Changes

- Updated dependencies
  - @dimkatet/jcodecs-core@0.6.0
  - @dimkatet/jcodecs-avif@0.6.0
  - @dimkatet/jcodecs-jxl@0.3.0

## 0.3.1

### Patch Changes

- Updated dependencies
  - @dimkatet/jcodecs-avif@0.5.1
  - @dimkatet/jcodecs-jxl@0.2.1

## 0.3.0

### Minor Changes

- Now implements a facade pattern over codec-specific worker pools (avif, jxl, and future ones), instead of attempting a single unified worker with dynamic imports.

  - `createWorkerPool()` → creates and manages codec pools (lazy-initialized on demand)
  - `decodeInWorker()` / `encodeInWorker()` → delegate to the appropriate pool after format detection
  - `autoDecode()` / `autoEncode()` → convenient main-thread wrappers with auto-detection
  - `detectFormat()` → fast detector in main thread

## 0.2.1

### Patch Changes

- Fix build script

## 0.2.0

### Minor Changes

- feat(auto): add @jcodecs/auto package for automatic format detection

  - Auto-detect image format from magic bytes (AVIF/JXL)
  - Unified decode/encode API across all codecs
  - Transcode function for format conversion
  - Peer dependencies on codec packages (install only what you need)
  - Type-safe discriminated unions for format-specific metadata
  - Worker pool support for non-blocking operations
