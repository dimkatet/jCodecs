import type {
  ImageDescriptor,
  ChannelModel,
  ColorPrimaries,
  TransferFunction,
} from '@dimkatet/jcodecs-core';

// ============================================================================
// JXL data types
// ============================================================================

/**
 * JXL supported pixel data types.
 * JXL supports both integer and floating-point sample formats.
 */
export type JXLDataType = 'uint8' | 'uint16' | 'float16' | 'float32';

/**
 * Supported types for runtime validation
 */
export const SUPPORTED_DATA_TYPES: readonly JXLDataType[] = [
  'uint8',
  'uint16',
  'float16',
  'float32',
] as const;

// ============================================================================
// Decoder output (descriptor-based API)
// ============================================================================

/** JXL decoded image data with ImageDescriptor */
export interface JXLImageData {
  data: Uint8Array | Uint16Array | Float16Array | Float32Array;
  descriptor: ImageDescriptor;
}

// ============================================================================
// Encoder input (descriptor-based API)
// ============================================================================

/**
 * Descriptor for JXL encoding input.
 * Structurally mirrors ImageDescriptor but narrowed to fields
 * relevant for the JXL encoder.
 */
export interface JXLEncodeDescriptor {
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
  /** Pixel data format (describes INPUT data) */
  numeric: {
    dataType: JXLDataType;
    /** Bit depth: 8 | 10 | 12 | 16 for integer, 16 for float16, 32 for float32 */
    bitDepth: 8 | 10 | 12 | 16 | 32;
  };
  /** Color primaries for tagging (optional, default: bt709/sRGB) */
  color?: {
    primaries?: ColorPrimaries;
  };
  /** Transfer function for tagging (optional, default: srgb) */
  transfer?: {
    function?: TransferFunction;
  };
}
