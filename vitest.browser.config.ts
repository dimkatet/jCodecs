import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  // Serve fixtures as static files
  publicDir: resolve(__dirname, 'packages/avif/tests/fixtures'),

  resolve: {
    alias: {
      '@jcodecs/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@jcodecs/avif': resolve(__dirname, 'packages/avif/src/index.ts'),
    },
  },

  test: {
    // Browser tests only
    include: ['tests/browser/**/*.test.ts'],

    // Browser mode
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: true,
    },

    // Test settings
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
