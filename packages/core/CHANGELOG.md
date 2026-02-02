# @dimkatet/jcodecs-core

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
