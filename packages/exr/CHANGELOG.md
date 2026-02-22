# @dimkatet/jcodecs-exr

## 0.1.0

### Minor Changes

- Initial release: OpenEXR encoder/decoder using OpenEXR 3.x compiled to WebAssembly.

  - **Decoder**: reads `.exr` files (EXR magic `0x762f3101`), outputs `float16` or
    `float32` pixel data with full `ImageDescriptor` metadata
  - **Encoder**: encodes float16/float32 pixel data to EXR with configurable
    compression (none, rle, zips, zip, piz, pxr24, dwaa, dwab)
  - **HDR support**: scene-linear light, arbitrary channel models (rgb/rgba/custom)
  - **Multi-threading**: MT and ST WASM modules (`exr_dec.js`, `exr_dec_mt.js`,
    `exr_enc.js`, `exr_enc_mt.js`) via pthread
  - **Worker Pool API**: `createWorkerPool`, `decodeInWorker`, `encodeInWorker`
  - **Descriptor-based API**: `ImageDescriptor` for both decode output and encode input
