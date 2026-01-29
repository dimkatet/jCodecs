import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    encode: 'src/encode.ts',
    decode: 'src/decode.ts',
    options: 'src/options.ts',
    'worker-api': 'src/worker-api.ts',
    worker: 'src/worker.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  noExternal: ['@dimkatet/jcodecs-core'],
});
