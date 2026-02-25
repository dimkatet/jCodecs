# @dimkatet/jcodecs-core

## 0.7.1

### Patch Changes

- Fix dynamic WASM import failing inside Web Workers

  Vite's `importAnalysis` plugin replaces `import(url)` with `__vite__wrapDynamicImport(...)` in dev mode. This helper is only available on the main thread — it's `undefined` inside Web Workers, causing all `createWorkerPool()` calls to fail with "Cannot read properties of undefined (reading 'wrapDynamicImport')".

  Added `importModule<T>(url)` utility to `@dimkatet/jcodecs-core` that wraps the dynamic import in `new Function` to escape bundler transforms. All codec packages now use it instead of bare `import(/* @vite-ignore */ url)`.

## 0.7.0

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

## 0.6.0

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

## 0.5.0

### Minor Changes

- Expanded data type support for working with HDR images.

  A DataType has been added to describe pixel data formats: uint8, uint16, float16, and float32. ExtendedImageData is now parameterized by data type, ensuring type safety when working with different formats.

  Helpers for copying float data to and from WASM memory have been added to wasm-utils: copyToWasm16f, copyToWasm32f, copyFromWasm16f, and copyFromWasm32f. A universal copyFromWasmByType has also been added, inferring the type of the returned array based on the DataType.

## 0.4.0

### Minor Changes

- Add threading and WASM utilities for codec reuse

  - Add `isMultiThreadSupported()` - check SharedArrayBuffer availability
  - Add `validateThreadCount()` - validate and clamp thread count to prevent deadlock
  - Add `copyToWasm()`, `copyFromWasm()`, `copyFromWasm16()` - standalone WASM memory helpers
  - Add `withWasmBuffer()` - RAII-style helper for safe memory management
  - New subpath exports: `@dimkatet/jcodecs-core/threading`, `@dimkatet/jcodecs-core/wasm-utils`

## 0.3.0

### Minor Changes

- Refactored codec worker protocol typings to use discriminated unions for message handling.

## 0.2.0

### Minor Changes

- c32e34d: feat: AVIF decoder with multi-threaded decoding and full HDR metadata support
