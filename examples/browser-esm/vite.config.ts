import { defineConfig } from "vite";

export default defineConfig({
  server: { 
    fs: { allow: ["..", '../../packages'] },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },

  optimizeDeps: {
    exclude: ["@dimkatet/jcodecs-avif"],
  },

});
