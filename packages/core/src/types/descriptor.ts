// ============================================================================
// Canonical Image Descriptor (CID)
// ============================================================================
//
// CID-inspired descriptor for jCodecs. Provides a complete semantic model
// for image data interpretation across heterogeneous formats.
//
// Design principles:
// - Orthogonality: each section describes independent aspect
// - Explicitness: optional (?) = undefined = unknown/not applicable
// - null: only for rare "explicitly empty" cases
// - No 'unknown' in enums: use optional fields instead
// - Extensibility: support arbitrary channels (EXR), auxiliary images (gain maps)
// - Type safety: leverage TypeScript for correctness
//

// ============================================================================
// 1. Geometry
// ============================================================================

/**
 * EXIF orientation (1-8)
 *
 * 1 = normal (0°)
 * 2 = flip horizontal
 * 3 = rotate 180°
 * 4 = flip vertical
 * 5 = transpose (flip horizontal + rotate 90° CW)
 * 6 = rotate 90° CW
 * 7 = transverse (flip horizontal + rotate 90° CCW)
 * 8 = rotate 90° CCW
 */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface GeometryInfo {
  /** Image width in pixels */
  width: number;

  /** Image height in pixels */
  height: number;

  /** EXIF orientation (default: 1 if undefined) */
  orientation?: ExifOrientation;

  /** Pixel aspect ratio (width/height). Default: 1.0 if undefined */
  pixelAspectRatio?: number;
}

// ============================================================================
// 2. Sampling
// ============================================================================

/**
 * Memory layout of pixel data
 */
export type SampleLayout =
  | 'interleaved'  // RGBARGBARGBA... (most common)
  | 'planar'       // RRR...GGG...BBB...AAA... (YUV, some raw)
  | 'semiPlanar'; // YYY...UVUVUV... (NV12-style)

/**
 * Chroma subsampling ratio (J:a:b notation)
 */
export type ChromaSubsampling =
  | '444'  // No subsampling (full resolution chroma)
  | '422'  // Horizontal 2x subsampling
  | '420'  // Horizontal + vertical 2x subsampling
  | '400'; // Grayscale (no chroma)

/**
 * Chroma sample position relative to luma
 */
export type ChromaSamplePosition =
  | 'centered'  // Center of 2x2 luma block (JPEG, MPEG-1)
  | 'cosited'   // Top-left luma position (MPEG-2, H.264)
  | 'vertical'  // Vertically centered, horizontally cosited (MPEG-2 4:2:0)
  | 'topleft';  // Alias for cosited

export interface SamplingInfo {
  /** Memory layout of channels (default: 'interleaved' if undefined) */
  layout?: SampleLayout;

  /** Chroma subsampling (undefined = 4:4:4 or not applicable) */
  chromaSubsampling?: ChromaSubsampling;

  /** Chroma sample position (undefined = centered) */
  chromaSamplePosition?: ChromaSamplePosition;
}

// ============================================================================
// 3. Channels
// ============================================================================

/**
 * Channel model - semantic interpretation of channels
 */
export type ChannelModel =
  | 'rgb'      // 3-channel RGB
  | 'rgba'     // 4-channel RGB + alpha
  | 'gray'     // 1-channel grayscale
  | 'graya'    // 2-channel grayscale + alpha
  | 'ycbcr'    // 3-channel YCbCr (YUV)
  | 'ycbcra'   // 4-channel YCbCr + alpha
  | 'cmyk'     // 4-channel CMYK
  | 'cmyka'    // 5-channel CMYK + alpha
  | 'xyz'      // 3-channel CIE XYZ
  | 'lab'      // 3-channel CIE L*a*b*
  | 'custom';  // Arbitrary channels (EXR, scientific formats)

/**
 * Channel role - semantic meaning of a channel
 */
export type ChannelRole =
  // RGB
  | 'red' | 'green' | 'blue'
  // YCbCr
  | 'luma' | 'chromaBlue' | 'chromaRed'
  // CMYK
  | 'cyan' | 'magenta' | 'yellow' | 'black'
  // Grayscale
  | 'gray'
  // Transparency
  | 'alpha'
  // Depth
  | 'depth'
  // Normal maps
  | 'normalX' | 'normalY' | 'normalZ'
  // PBR
  | 'specular' | 'roughness' | 'metallic' | 'occlusion'
  // XYZ
  | 'x' | 'y' | 'z'
  // LAB
  | 'lightness' | 'a' | 'b'
  // Custom (EXR arbitrary channels)
  | 'custom';

/**
 * Single channel descriptor
 * Used for custom channel models (EXR) or detailed channel info
 */
export interface ChannelDescriptor {
  /**
   * Channel name (e.g., "R", "G", "B", "A", "diffuse.R", "Z", "beauty")
   * For standard models: "R", "G", "B", "A"
   * For EXR: arbitrary names like "diffuse.R", "specular.G", "Z"
   */
  name: string;

  /** Semantic role of this channel */
  role: ChannelRole;

  /** Channel index in data array (0-based) */
  index: number;
}

export interface ChannelsInfo {
  /** High-level channel model */
  model: ChannelModel;

  /** Number of channels */
  count: number;

  /**
   * Detailed channel descriptors
   * Required for model='custom'
   * Optional for standard models (can be inferred)
   */
  channels?: ChannelDescriptor[];
}

// ============================================================================
// 4. Numeric Representation
// ============================================================================

/**
 * Sample data type category
 */
export type SampleType =
  | 'uint'   // Unsigned integer
  | 'sint'   // Signed integer
  | 'float'; // Floating point

/**
 * Supported pixel data types
 */
export type DataType =
  | 'uint8'
  | 'uint16'
  | 'float16'
  | 'float32';

/**
 * Byte order for multi-byte types
 */
export type Endianness =
  | 'little'  // Little-endian (x86, ARM, WASM)
  | 'big'     // Big-endian (network order)
  | 'native'; // Platform native (typically little-endian)

/**
 * Quantization range mapping
 */
export type QuantizationRange =
  | 'full'     // 0 to 2^n-1 (e.g., 0-255 for 8-bit)
  | 'limited'  // Video range: 16-235 for Y, 16-240 for CbCr
  | { min: number; max: number }; // Custom range

export interface NumericInfo {
  /** Sample type category */
  sampleType: SampleType;

  /** Specific data type */
  dataType: DataType;

  /** Bit depth (8, 10, 12, 16, 32) */
  bitDepth: number;

  /** Byte order (default: 'native' if undefined) */
  endianness?: Endianness;

  /** Value range mapping (default: 'full' if undefined) */
  quantization?: QuantizationRange;
}

// ============================================================================
// 5. Color Geometry
// ============================================================================

/**
 * Standard color primaries (gamut)
 * Based on CICP (Coding-Independent Code Points) and common color spaces
 */
export type ColorPrimaries =
  | 'bt709'       // sRGB, Rec.709 (HDTV)
  | 'bt2020'      // Rec.2020 (UHDTV, wide gamut)
  | 'displayP3'  // Display P3 (Apple displays)
  | 'dciP3'      // DCI P3 (digital cinema)
  | 'bt470m'      // NTSC (1953)
  | 'bt470bg'     // PAL/SECAM
  | 'bt601'       // SDTV (standard definition)
  | 'smpte240'    // SMPTE 240M
  | 'genericFilm'
  | 'xyz'         // CIE XYZ
  | 'ebu3213'     // EBU Tech 3213
  | 'aces'        // ACES AP0 (Academy Color Encoding System)
  | 'acescg';     // ACES AP1 (ACEScg working space)

/**
 * Standard white points
 */
export type WhitePoint =
  | 'd65'    // 6500K (sRGB, Rec.709, Rec.2020, most common)
  | 'd50'    // 5000K (printing, ProPhoto RGB)
  | 'dci'    // DCI white (~6300K, slightly green-shifted)
  | 'e';     // Equal energy illuminant

/**
 * Matrix coefficient families (RGB/YUV conversion)
 */
export type MatrixCoefficients =
  | 'identity'    // RGB (no conversion)
  | 'bt709'       // Rec.709
  | 'bt2020Ncl'  // Rec.2020 non-constant luminance
  | 'bt2020Cl'   // Rec.2020 constant luminance
  | 'bt601'       // SDTV
  | 'smpte240'    // SMPTE 240M
  | 'ycgco'       // YCgCo (lossless RGB↔YUV)
  | 'ictcp'       // ICtCp (PQ-based perceptual)
  | 'fcc';        // FCC (legacy)

export interface ColorInfo {
  /**
   * Color primaries (gamut)
   * undefined = unknown or use customPrimaries
   */
  primaries?: ColorPrimaries;

  /**
   * White point reference
   * undefined = unknown or use customWhitePoint
   */
  whitePoint?: WhitePoint;

  /**
   * Matrix coefficients (RGB/YUV conversion)
   * undefined = unknown, typically 'identity' for RGB
   */
  matrix?: MatrixCoefficients;

  /**
   * Custom primaries (if primaries is undefined and custom primaries known)
   * CIE xy chromaticity coordinates
   */
  customPrimaries?: {
    red: [x: number, y: number];
    green: [x: number, y: number];
    blue: [x: number, y: number];
  };

  /**
   * Custom white point (if whitePoint is undefined and custom known)
   * CIE xy chromaticity coordinates
   */
  customWhitePoint?: [x: number, y: number];
}

// ============================================================================
// 6. Transfer Function
// ============================================================================

/**
 * Transfer function (EOTF/OETF - Electro-Optical/Opto-Electronic Transfer Function)
 * Defines non-linear encoding between light and signal
 */
export type TransferFunction =
  | 'linear'      // Linear light (no gamma)
  | 'srgb'        // sRGB (gamma ~2.2 with linear segment below 0.04045)
  | 'bt709'       // Rec.709 (similar to sRGB but different constants)
  | 'pq'          // SMPTE ST 2084 (Perceptual Quantizer, HDR10)
  | 'hlg'         // Hybrid Log-Gamma (HDR broadcast, BBC/NHK)
  | 'gamma'       // Simple power law (see gammaValue)
  | 'bt470m'      // Gamma 2.2
  | 'bt470bg'     // Gamma 2.8
  | 'bt601'       // Rec.601 (gamma ~2.2)
  | 'smpte240'    // SMPTE 240M
  | 'bt202010Bit' // Rec.2020 10-bit
  | 'bt202012Bit' // Rec.2020 12-bit
  | 'log100'      // Log 100:1 range
  | 'log100Sqrt10' // Log 100*sqrt(10):1 (~316:1)
  | 'iec61966'    // IEC 61966-2-4
  | 'bt1361'      // Rec.1361 extended gamut
  | 'smpte428'    // SMPTE 428 (DCI, gamma 2.6)
  | 'dci';        // Alias for smpte428

export interface TransferInfo {
  /** Transfer function (undefined = unknown, typically 'srgb' for SDR) */
  function?: TransferFunction;

  /**
   * Gamma value (only if function='gamma')
   * Typical values: 2.2 (sRGB-like), 2.4 (ProPhoto), 2.6 (DCI)
   */
  gammaValue?: number;

  /**
   * Custom transfer curve (if function is undefined and custom curve known)
   * TODO: define parametric/LUT structure
   */
  customCurve?: {
    type: 'parametric' | 'lut';
    data: unknown; // To be defined based on needs
  };
}

// ============================================================================
// 7. Luminance Model
// ============================================================================

/**
 * Luminance reference model
 */
export type LuminanceReference =
  | 'sdr'  // Standard Dynamic Range (relative luminance, 0.0-1.0)
  | 'hdr'; // High Dynamic Range (absolute luminance in nits)

export interface LuminanceInfo {
  /**
   * SDR (relative) or HDR (absolute) luminance
   * undefined = unknown, typically 'sdr' for most content
   */
  reference?: LuminanceReference;

  /**
   * Diffuse white level in nits (HDR) or relative (SDR: 1.0 = 100%)
   * Typical HDR values: 203 nits (SMPTE), 100 nits (HLG), 80 nits (sRGB)
   * undefined = unknown or use standard default
   */
  diffuseWhite?: number;

  /**
   * Peak brightness in nits (maximum luminance)
   * Typical HDR values: 1000-10000 nits
   * undefined = unknown
   */
  peakBrightness?: number;

  /**
   * Minimum brightness in nits (black level)
   * Typical HDR values: 0.001-0.1 nits
   * undefined = unknown or 0
   */
  minBrightness?: number;
}

// ============================================================================
// 8. Alpha and Compositing
// ============================================================================

/**
 * Alpha channel mode
 */
export type AlphaMode =
  | 'none'           // No alpha channel
  | 'straight'       // Straight/unassociated alpha (color and alpha independent)
  | 'premultiplied'; // Premultiplied/associated alpha (color *= alpha)

/**
 * Color space for alpha compositing
 */
export type AlphaColorSpace =
  | 'linear'   // Compositing in linear light space (physically correct)
  | 'encoded'; // Compositing in transfer-encoded space (gamma space)

export interface AlphaInfo {
  /** Alpha mode (default: 'none' if undefined) */
  mode?: AlphaMode;

  /**
   * Color space for compositing (default: 'linear' if undefined)
   * Matters for correct blending
   */
  colorSpace?: AlphaColorSpace;

  /**
   * Matte color for premultiplication (if mode='premultiplied')
   * RGB values in [0, 1] range (linear light)
   *
   * undefined = matte color not applicable (straight alpha)
   * null = premultiplied but matte color unknown (rare)
   * [r, g, b] = specific matte color (typically [0, 0, 0] for black)
   */
  matteColor?: [r: number, g: number, b: number] | null;
}

// ============================================================================
// 9. HDR Metadata
// ============================================================================

/**
 * Mastering display metadata (SMPTE ST 2086)
 * Describes the display used for content mastering
 */
export interface MasteringDisplay {
  /** Display primaries (CIE xy chromaticity) */
  primaries: {
    red: [x: number, y: number];
    green: [x: number, y: number];
    blue: [x: number, y: number];
  };

  /** White point (CIE xy chromaticity) */
  whitePoint: [x: number, y: number];

  /** Luminance range in nits */
  luminance: {
    min: number; // Minimum luminance (black level)
    max: number; // Maximum luminance (peak brightness)
  };
}

/**
 * Tone mapping hint
 * Suggested tone mapping operator for HDR→SDR conversion
 */
export type ToneMappingHint =
  | 'none'      // No tone mapping suggested
  | 'clip'      // Simple clipping
  | 'reinhard'  // Reinhard operator
  | 'filmic'    // Filmic/cinematic curve
  | 'aces'      // ACES tone mapping
  | 'custom';   // Custom tone mapping

export interface HDRMetadata {
  /**
   * Maximum Content Light Level (nits)
   * Peak brightness of any single pixel
   * 0 or undefined = not specified
   */
  maxCLL?: number;

  /**
   * Maximum Picture Average Light Level (nits)
   * Maximum average brightness across frames
   * 0 or undefined = not specified
   */
  maxPALL?: number;

  /**
   * Mastering display metadata (SMPTE ST 2086)
   * undefined = not present
   */
  masteringDisplay?: MasteringDisplay;

  /**
   * Suggested tone mapping operator
   * undefined = no suggestion
   */
  toneMappingHint?: ToneMappingHint;
}

// ============================================================================
// 10. Rendering Intent
// ============================================================================

/**
 * Rendering intent (ICC-style)
 * Describes how colors should be transformed when gamuts don't match
 */
export type RenderingIntent =
  | 'perceptual'  // Preserve overall appearance (most common)
  | 'relative'    // Relative colorimetric (scale to white point)
  | 'absolute'    // Absolute colorimetric (preserve XYZ, rare)
  | 'saturation'; // Maximize saturation (graphics/charts)

/**
 * Image domain (OpenColorIO terminology)
 * Describes the state of color values
 */
export type ImageDomain =
  | 'sceneReferred'   // Linear light, unbounded (HDR renders, EXR)
  | 'displayReferred' // Prepared for display, bounded [0,1]
  | 'outputReferred'; // Final output for specific device

export interface RenderingInfo {
  /**
   * Rendering intent
   * undefined = default to 'perceptual'
   */
  intent?: RenderingIntent;

  /**
   * Image domain
   * undefined = typically 'displayReferred' for encoded images
   */
  domain?: ImageDomain;
}

// ============================================================================
// 11. Auxiliary Images
// ============================================================================

/**
 * Auxiliary image role
 * Defines the purpose of an auxiliary image plane
 */
export type AuxiliaryRole =
  | 'gainMap'      // Gain map for HDR reconstruction (JPEG XL, AVIF+ISO 21496-1)
  | 'alpha'         // Separate alpha plane
  | 'depth'         // Depth map (Z-buffer)
  | 'disparity'     // Stereo disparity map
  | 'normal'        // Surface normal map
  | 'specular'      // Specular reflectance (PBR)
  | 'roughness'     // Surface roughness (PBR)
  | 'metallic'      // Metallic property (PBR)
  | 'occlusion'     // Ambient occlusion (PBR)
  | 'emissive'      // Emissive/glow map
  | 'thumbnail'     // Preview thumbnail
  | 'mipmap'        // Mipmap level
  | 'custom';       // Custom/application-specific

/**
 * Auxiliary image descriptor
 * Describes an auxiliary image plane related to the main image
 *
 * Note: not yet part of ImageDescriptor due to Embind recursive
 * structure limitations. Will be integrated when resolved.
 */
export interface AuxiliaryImageDescriptor {
  /** Role of this auxiliary image */
  role: AuxiliaryRole;

  /**
   * Human-readable description or relationship to primary image
   * e.g., "HDR gain map", "mip level 2", "left eye depth"
   */
  description?: string;

  /**
   * Nested descriptor for auxiliary image
   * Auxiliary images have their own complete descriptor
   */
  descriptor: ImageDescriptor;

  /**
   * Data reference (implementation-specific)
   * Could be index, identifier, or embedded data
   */
  dataReference?: number | string | Uint8Array;
}

// ============================================================================
// 12. Complete Image Descriptor
// ============================================================================

/**
 * Canonical Image Descriptor (CID)
 *
 * Complete semantic description of image data.
 * Sections are organized from core (always present) to optional metadata.
 *
 * Mandatory sections:
 * - geometry: spatial dimensions
 * - channels: channel structure
 * - numeric: data type and encoding
 *
 * Optional sections (undefined if not applicable or unknown):
 * - color: color space information
 * - transfer: transfer function
 * - luminance: luminance model
 * - sampling: memory layout and subsampling
 * - alpha: transparency semantics
 * - hdr: HDR-specific metadata
 * - rendering: rendering intent and domain
 * Note: auxiliary images (gain maps, depth, etc.) are planned but not yet
 * part of the descriptor structure. See AuxiliaryRole and
 * AuxiliaryImageDescriptor for future use.
 */
export interface ImageDescriptor {
  // === Core (always present) ===

  /** Spatial geometry */
  geometry: GeometryInfo;

  /** Channel structure */
  channels: ChannelsInfo;

  /** Numeric representation */
  numeric: NumericInfo;

  // === Color & Light (usually present for color images) ===

  /** Color coordinate system (undefined = unknown) */
  color?: ColorInfo;

  /** Transfer function (undefined = unknown) */
  transfer?: TransferInfo;

  /** Luminance model (undefined = unknown, typically SDR) */
  luminance?: LuminanceInfo;

  // === Optional metadata ===

  /** Sample layout and subsampling (undefined = interleaved 4:4:4) */
  sampling?: SamplingInfo;

  /** Alpha channel semantics (undefined = no alpha or unknown) */
  alpha?: AlphaInfo;

  /** HDR metadata (undefined = no HDR metadata) */
  hdr?: HDRMetadata;

  /** Rendering intent and domain (undefined = perceptual/display-referred) */
  rendering?: RenderingInfo;

  // Note: auxiliary images (gain maps, depth, etc.) will be added here
  // when Embind recursive structure support is resolved.
  // See AuxiliaryRole and AuxiliaryImageDescriptor types.

  /**
   * ICC profile (raw bytes)
   * If present, overrides primaries/whitePoint/transfer
   * undefined = no ICC profile
   */
  iccProfile?: Uint8Array;

  /**
   * Format-specific extensions
   * Codecs can attach additional metadata not covered by CID
   */
  formatSpecific?: unknown;
}

// ============================================================================
// 13. Image Data with Descriptor
// ============================================================================

/**
 * Image data with descriptor
 * Replaces ExtendedImageData<TDataType, TMeta>
 */
export interface CodecImageData {
  /** Raw pixel data (interleaved or planar, see descriptor.sampling) */
  data: Uint8Array | Uint16Array | Float16Array | Float32Array;

  /** Complete semantic descriptor */
  descriptor: ImageDescriptor;
}

// ============================================================================
// 14. Convenience Types
// ============================================================================

/**
 * Image info without pixel data
 * Just the descriptor
 */
export type ImageInfo = ImageDescriptor;

/**
 * Minimal descriptor (for simple use cases)
 * Only core sections, useful for validation
 */
export type MinimalDescriptor = Pick<
  ImageDescriptor,
  'geometry' | 'channels' | 'numeric'
>;

/**
 * Type guard: check if descriptor has color info
 */
export function hasColorInfo(descriptor: ImageDescriptor): descriptor is ImageDescriptor & { color: ColorInfo } {
  return descriptor.color !== undefined;
}

/**
 * Type guard: check if descriptor has HDR metadata
 */
export function hasHDRMetadata(descriptor: ImageDescriptor): descriptor is ImageDescriptor & { hdr: HDRMetadata } {
  return descriptor.hdr !== undefined;
}

/**
 * Type guard: check if descriptor has alpha info
 */
export function hasAlphaInfo(descriptor: ImageDescriptor): descriptor is ImageDescriptor & { alpha: AlphaInfo } {
  return descriptor.alpha !== undefined;
}
