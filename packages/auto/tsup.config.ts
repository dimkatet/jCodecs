import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    decode: 'src/decode.ts',
    encode: 'src/encode.ts',
    'format-detection': 'src/format-detection.ts',
    'worker-api': 'src/worker-api.ts',
    types: 'src/types.ts',
    options: 'src/options.ts',
    errors: 'src/errors.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Bundle core, keep peer deps external
  noExternal: ['@dimkatet/jcodecs-core'],
  external: [
    '@dimkatet/jcodecs-avif',
    '@dimkatet/jcodecs-jxl',
  ],
});
