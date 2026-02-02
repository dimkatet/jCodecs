/**
 * Threading utilities for WASM modules
 */

/**
 * Check if SharedArrayBuffer is available (required for multi-threaded WASM)
 * Works around potential SecurityError in restricted contexts
 */
export function isMultiThreadSupported(): boolean {
  try {
    return typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Thread count validation result
 */
export interface ThreadValidationResult {
  /** The validated (possibly clamped) thread count */
  validatedCount: number;
  /** Whether clamping occurred */
  wasClamped: boolean;
  /** Warning message if any (for logging) */
  warning?: string;
}

/**
 * Validate and clamp maxThreads to prevent deadlock
 *
 * @param requestedThreads - User-requested thread count
 * @param maxAllowed - Maximum allowed by WASM module (PTHREAD_POOL_SIZE)
 * @param isMultiThreadedModule - Whether MT WASM is loaded
 * @param codecName - Codec name for warning messages (e.g., "jcodecs-avif")
 */
export function validateThreadCount(
  requestedThreads: number,
  maxAllowed: number,
  isMultiThreadedModule: boolean,
  codecName: string = "jcodecs",
): ThreadValidationResult {
  if (!isMultiThreadedModule) {
    if (requestedThreads > 1) {
      return {
        validatedCount: 1,
        wasClamped: true,
        warning: `[${codecName}] maxThreads > 1 ignored: SharedArrayBuffer not available`,
      };
    }
    return { validatedCount: 1, wasClamped: false };
  }

  if (requestedThreads > maxAllowed) {
    return {
      validatedCount: maxAllowed,
      wasClamped: true,
      warning: `[${codecName}] maxThreads=${requestedThreads} exceeds limit ${maxAllowed}, clamping`,
    };
  }

  return { validatedCount: requestedThreads, wasClamped: false };
}
