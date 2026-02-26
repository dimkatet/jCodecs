# @dimkatet/jcodecs-exr

## 0.3.0

### Minor Changes

- ee989b9: Add Node.js support for worker pool and codec infrastructure

  Worker pool (`createWorkerPool`) now works in Node.js via `node:worker_threads`.
  No API changes required — all codec packages inherit this automatically through `@dimkatet/jcodecs-core`.

### Patch Changes

- Updated dependencies [ee989b9]
  - @dimkatet/jcodecs-core@0.8.0

## 0.2.1

### Patch Changes

- Fix dynamic WASM import failing inside Web Workers

  Vite's `importAnalysis` plugin replaces `import(url)` with `__vite__wrapDynamicImport(...)` in dev mode. This helper is only available on the main thread — it's `undefined` inside Web Workers, causing all `createWorkerPool()` calls to fail with "Cannot read properties of undefined (reading 'wrapDynamicImport')".

  Added `importModule<T>(url)` utility to `@dimkatet/jcodecs-core` that wraps the dynamic import in `new Function` to escape bundler transforms. All codec packages now use it instead of bare `import(/* @vite-ignore */ url)`.

- Updated dependencies
  - @dimkatet/jcodecs-core@0.7.1

## 0.2.0

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
