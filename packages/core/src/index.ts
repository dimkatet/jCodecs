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

// Worker pool
export { WorkerPool } from './worker-pool';
export type { WorkerTask, WorkerResult } from './worker-pool';

// Codec worker helpers
export { createCodecWorker } from './codec-worker';
export type { CodecWorkerHandlers } from './codec-worker';
export { CodecWorkerClient } from './codec-worker-client';
export type { CodecWorkerClientConfig } from './codec-worker-client';
