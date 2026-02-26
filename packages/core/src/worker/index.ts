export { createCodecWorker } from "./codec-worker";
export type { WorkerLike } from "./compat";

export {
  CodecWorkerClient,
  createWorkerHandle,
  normalizeWorkerInput,
  type CodecWorkerClientConfig,
  type WorkerHandle,
} from "./codec-worker-client";

export type { CodecWorkerHandlers, CodecWorkerMethods } from "./protocol";

export {
  type ThreadValidationResult,
  isMultiThreadSupported,
  validateThreadCount,
} from "./threading";

export { WorkerPool } from "./pool";
