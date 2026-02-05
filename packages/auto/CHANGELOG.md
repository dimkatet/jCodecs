# @dimkatet/jcodecs-auto

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
