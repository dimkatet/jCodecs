# @dimkatet/jcodecs-avif

## 0.3.0

### Minor Changes

- - Removed `useThreads` from decode options - MT is now auto-detected
  - `WorkerPoolConfig.decoder: { jsUrl, wasmUrl }` → `WorkerPoolConfig.decoderJsUrl`
  - `InitConfig.wasmUrl` removed - WASM is now embedded in JS files

  - Auto-detect multi-threaded support based on `SharedArrayBuffer` availability
  - WASM embedded in JS via `SINGLE_FILE` flag (~33% larger but simpler deployment)
  - Warning logged when `maxThreads > 1` requested but MT unavailable

  - Simplified internal architecture (single module variable)
  - Reduced configuration complexity

## 0.2.1

### Patch Changes

- fix: bundle @jcodecs/core into worker.js to make it self-contained

## 0.2.0

### Minor Changes

- c32e34d: feat: AVIF decoder with multi-threaded decoding and full HDR metadata support

### Patch Changes

- Updated dependencies [c32e34d]
  - @dimkatet/jcodecs-core@0.2.0
