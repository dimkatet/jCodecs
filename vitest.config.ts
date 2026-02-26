// vitest.config.ts
import { defineConfig, defineProject, mergeConfig } from "vitest/config";
import { resolve } from "path";
import { baseConfig } from "./vitest.shared";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "core",
          root: "./packages/core",
        },
      }),

      defineProject({
        test: {
          name: "avif-node",
          root: "./packages/avif",
          environment: "node",
          include: ["**/tests/*.test.ts", "**/tests/node/**/*.test.ts"],
          setupFiles: [resolve(__dirname, "./vitest.node-setup.ts")],
          env: {
            VITEST_FIXTURES_DIR: resolve(__dirname, "./packages/avif/tests/fixtures"),
          },
          testTimeout: 60000,
        },
        resolve: {
          alias: {
            "@dimkatet/jcodecs-avif": resolve(
              __dirname,
              "./packages/avif/dist/index.js",
            ),
          },
        },
      }),

      defineProject({
        test: {
          name: "jxl-node",
          root: "./packages/jxl",
          environment: "node",
          include: ["**/tests/*.test.ts", "**/tests/node/**/*.test.ts"],
          setupFiles: [resolve(__dirname, "./vitest.node-setup.ts")],
          env: {
            VITEST_FIXTURES_DIR: resolve(__dirname, "./packages/jxl/tests/fixtures"),
          },
          testTimeout: 60000,
        },
        resolve: {
          alias: {
            "@dimkatet/jcodecs-jxl": resolve(
              __dirname,
              "./packages/jxl/dist/index.js",
            ),
          },
        },
      }),

      defineProject({
        test: {
          name: "exr-node",
          root: "./packages/exr",
          environment: "node",
          include: ["**/tests/*.test.ts", "**/tests/node/**/*.test.ts"],
          setupFiles: [resolve(__dirname, "./vitest.node-setup.ts")],
          env: {
            VITEST_FIXTURES_DIR: resolve(__dirname, "./packages/exr/tests/fixtures"),
          },
          testTimeout: 60000,
        },
        resolve: {
          alias: {
            "@dimkatet/jcodecs-exr": resolve(
              __dirname,
              "./packages/exr/dist/index.js",
            ),
          },
        },
      }),

      defineProject({
        test: {
          name: "auto-node",
          root: "./packages/auto",
          environment: "node",
          include: ["**/tests/*.test.ts", "**/tests/node/**/*.test.ts"],
          setupFiles: [resolve(__dirname, "./vitest.node-setup.ts")],
          env: {
            VITEST_FIXTURES_DIR: resolve(__dirname, "./packages/auto/tests/fixtures"),
          },
          testTimeout: 60000,
        },
        resolve: {
          alias: {
            "@dimkatet/jcodecs-auto": resolve(
              __dirname,
              "./packages/auto/dist/index.js",
            ),
            "@dimkatet/jcodecs-avif": resolve(
              __dirname,
              "./packages/avif/dist/index.js",
            ),
            "@dimkatet/jcodecs-jxl": resolve(
              __dirname,
              "./packages/jxl/dist/index.js",
            ),
          },
        },
      }),

      defineProject({
        test: {
          name: "processing-node",
          root: "./packages/processing",
          environment: "node",
          include: ["**/tests/*.test.ts", "**/tests/node/**/*.test.ts"],
          setupFiles: [resolve(__dirname, "./vitest.node-setup.ts")],
          testTimeout: 60000,
        },
        resolve: {
          alias: {
            "@dimkatet/jcodecs-processing": resolve(
              __dirname,
              "./packages/processing/dist/index.js",
            ),
          },
        },
      }),

      mergeConfig(
        baseConfig,
        defineProject({
          publicDir: resolve(__dirname, "packages/jxl/tests/fixtures"),
          test: {
            name: "jxl",
            root: "./packages/jxl",
            browser: {
              instances: [{ browser: "chromium", name: "jxl-chromium" }],
            },
          },
          resolve: {
            alias: {
              "@dimkatet/jcodecs-jxl": resolve(
                __dirname,
                "./packages/jxl/dist/index.js",
              ),
            },
          },
        }),
      ),

      mergeConfig(
        baseConfig,
        defineProject({
          publicDir: resolve(__dirname, "packages/avif/tests/fixtures"),
          test: {
            name: "avif",
            root: "./packages/avif",
            browser: {
              instances: [{ browser: "chromium", name: "avif-chromium" }],
            },
          },
          resolve: {
            alias: {
              "@dimkatet/jcodecs-avif": resolve(
                __dirname,
                "./packages/avif/dist/index.js",
              ),
            },
          },
        }),
      ),

      mergeConfig(
        baseConfig,
        defineProject({
          publicDir: resolve(__dirname, "packages/auto/tests/fixtures"),
          test: {
            name: "auto",
            root: "./packages/auto",
            browser: {
              instances: [{ browser: "chromium", name: "auto-chromium" }],
            },
          },
          resolve: {
            alias: {
              "@dimkatet/jcodecs-auto": resolve(
                __dirname,
                "./packages/auto/dist/index.js",
              ),
              "@dimkatet/jcodecs-avif": resolve(
                __dirname,
                "./packages/avif/dist/index.js",
              ),
              "@dimkatet/jcodecs-jxl": resolve(
                __dirname,
                "./packages/jxl/dist/index.js",
              ),
            },
          },
        }),
      ),

      mergeConfig(
        baseConfig,
        defineProject({
          publicDir: resolve(__dirname, "packages/exr/tests/fixtures"),
          test: {
            name: "exr",
            root: "./packages/exr",
            browser: {
              instances: [{ browser: "chromium", name: "exr-chromium" }],
            },
          },
          resolve: {
            alias: {
              "@dimkatet/jcodecs-exr": resolve(
                __dirname,
                "./packages/exr/dist/index.js",
              ),
            },
          },
        }),
      ),

      mergeConfig(
        baseConfig,
        defineProject({
          test: {
            name: "processing",
            root: "./packages/processing",
            browser: {
              enabled: true,
              instances: [{ browser: "chromium", name: "processing-chromium" }],
            },
          },
          resolve: {
            alias: {
              "@dimkatet/jcodecs-processing": resolve(
                __dirname,
                "./packages/processing/dist/index.js",
              ),
            },
          },
        }),
      ),
    ],
  },
});
