import { ViteUserConfig } from "vitest/config";
import { playwright } from '@vitest/browser-playwright'
import { resolve } from "path";

export const baseConfig = {

  resolve: {
    alias: {
      "@dimkatet/jcodecs-core/codec-worker": resolve(__dirname, "packages/core/src/codec-worker.ts"),
      "@dimkatet/jcodecs-core/codec-worker-client": resolve(__dirname, "packages/core/src/codec-worker-client.ts"),
    },
  },

  test: {
    // Browser tests only
    environment: "node",
    include: ["**/*.test.ts"],
    watch: false,

    // Browser mode
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
    },

    // Test settings
    testTimeout: 60000,
    hookTimeout: 60000,
  },
  server: {

    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  },
} satisfies ViteUserConfig;
