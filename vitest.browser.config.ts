import { defineConfig } from "vitest/config";
import { playwright } from '@vitest/browser-playwright'
import { resolve } from "path";

export default defineConfig({
  // Serve fixtures as static files
  publicDir: resolve(__dirname, "packages/avif/tests/fixtures"),

  resolve: {
    alias: {
      // Subpath exports must come before main export
      "@dimkatet/jcodecs-core/codec-worker": resolve(__dirname, "packages/core/src/codec-worker.ts"),
      "@dimkatet/jcodecs-core/codec-worker-client": resolve(__dirname, "packages/core/src/codec-worker-client.ts"),
      "@dimkatet/jcodecs-core": resolve(__dirname, "packages/core/src/index.ts"),
      "@dimkatet/jcodecs-avif": resolve(__dirname, "packages/avif/src/index.ts"),
    },
  },

  test: {
    // Browser tests only
    environment: "node",
    include: ["packages/*/tests/browser/**/*.test.ts"],
    watch: false,

    // Browser mode
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },

    // Test settings
    testTimeout: 60000,
    hookTimeout: 60000,
  },
  server: {
    // fs: {
    //   allow: [".."],
    // },

    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  },
});
