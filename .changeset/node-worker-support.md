---
"@dimkatet/jcodecs-core": minor
"@dimkatet/jcodecs-avif": minor
"@dimkatet/jcodecs-jxl": minor
"@dimkatet/jcodecs-exr": minor
"@dimkatet/jcodecs-auto": minor
"@dimkatet/jcodecs-processing": minor
---

Add Node.js support for worker pool and codec infrastructure

Worker pool (`createWorkerPool`) now works in Node.js via `node:worker_threads`.
No API changes required — all codec packages inherit this automatically through `@dimkatet/jcodecs-core`.
