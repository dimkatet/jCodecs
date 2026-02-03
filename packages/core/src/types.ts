// ============================================================================
// Data Type Definitions
// ============================================================================

/**
 * Supported pixel data types
 * - uint8: 8-bit unsigned integer
 * - uint16: 10/12/16-bit unsigned integer (stored in Uint16Array)
 * - float16: 16-bit IEEE 754 half-precision float
 * - float32: 32-bit IEEE 754 single-precision float
 */
export type DataType = 'uint8' | 'uint16' | 'float16' | 'float32';

/**
 * Map DataType to corresponding TypedArray type
 */
type TypedArrayForDataType<T extends DataType> =
  T extends 'uint8' ? Uint8Array :
  T extends 'uint16' ? Uint16Array :
  T extends 'float16' ? Float16Array :
  T extends 'float32' ? Float32Array :
  never;

// ============================================================================
// Extended ImageData (generic - metadata defined by codec)
// ============================================================================

/**
 * Extended image data with codec-specific metadata
 * @template TDataType - Pixel data type (uint8, uint16, float16, float32)
 * @template TMeta - Codec-specific metadata type (defined by each codec package)
 */
export interface ExtendedImageData<
  TDataType extends DataType = DataType,
  TMeta = unknown
> {
  /** Raw pixel data - typed array matching dataType */
  data: TypedArrayForDataType<TDataType>;
  /** Data type - defines storage format */
  dataType: TDataType;
  /** Bit depth - real data precision (8, 10, 12, 16, 32) */
  bitDepth: number;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
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
    imageData: ImageData | ExtendedImageData<DataType, TMeta>,
    options?: TEncodeOptions
  ): Promise<Uint8Array>;

  decode(
    data: Uint8Array | ArrayBuffer,
    options?: TDecodeOptions
  ): Promise<ExtendedImageData<DataType, TMeta>>;

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
