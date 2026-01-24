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
