import { describe, it, expect } from 'vitest';

/**
 * Worker API tests
 *
 * Note: These tests require mocking CodecWorkerClient which is challenging
 * in browser environment due to vi.mock hoisting limitations.
 * The worker-api functionality is tested indirectly through integration tests.
 *
 * To run proper worker-api tests:
 * 1. Use Node.js environment instead of browser
 * 2. Or use integration tests with actual worker implementation
 */

describe('worker-api', () => {
  describe('createWorkerPool', () => {
    it.skip('creates pool with default config', () => {});
    it.skip('respects poolSize option', () => {});
    it.skip('respects preferMT option', () => {});
    it.skip('respects type option (decoder/encoder/both)', () => {});
    it.skip('respects lazyInit option', () => {});
  });

  describe('decodeInWorker', () => {
    it.skip('decodes in worker thread', () => {});
    it.skip('auto-detects format', () => {});
    it.skip('transfers buffer to worker', () => {});
  });

  describe('encodeInWorker', () => {
    it.skip('encodes in worker thread', () => {});
    it.skip('accepts ImageData', () => {});
    it.skip('accepts AutoImageData', () => {});
  });

  describe('transcodeInWorker', () => {
    it.skip('transcodes in single worker call', () => {});
    it.skip('transfers buffer to worker', () => {});
  });

  describe('pool management', () => {
    it.skip('getWorkerPoolStats returns stats', () => {});
    it.skip('isWorkerPoolInitialized returns boolean', () => {});
    it.skip('terminateWorkerPool cleans up workers', () => {});
  });
});
