// Types
export type {
  ExtendedImageData,
  ImageInfo,
  ProgressCallback,
  CodecModule,
  EmscriptenModuleConfig,
} from './types';

// Memory utilities
export { WASMMemoryManager, WASMResourceRegistry } from './memory';
export type { WASMModule } from './memory';

// WASM utils (standalone functions)
export {
  copyToWasm,
  copyFromWasm,
  copyFromWasm16,
  withWasmBuffer,
} from './wasm-utils';

// Threading utilities
export { isMultiThreadSupported, validateThreadCount } from './threading';
export type { ThreadValidationResult } from './threading';

// Worker pool
export { WorkerPool } from './worker-pool';
export type { WorkerTask, WorkerResult } from './worker-pool';

// Codec worker helpers
export { createCodecWorker } from './codec-worker';
export { CodecWorkerClient } from './codec-worker-client';
export type { CodecWorkerClientConfig } from './codec-worker-client';

export type { CodecWorkerHandlers, CodecWorkerMethods } from './protocol';
