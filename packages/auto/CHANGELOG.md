# @dimkatet/jcodecs-auto

## 0.6.0

### Minor Changes

- Replace free-function worker API with method-based `WorkerHandle`.

  **Breaking:** `decodeInWorker`, `encodeInWorker`, `transcodeInWorker`, `terminateWorkerPool`, `getWorkerPoolStats`, `isWorkerPoolInitialized`, `isCodecPoolInitialized` are removed from all packages. Use pool methods instead:

  ```ts
  // before
  const { data, descriptor } = await decodeInWorker(pool, input);
  terminateWorkerPool(pool);

  // after
  const { data, descriptor } = await pool.decode(input);
  pool.terminate();
  ```

  **New in core:** `WorkerHandle` interface, `createWorkerHandle()` factory, `normalizeWorkerInput()` — exported from `@dimkatet/jcodecs-core/codec-worker-client`.

  **Renamed types:** `AVIFWorkerClient` → `AVIFWorkerHandle`, `JXLWorkerClient` → `JXLWorkerHandle`, `EXRWorkerClient` → `EXRWorkerHandle`. Old names kept as deprecated aliases.

### Patch Changes

- Updated dependencies
  - @dimkatet/jcodecs-core@0.7.0
  - @dimkatet/jcodecs-avif@0.7.0
  - @dimkatet/jcodecs-jxl@0.4.0
  - @dimkatet/jcodecs-exr@0.2.0

## 0.5.0

### Minor Changes

- Add EXR format support via optional peer dependency `@dimkatet/jcodecs-exr`.

  - `detectFormat()` now recognises EXR magic bytes (`0x762f3101`)
  - `decode()` / `decodeToImageData()` / `getImageInfo()` route to EXR codec
  - `encode()` / `encodeSimple()` / `transcode()` support `format: 'exr'`
  - Worker API: `decodeInWorker` / `encodeInWorker` / `transcodeInWorker` handle EXR
  - `AutoWorkerClient` exposes `.exr` pool; `getWorkerPoolStats` includes EXR stats
  - New type guard: `isEXRImageData()`
  - Re-exports: `EXRImageData`, `EXREncodeDescriptor`, `EXREncodeOptions`, `EXRDecodeOptions`

- Descriptor-based encode: `AutoImageData.descriptor` is now passed through to the
  codec as-is. Removed `bitDepth`, `colorSpace`, `transferFunction` from
  `AutoEncodeOptions` (descriptor mutations are the caller's responsibility).
  Removed `ColorSpace` and `TransferFunctionOption` type aliases.

### Patch Changes

- Updated dependencies
  - @dimkatet/jcodecs-avif@0.6.1
  - @dimkatet/jcodecs-jxl@0.3.1

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
