// Core types re-exported for convenience
export type { CodecImageData, ImageDescriptor } from '@dimkatet/jcodecs-core';

// Operations
export { resize } from './resize';
export { crop }   from './crop';
export { rotate } from './rotate';

// Init / state
export { init, isInitialized } from './_module';
export type { InitConfig } from './_module';

// Worker pool
export { createWorkerPool } from './worker-api';
export type { ProcessingWorkerHandle } from './worker-api';

// Options & types
export type { ResizeOptions, WorkerPoolConfig } from './options';
export { DEFAULT_RESIZE_OPTIONS } from './options';
export type { ResizeAlgorithm } from './types';
