/**
 * Profiling utilities for AVIF encoder/decoder
 */

let profilingEnabled = false;

export function enableProfiling(enabled = true): void {
  profilingEnabled = enabled;
}

export function isProfilingEnabled(): boolean {
  return profilingEnabled;
}

// ============================================================================
// Decode profiling
// ============================================================================

export interface DecodeProfile {
  inputSize: number;
  outputSize: number;
  dimensions: string;
  bitDepth: number;
  copyToWasm: number;
  wasmDecode: number;
  copyFromWasm: number;
  convertMetadata: number;
  total: number;
}

export function logDecodeProfile(profile: DecodeProfile): void {
  if (!profilingEnabled) return;

  console.log(
    `[AVIF Decode Profile] ${profile.dimensions} @ ${profile.bitDepth}bit\n` +
      `  Input:          ${(profile.inputSize / 1024).toFixed(1)} KB\n` +
      `  Output:         ${(profile.outputSize / 1024 / 1024).toFixed(
        2,
      )} MB\n` +
      `  ─────────────────────────────\n` +
      `  Copy to WASM:   ${profile.copyToWasm.toFixed(2)} ms\n` +
      `  WASM decode:    ${profile.wasmDecode.toFixed(2)} ms\n` +
      `  Copy from WASM: ${profile.copyFromWasm.toFixed(2)} ms\n` +
      `  Convert meta:   ${profile.convertMetadata.toFixed(2)} ms\n` +
      `  ─────────────────────────────\n` +
      `  TOTAL:          ${profile.total.toFixed(2)} ms`,
  );
}

// ============================================================================
// Encode profiling
// ============================================================================

export interface EncodeProfile {
  inputSize: number;
  outputSize: number;
  dimensions: string;
  inputBitDepth: number;
  outputBitDepth: number;
  copyToWasm: number;
  wasmEncode: number;
  copyFromWasm: number;
  total: number;
}

export function logEncodeProfile(profile: EncodeProfile): void {
  if (!profilingEnabled) return;

  console.log(
    `[AVIF Encode Profile] ${profile.dimensions} @ ${profile.inputBitDepth}bit → ${profile.outputBitDepth}bit\n` +
      `  Input:          ${(profile.inputSize / 1024 / 1024).toFixed(2)} MB\n` +
      `  Output:         ${(profile.outputSize / 1024).toFixed(1)} KB\n` +
      `  ─────────────────────────────\n` +
      `  Copy to WASM:   ${profile.copyToWasm.toFixed(2)} ms\n` +
      `  WASM encode:    ${profile.wasmEncode.toFixed(2)} ms\n` +
      `  Copy from WASM: ${profile.copyFromWasm.toFixed(2)} ms\n` +
      `  ─────────────────────────────\n` +
      `  TOTAL:          ${profile.total.toFixed(2)} ms`,
  );
}
