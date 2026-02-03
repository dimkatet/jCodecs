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
    ],
  },
});
