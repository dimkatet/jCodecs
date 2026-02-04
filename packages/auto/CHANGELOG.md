# @dimkatet/jcodecs-auto

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
