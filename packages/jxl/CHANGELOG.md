# @dimkatet/jcodecs-jxl

## 0.2.0

### Minor Changes

- A new package for encoding and decoding JPEG-XL images based on libjxl.

  Supports HDR formats: float16, float32, and 8/10/12/16-bit integers. The decoder automatically detects the format from the file. The encoder accepts quality, effort, lossless, and progressive options.

  Support for color spaces (sRGB, Display-P3, Rec. 2020) and transfer functions (sRGB, PQ, HLG, linear) is implemented. Multithreading for up to 8 threads via pthread. Includes a Worker Pool API for off-main-thread processing.

## 0.1.1

### Patch Changes

- Updated dependencies
  - @dimkatet/jcodecs-core@0.5.0
