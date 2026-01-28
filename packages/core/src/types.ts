// ============================================================================
// Extended ImageData (generic - metadata defined by codec)
// ============================================================================

/**
 * Extended image data with codec-specific metadata
 * @template TMeta - Codec-specific metadata type (defined by each codec package)
 */
export interface ExtendedImageData<TMeta = unknown> {
  /** Raw pixel data - Uint8Array for 8-bit, Uint16Array for 10/12/16-bit */
  data: Uint8Array | Uint16Array;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Bit depth per channel */
  bitDepth: 8 | 10 | 12 | 16;
  /** Number of channels in the image */
  channels: number;
  /** Codec-specific metadata */
  metadata: TMeta;
}

// ============================================================================
// Image info (without pixel data)
// ============================================================================

/**
 * Image info without pixel data
 * @template TMeta - Codec-specific metadata type
 */
export interface ImageInfo<TMeta = unknown> {
  width: number;
  height: number;
  bitDepth: number;
  channels: number;
  metadata: TMeta;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Progress callback for long operations
 */
export type ProgressCallback = (progress: number, stage: string) => void;

/**
 * Base codec module interface
 * @template TEncodeOptions - Encoder options type
 * @template TDecodeOptions - Decoder options type
 * @template TMeta - Codec-specific metadata type
 */
export interface CodecModule<
  TEncodeOptions,
  TDecodeOptions = unknown,
  TMeta = unknown,
> {
  encode(
    imageData: ImageData | ExtendedImageData<TMeta>,
    options?: TEncodeOptions
  ): Promise<Uint8Array>;

  decode(
    data: Uint8Array | ArrayBuffer,
    options?: TDecodeOptions
  ): Promise<ExtendedImageData<TMeta>>;

  init(wasmUrl?: string): Promise<void>;

  isInitialized(): boolean;
}

/**
 * Emscripten module type augmentation
 */
export interface EmscriptenModuleConfig {
  locateFile?: (path: string, prefix: string) => string;
  onRuntimeInitialized?: () => void;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
}
