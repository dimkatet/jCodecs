import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    types: 'src/types.ts',
    memory: 'src/memory.ts',
    'worker-pool': 'src/worker-pool.ts',
    'codec-worker': 'src/codec-worker.ts',
    'codec-worker-client': 'src/codec-worker-client.ts',
    threading: 'src/threading.ts',
    'wasm-utils': 'src/wasm-utils.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
