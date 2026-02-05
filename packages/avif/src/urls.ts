/**
 * WASM module URLs - single source of truth
 *
 * URLs are resolved at import time using import.meta.url.
 * This ensures correct paths in bundled consumer projects.
 */

// Decoder URLs
export const mtDecoderUrl = new URL("./avif_dec_mt.js", import.meta.url).href;
export const stDecoderUrl = new URL("./avif_dec.js", import.meta.url).href;

// Encoder URLs
export const mtEncoderUrl = new URL("./avif_enc_mt.js", import.meta.url).href;
export const stEncoderUrl = new URL("./avif_enc.js", import.meta.url).href;

// Worker URL
export const workerUrl = new URL("./worker.js", import.meta.url);
