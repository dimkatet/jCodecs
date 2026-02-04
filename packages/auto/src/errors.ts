import type { ImageFormat } from './format-detection';

/**
 * Thrown when attempting to use a codec that is not installed
 */
export class CodecNotInstalledError extends Error {
  constructor(public readonly format: ImageFormat) {
    super(
      `Codec for format "${format}" is not installed. ` +
        `Install @dimkatet/jcodecs-${format} to enable support.`,
    );
    this.name = 'CodecNotInstalledError';
  }
}

/**
 * Thrown when a codec fails to load
 */
export class CodecLoadError extends Error {
  constructor(
    public readonly format: ImageFormat,
    public readonly cause: Error,
  ) {
    super(`Failed to load codec for format "${format}": ${cause.message}`);
    this.name = 'CodecLoadError';
  }
}

/**
 * Thrown when image format cannot be detected or is not supported
 */
export class UnsupportedFormatError extends Error {
  constructor(data: Uint8Array | null) {
    const hint = data
      ? ` (magic bytes: ${Array.from(data.slice(0, 12))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ')})`
      : '';
    super(`Unsupported or unknown image format${hint}`);
    this.name = 'UnsupportedFormatError';
  }
}
