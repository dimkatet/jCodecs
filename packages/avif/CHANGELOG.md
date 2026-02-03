# @dimkatet/jcodecs-avif

## 0.5.0

### Minor Changes

- Package refactoring: The code has been split into modules for improved readability and reusability.

  The following files have been moved to separate ones: metadata.ts (metadata conversion from WASM), profiling.ts (encode/decode profiling), and validation.ts (dataType validation).

  Support for the DataType system from @jcodecs/core has been added. The decoder now uses copyFromWasmByType for type-safe data copying. Validation of TypedArray and dataType conformance during encoding has been added.

  Deprecated browser tests have been removed and the tests have been restructured.

## 0.4.2

### Patch Changes

- Updated dependencies
  - @dimkatet/jcodecs-core@0.5.0

## 0.4.1

### Patch Changes

- Updated dependencies

  - @dimkatet/jcodecs-core@0.4.0

- Migrate to shared utilities from @jcodecs/core

  - Use `isMultiThreadSupported`, `validateThreadCount`, `copyToWasm` from core
  - Remove duplicated utility functions
  - Re-export `isMultiThreadSupported` for backward compatibility

## 0.4.0

### Minor Changes

- - - **AVIF Encoder**: Full multi-threaded encoding support via libavif + aom

      - Single-threaded and multi-threaded (8 threads) variants
      - HDR encoding (10/12-bit, PQ, HLG, Rec.2020)
      - Quality, speed, and chroma subsampling controls

    - **Thread Safety**: Implemented maxThreads validation to prevent deadlock

      - MAX_THREADS constant (8) exported from WASM via Embind
      - Automatic clamping when maxThreads exceeds PTHREAD_POOL_SIZE
      - Runtime warnings for invalid configurations

    - **Worker Pool Improvements**: Enhanced worker API with flexible configuration
      - Separate pools for encoder/decoder with optimal strategies
      - `type` parameter: 'decoder' | 'encoder' | 'both'
      - Lazy initialization support
      - Full TypeScript type safety via generics

## 0.3.1

### Patch Changes

- Updated dependencies
  - @dimkatet/jcodecs-core@0.3.0

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
