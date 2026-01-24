import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node.js tests
    include: ['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
    exclude: ['tests/browser/**'],

    // Test settings
    testTimeout: 30000,
    hookTimeout: 30000,

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/worker.ts'],
    },
  },
});
