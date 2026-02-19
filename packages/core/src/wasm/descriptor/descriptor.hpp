// ============================================================================
// jCodecs Core - Image Descriptor C++ Header
// ============================================================================
//
// C++ implementation of Canonical Image Descriptor (CID)
// Mirrors descriptor-types.ts TypeScript definitions
//
// This header is used by all codec decoders to create ImageDescriptor
// structures that are passed to JavaScript via Embind.
//

#pragma once

#include <array>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace jcodecs {

// ============================================================================
// 1. Geometry
// ============================================================================

using ExifOrientation = uint8_t; // 1-8

struct GeometryInfo {
  uint32_t width;
  uint32_t height;
  std::optional<ExifOrientation> orientation;      // default: 1
  std::optional<float> pixelAspectRatio;           // default: 1.0
};

// ============================================================================
// 2. Sampling
// ============================================================================

enum class SampleLayout {
  Interleaved,   // RGBARGBA...
  Planar,        // RRR...GGG...BBB...
  SemiPlanar     // YYY...UVUV...
};

enum class ChromaSubsampling {
  Chroma444,  // 4:4:4 - no subsampling
  Chroma422,  // 4:2:2 - horizontal 2x
  Chroma420,  // 4:2:0 - horizontal + vertical 2x
  Chroma400   // 4:0:0 - grayscale
};

enum class ChromaSamplePosition {
  Centered,   // Center of 2x2 luma block
  Cosited,    // Top-left luma position
  Vertical,   // Vertically centered, horizontally cosited
  TopLeft     // Alias for Cosited
};

struct SamplingInfo {
  std::optional<SampleLayout> layout;                     // default: Interleaved
  std::optional<ChromaSubsampling> chromaSubsampling;     // default: 4:4:4
  std::optional<ChromaSamplePosition> chromaSamplePosition; // default: Centered
};

// ============================================================================
// 3. Channels
// ============================================================================

enum class ChannelModel {
  RGB,      // 3-channel RGB
  RGBA,     // 4-channel RGB + alpha
  Gray,     // 1-channel grayscale
  GrayA,    // 2-channel grayscale + alpha
  YCbCr,    // 3-channel YCbCr
  YCbCrA,   // 4-channel YCbCr + alpha
  CMYK,     // 4-channel CMYK
  CMYKA,    // 5-channel CMYK + alpha
  XYZ,      // 3-channel CIE XYZ
  LAB,      // 3-channel CIE L*a*b*
  Custom    // Arbitrary channels (EXR)
};

enum class ChannelRole {
  // RGB
  Red, Green, Blue,
  // YCbCr
  Luma, ChromaBlue, ChromaRed,
  // CMYK
  Cyan, Magenta, Yellow, Black,
  // Grayscale
  Gray,
  // Transparency
  Alpha,
  // Depth
  Depth,
  // Normal maps
  NormalX, NormalY, NormalZ,
  // PBR
  Specular, Roughness, Metallic, Occlusion,
  // XYZ
  X, Y, Z,
  // LAB
  Lightness, A, B,
  // Custom
  Custom
};

struct ChannelDescriptor {
  std::string name;      // e.g., "R", "G", "B", "diffuse.R"
  ChannelRole role;
  uint32_t index;        // 0-based channel index
};

struct ChannelsInfo {
  ChannelModel model;
  uint32_t count;
  std::optional<std::vector<ChannelDescriptor>> channels; // For Custom model
};

// ============================================================================
// 4. Numeric Representation
// ============================================================================

enum class SampleType {
  Uint,   // Unsigned integer
  Sint,   // Signed integer
  Float   // Floating point
};

enum class DataType {
  Uint8,
  Uint16,
  Float16,
  Float32
};

enum class Endianness {
  Little,  // Little-endian (x86, ARM, WASM)
  Big,     // Big-endian
  Native   // Platform native
};

// Quantization range
struct QuantizationRange {
  enum class Type { Full, Limited, Custom };
  Type type;
  std::optional<float> min;  // For Custom
  std::optional<float> max;  // For Custom

  static QuantizationRange full() {
    return {Type::Full, std::nullopt, std::nullopt};
  }
  static QuantizationRange limited() {
    return {Type::Limited, std::nullopt, std::nullopt};
  }
  static QuantizationRange custom(float min, float max) {
    return {Type::Custom, min, max};
  }
};

struct NumericInfo {
  SampleType sampleType;
  DataType dataType;
  uint32_t bitDepth;                              // 8, 10, 12, 16, 32
  std::optional<Endianness> endianness;           // default: Native
  std::optional<QuantizationRange> quantization;  // default: Full
};

// ============================================================================
// 5. Color Geometry
// ============================================================================

enum class ColorPrimaries {
  BT709,       // sRGB, Rec.709
  BT2020,      // Rec.2020
  DisplayP3,   // Display P3
  DCIP3,       // DCI P3
  BT470M,      // NTSC
  BT470BG,     // PAL/SECAM
  BT601,       // SDTV
  SMPTE240,
  GenericFilm,
  XYZ,         // CIE XYZ
  EBU3213,
  ACES,        // ACES AP0
  ACEScg       // ACES AP1
};

enum class WhitePoint {
  D65,   // 6500K (most common)
  D50,   // 5000K
  DCI,   // DCI white
  E      // Equal energy
};

enum class MatrixCoefficients {
  Identity,    // RGB
  BT709,
  BT2020NCL,   // Non-constant luminance
  BT2020CL,    // Constant luminance
  BT601,
  SMPTE240,
  YCgCo,       // Lossless
  ICtCp,       // PQ-based
  FCC
};

struct CustomPrimaries {
  std::array<float, 2> red;    // [x, y]
  std::array<float, 2> green;
  std::array<float, 2> blue;
};

struct ColorInfo {
  std::optional<ColorPrimaries> primaries;
  std::optional<WhitePoint> whitePoint;
  std::optional<MatrixCoefficients> matrix;
  std::optional<CustomPrimaries> customPrimaries;
  std::optional<std::array<float, 2>> customWhitePoint;
};

// ============================================================================
// 6. Transfer Function
// ============================================================================

enum class TransferFunction {
  Linear,
  SRGB,
  BT709,
  PQ,          // SMPTE ST 2084
  HLG,         // Hybrid Log-Gamma
  Gamma,       // Power law (see gammaValue)
  BT470M,      // Gamma 2.2
  BT470BG,     // Gamma 2.8
  BT601,
  SMPTE240,
  BT2020_10bit,
  BT2020_12bit,
  Log100,
  Log100Sqrt10,
  IEC61966,
  BT1361,
  SMPTE428,
  DCI
};

struct TransferInfo {
  std::optional<TransferFunction> function;
  std::optional<float> gammaValue;  // If function == Gamma
  // customCurve omitted for now (complex structure)
};

// ============================================================================
// 7. Luminance Model
// ============================================================================

enum class LuminanceReference {
  SDR,  // Standard Dynamic Range
  HDR   // High Dynamic Range
};

struct LuminanceInfo {
  std::optional<LuminanceReference> reference;
  std::optional<float> diffuseWhite;      // nits or relative (1.0 for SDR)
  std::optional<float> peakBrightness;    // nits
  std::optional<float> minBrightness;     // nits
};

// ============================================================================
// 8. Alpha and Compositing
// ============================================================================

enum class AlphaMode {
  None,
  Straight,
  Premultiplied
};

enum class AlphaColorSpace {
  Linear,
  Encoded
};

struct AlphaInfo {
  std::optional<AlphaMode> mode;
  std::optional<AlphaColorSpace> colorSpace;
  std::optional<std::array<float, 3>> matteColor;  // [r, g, b] in [0, 1]
};

// ============================================================================
// 9. HDR Metadata
// ============================================================================

struct MasteringDisplayPrimaries {
  std::array<float, 2> red;
  std::array<float, 2> green;
  std::array<float, 2> blue;
};

struct MasteringDisplayLuminance {
  float min;  // nits
  float max;  // nits
};

struct MasteringDisplay {
  MasteringDisplayPrimaries primaries;
  std::array<float, 2> whitePoint;
  MasteringDisplayLuminance luminance;
};

enum class ToneMappingHint {
  None,
  Clip,
  Reinhard,
  Filmic,
  ACES,
  Custom
};

struct HDRMetadata {
  std::optional<float> maxCLL;   // Maximum Content Light Level (nits)
  std::optional<float> maxPALL;  // Maximum Picture Average Light Level (nits)
  std::optional<MasteringDisplay> masteringDisplay;
  std::optional<ToneMappingHint> toneMappingHint;
};

// ============================================================================
// 10. Rendering Intent
// ============================================================================

enum class RenderingIntent {
  Perceptual,
  Relative,
  Absolute,
  Saturation
};

enum class ImageDomain {
  SceneReferred,
  DisplayReferred,
  OutputReferred
};

struct RenderingInfo {
  std::optional<RenderingIntent> intent;
  std::optional<ImageDomain> domain;
};

// ============================================================================
// 11. Auxiliary Images (forward declaration)
// ============================================================================

enum class AuxiliaryRole {
  GainMap,
  Alpha,
  Depth,
  Disparity,
  Normal,
  Specular,
  Roughness,
  Metallic,
  Occlusion,
  Emissive,
  Thumbnail,
  Mipmap,
  Custom
};

// ============================================================================
// 12. Complete Image Descriptor
// ============================================================================

struct ImageDescriptor {
  // === Core (always present) ===
  GeometryInfo geometry;
  ChannelsInfo channels;
  NumericInfo numeric;

  // === Color & Light (usually present) ===
  std::optional<ColorInfo> color;
  std::optional<TransferInfo> transfer;
  std::optional<LuminanceInfo> luminance;

  // === Optional metadata ===
  std::optional<SamplingInfo> sampling;
  std::optional<AlphaInfo> alpha;
  std::optional<HDRMetadata> hdr;
  std::optional<RenderingInfo> rendering;

  // ICC profile (raw bytes)
  std::optional<std::vector<uint8_t>> iccProfile;

  // TODO: auxiliary images (gain maps, depth, etc.)
  // Deferred due to recursive structure complexity with Embind
};

// ============================================================================
// 13. Builder Pattern (for convenience)
// ============================================================================

class ImageDescriptorBuilder {
public:
  ImageDescriptorBuilder();

  // Core setters (required)
  ImageDescriptorBuilder& setGeometry(uint32_t width, uint32_t height);
  ImageDescriptorBuilder& setOrientation(ExifOrientation orientation);
  ImageDescriptorBuilder& setPixelAspectRatio(float ratio);

  ImageDescriptorBuilder& setChannels(ChannelModel model, uint32_t count);
  ImageDescriptorBuilder& addChannel(const std::string& name, ChannelRole role, uint32_t index);

  ImageDescriptorBuilder& setNumeric(SampleType sampleType, DataType dataType, uint32_t bitDepth);
  ImageDescriptorBuilder& setEndianness(Endianness endianness);
  ImageDescriptorBuilder& setQuantization(QuantizationRange quantization);

  // Color & Light
  ImageDescriptorBuilder& setColorPrimaries(ColorPrimaries primaries);
  ImageDescriptorBuilder& setWhitePoint(WhitePoint whitePoint);
  ImageDescriptorBuilder& setMatrixCoefficients(MatrixCoefficients matrix);
  ImageDescriptorBuilder& setCustomPrimaries(const CustomPrimaries& primaries);
  ImageDescriptorBuilder& setCustomWhitePoint(float x, float y);

  ImageDescriptorBuilder& setTransferFunction(TransferFunction function);
  ImageDescriptorBuilder& setGammaValue(float gamma);

  ImageDescriptorBuilder& setLuminanceReference(LuminanceReference reference);
  ImageDescriptorBuilder& setDiffuseWhite(float nits);
  ImageDescriptorBuilder& setPeakBrightness(float nits);
  ImageDescriptorBuilder& setMinBrightness(float nits);

  // Optional metadata
  ImageDescriptorBuilder& setSampleLayout(SampleLayout layout);
  ImageDescriptorBuilder& setChromaSubsampling(ChromaSubsampling subsampling);
  ImageDescriptorBuilder& setChromaSamplePosition(ChromaSamplePosition position);

  ImageDescriptorBuilder& setAlphaMode(AlphaMode mode);
  ImageDescriptorBuilder& setAlphaColorSpace(AlphaColorSpace colorSpace);
  ImageDescriptorBuilder& setMatteColor(float r, float g, float b);

  ImageDescriptorBuilder& setMaxCLL(float cll);
  ImageDescriptorBuilder& setMaxPALL(float pall);
  ImageDescriptorBuilder& setMasteringDisplay(const MasteringDisplay& display);
  ImageDescriptorBuilder& setToneMappingHint(ToneMappingHint hint);

  ImageDescriptorBuilder& setRenderingIntent(RenderingIntent intent);
  ImageDescriptorBuilder& setImageDomain(ImageDomain domain);

  ImageDescriptorBuilder& setICCProfile(const std::vector<uint8_t>& profile);

  // Build final descriptor
  ImageDescriptor build() const;

private:
  ImageDescriptor descriptor_;
};

// ============================================================================
// 14. Utility Functions
// ============================================================================

// Create descriptor with SDR defaults
ImageDescriptor createSDRDescriptor(
    uint32_t width,
    uint32_t height,
    ChannelModel model,
    DataType dataType,
    uint32_t bitDepth);

// Create descriptor with HDR defaults
ImageDescriptor createHDRDescriptor(
    uint32_t width,
    uint32_t height,
    ChannelModel model,
    DataType dataType,
    uint32_t bitDepth,
    ColorPrimaries primaries = ColorPrimaries::BT2020,
    TransferFunction transfer = TransferFunction::PQ);

// Validation
bool isValidDescriptor(const ImageDescriptor& descriptor);

// Comparison
bool areDescriptorsCompatible(const ImageDescriptor& a, const ImageDescriptor& b);

} // namespace jcodecs
