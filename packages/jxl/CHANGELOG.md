# @dimkatet/jcodecs-jxl

## 0.3.0

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

## 0.2.1

### Patch Changes

- - Extracted all URLs (mt/st decoder/encoder + worker) to a new file `urls.ts`
  - Updated decode/encode/worker-api to import from `./urls`
  - Added export `./urls` in package.json
  - Added `urls` entry in tsup.config

## 0.2.0

### Minor Changes

- A new package for encoding and decoding JPEG-XL images based on libjxl.

  Supports HDR formats: float16, float32, and 8/10/12/16-bit integers. The decoder automatically detects the format from the file. The encoder accepts quality, effort, lossless, and progressive options.

  Support for color spaces (sRGB, Display-P3, Rec. 2020) and transfer functions (sRGB, PQ, HLG, linear) is implemented. Multithreading for up to 8 threads via pthread. Includes a Worker Pool API for off-main-thread processing.

## 0.1.1

### Patch Changes

- Updated dependencies
  - @dimkatet/jcodecs-core@0.5.0
