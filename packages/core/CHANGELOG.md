# @dimkatet/jcodecs-core

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
