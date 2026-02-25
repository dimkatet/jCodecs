import type { MainModule } from './wasm/img_process';
import { importModule } from '@dimkatet/jcodecs-core';
import { processUrl } from './urls';

type WasmModule = typeof import('./wasm/img_process');

let module: MainModule | null = null;
let initPromise: Promise<void> | null = null;

export interface InitConfig {
  /** Custom URL for img_process.js (WASM is embedded). */
  jsUrl?: string;
}

/**
 * Initialize the img_process WASM module.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function init(config: InitConfig = {}): Promise<void> {
  if (module) return;

  if (initPromise) {
    await initPromise;
    return;
  }

  const url = config.jsUrl ?? processUrl;

  initPromise = (async () => {
    const mod = await importModule<WasmModule>(url);
    module = await mod.default();
  })();

  await initPromise;
}

/**
 * Returns the initialized WASM module.
 * Throws if init() has not been called yet.
 */
export function getModule(): MainModule {
  if (!module) {
    throw new Error(
      'jcodecs-processing: WASM module is not initialized. Call init() first.',
    );
  }
  return module;
}

export function isInitialized(): boolean {
  return module !== null;
}
