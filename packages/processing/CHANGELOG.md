# @dimkatet/jcodecs-processing

## 0.2.0

### Minor Changes

- ee989b9: Add Node.js support for worker pool and codec infrastructure

  Worker pool (`createWorkerPool`) now works in Node.js via `node:worker_threads`.
  No API changes required — all codec packages inherit this automatically through `@dimkatet/jcodecs-core`.

### Patch Changes

- Updated dependencies [ee989b9]
  - @dimkatet/jcodecs-core@0.8.0

## 0.1.1

### Patch Changes

- Updated dependencies
  - @dimkatet/jcodecs-core@0.7.1
