import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index:        'src/index.ts',
    resize:       'src/resize.ts',
    crop:         'src/crop.ts',
    rotate:       'src/rotate.ts',
    options:      'src/options.ts',
    urls:         'src/urls.ts',
    'worker-api': 'src/worker-api.ts',
    worker:       'src/worker.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  noExternal: ['@dimkatet/jcodecs-core'],
});
