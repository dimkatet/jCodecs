import type {
  ImageDescriptor,
  ChannelModel,
  ChromaSubsampling,
  ColorPrimaries,
  TransferFunction,
} from '@dimkatet/jcodecs-core';

// ============================================================================
// AVIF data types
// ============================================================================

/**
 * AVIF supported pixel data types.
 * Note: AVIF (libavif) only supports integer formats, no float.
 */
export type AVIFDataType = 'uint8' | 'uint16';

/**
 * Supported types for runtime validation
 */
export const SUPPORTED_DATA_TYPES: readonly AVIFDataType[] = [
  'uint8',
  'uint16',
] as const;

// ============================================================================
// Decoder output (descriptor-based API)
// ============================================================================

/** AVIF decoded image data with ImageDescriptor */
export interface AVIFImageData {
  data: Uint8Array | Uint16Array;
  descriptor: ImageDescriptor;
}

// ============================================================================
// Encoder input (descriptor-based API)
// ============================================================================

/**
 * Descriptor for AVIF encoding input.
 * Structurally mirrors ImageDescriptor but narrowed to fields
 * relevant for the AVIF encoder.
 */
export interface AVIFEncodeDescriptor {
  /** Image dimensions */
  geometry: {
    width: number;
    height: number;
  };
  /** Channel configuration */
  channels: {
    model: ChannelModel;
    count: number;
  };
  /** Pixel data format */
  numeric: {
    dataType: AVIFDataType;
    bitDepth: 8 | 10 | 12;
  };
  /** Chroma subsampling (optional, default: 4:2:0) */
  sampling?: {
    chromaSubsampling?: ChromaSubsampling;
  };
  /** Color primaries for CICP tagging (optional, default: bt709/sRGB) */
  color?: {
    primaries?: ColorPrimaries;
  };
  /** Transfer function for CICP tagging (optional, default: srgb) */
  transfer?: {
    function?: TransferFunction;
  };
}
