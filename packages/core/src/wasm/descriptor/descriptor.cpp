// ============================================================================
// jCodecs Core - Image Descriptor Implementation
// ============================================================================

#include "descriptor.hpp"

namespace jcodecs {

// ============================================================================
// ImageDescriptorBuilder Implementation
// ============================================================================

ImageDescriptorBuilder::ImageDescriptorBuilder() {
  // Initialize with empty descriptor
  // Core fields will be set via builder methods
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setGeometry(uint32_t width, uint32_t height) {
  descriptor_.geometry.width = width;
  descriptor_.geometry.height = height;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setOrientation(ExifOrientation orientation) {
  descriptor_.geometry.orientation = orientation;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setPixelAspectRatio(float ratio) {
  descriptor_.geometry.pixelAspectRatio = ratio;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setChannels(ChannelModel model, uint32_t count) {
  descriptor_.channels.model = model;
  descriptor_.channels.count = count;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::addChannel(
    const std::string& name, ChannelRole role, uint32_t index) {
  if (!descriptor_.channels.channels) {
    descriptor_.channels.channels = std::vector<ChannelDescriptor>();
  }
  descriptor_.channels.channels->push_back({name, role, index});
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setNumeric(
    SampleType sampleType, DataType dataType, uint32_t bitDepth) {
  descriptor_.numeric.sampleType = sampleType;
  descriptor_.numeric.dataType = dataType;
  descriptor_.numeric.bitDepth = bitDepth;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setEndianness(Endianness endianness) {
  descriptor_.numeric.endianness = endianness;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setQuantization(QuantizationRange quantization) {
  descriptor_.numeric.quantization = quantization;
  return *this;
}

// Color & Light

ImageDescriptorBuilder& ImageDescriptorBuilder::setColorPrimaries(ColorPrimaries primaries) {
  if (!descriptor_.color) {
    descriptor_.color = ColorInfo{};
  }
  descriptor_.color->primaries = primaries;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setWhitePoint(WhitePoint whitePoint) {
  if (!descriptor_.color) {
    descriptor_.color = ColorInfo{};
  }
  descriptor_.color->whitePoint = whitePoint;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setMatrixCoefficients(MatrixCoefficients matrix) {
  if (!descriptor_.color) {
    descriptor_.color = ColorInfo{};
  }
  descriptor_.color->matrix = matrix;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setCustomPrimaries(const CustomPrimaries& primaries) {
  if (!descriptor_.color) {
    descriptor_.color = ColorInfo{};
  }
  descriptor_.color->customPrimaries = primaries;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setCustomWhitePoint(float x, float y) {
  if (!descriptor_.color) {
    descriptor_.color = ColorInfo{};
  }
  descriptor_.color->customWhitePoint = std::array<float, 2>{x, y};
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setTransferFunction(TransferFunction function) {
  if (!descriptor_.transfer) {
    descriptor_.transfer = TransferInfo{};
  }
  descriptor_.transfer->function = function;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setGammaValue(float gamma) {
  if (!descriptor_.transfer) {
    descriptor_.transfer = TransferInfo{};
  }
  descriptor_.transfer->gammaValue = gamma;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setLuminanceReference(LuminanceReference reference) {
  if (!descriptor_.luminance) {
    descriptor_.luminance = LuminanceInfo{};
  }
  descriptor_.luminance->reference = reference;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setDiffuseWhite(float nits) {
  if (!descriptor_.luminance) {
    descriptor_.luminance = LuminanceInfo{};
  }
  descriptor_.luminance->diffuseWhite = nits;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setPeakBrightness(float nits) {
  if (!descriptor_.luminance) {
    descriptor_.luminance = LuminanceInfo{};
  }
  descriptor_.luminance->peakBrightness = nits;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setMinBrightness(float nits) {
  if (!descriptor_.luminance) {
    descriptor_.luminance = LuminanceInfo{};
  }
  descriptor_.luminance->minBrightness = nits;
  return *this;
}

// Optional metadata

ImageDescriptorBuilder& ImageDescriptorBuilder::setSampleLayout(SampleLayout layout) {
  if (!descriptor_.sampling) {
    descriptor_.sampling = SamplingInfo{};
  }
  descriptor_.sampling->layout = layout;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setChromaSubsampling(ChromaSubsampling subsampling) {
  if (!descriptor_.sampling) {
    descriptor_.sampling = SamplingInfo{};
  }
  descriptor_.sampling->chromaSubsampling = subsampling;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setChromaSamplePosition(ChromaSamplePosition position) {
  if (!descriptor_.sampling) {
    descriptor_.sampling = SamplingInfo{};
  }
  descriptor_.sampling->chromaSamplePosition = position;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setAlphaMode(AlphaMode mode) {
  if (!descriptor_.alpha) {
    descriptor_.alpha = AlphaInfo{};
  }
  descriptor_.alpha->mode = mode;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setAlphaColorSpace(AlphaColorSpace colorSpace) {
  if (!descriptor_.alpha) {
    descriptor_.alpha = AlphaInfo{};
  }
  descriptor_.alpha->colorSpace = colorSpace;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setMatteColor(float r, float g, float b) {
  if (!descriptor_.alpha) {
    descriptor_.alpha = AlphaInfo{};
  }
  descriptor_.alpha->matteColor = std::array<float, 3>{r, g, b};
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setMaxCLL(float cll) {
  if (!descriptor_.hdr) {
    descriptor_.hdr = HDRMetadata{};
  }
  descriptor_.hdr->maxCLL = cll;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setMaxPALL(float pall) {
  if (!descriptor_.hdr) {
    descriptor_.hdr = HDRMetadata{};
  }
  descriptor_.hdr->maxPALL = pall;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setMasteringDisplay(const MasteringDisplay& display) {
  if (!descriptor_.hdr) {
    descriptor_.hdr = HDRMetadata{};
  }
  descriptor_.hdr->masteringDisplay = display;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setToneMappingHint(ToneMappingHint hint) {
  if (!descriptor_.hdr) {
    descriptor_.hdr = HDRMetadata{};
  }
  descriptor_.hdr->toneMappingHint = hint;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setRenderingIntent(RenderingIntent intent) {
  if (!descriptor_.rendering) {
    descriptor_.rendering = RenderingInfo{};
  }
  descriptor_.rendering->intent = intent;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setImageDomain(ImageDomain domain) {
  if (!descriptor_.rendering) {
    descriptor_.rendering = RenderingInfo{};
  }
  descriptor_.rendering->domain = domain;
  return *this;
}

ImageDescriptorBuilder& ImageDescriptorBuilder::setICCProfile(const std::vector<uint8_t>& profile) {
  descriptor_.iccProfile = profile;
  return *this;
}

ImageDescriptor ImageDescriptorBuilder::build() const {
  return descriptor_;
}

// ============================================================================
// Utility Functions
// ============================================================================

ImageDescriptor createSDRDescriptor(
    uint32_t width,
    uint32_t height,
    ChannelModel model,
    DataType dataType,
    uint32_t bitDepth) {

  ImageDescriptorBuilder builder;

  // Core
  builder.setGeometry(width, height);
  builder.setChannels(model, model == ChannelModel::RGBA || model == ChannelModel::GrayA ? 4 : 3);
  builder.setNumeric(SampleType::Uint, dataType, bitDepth);
  builder.setQuantization(QuantizationRange::full());

  // SDR defaults
  builder.setColorPrimaries(ColorPrimaries::BT709);
  builder.setWhitePoint(WhitePoint::D65);
  builder.setMatrixCoefficients(MatrixCoefficients::Identity);
  builder.setTransferFunction(TransferFunction::SRGB);
  builder.setLuminanceReference(LuminanceReference::SDR);

  return builder.build();
}

ImageDescriptor createHDRDescriptor(
    uint32_t width,
    uint32_t height,
    ChannelModel model,
    DataType dataType,
    uint32_t bitDepth,
    ColorPrimaries primaries,
    TransferFunction transfer) {

  ImageDescriptorBuilder builder;

  // Core
  builder.setGeometry(width, height);
  builder.setChannels(model, model == ChannelModel::RGBA || model == ChannelModel::GrayA ? 4 : 3);
  builder.setNumeric(SampleType::Uint, dataType, bitDepth);
  builder.setQuantization(QuantizationRange::full());

  // HDR defaults
  builder.setColorPrimaries(primaries);
  builder.setWhitePoint(WhitePoint::D65);
  builder.setMatrixCoefficients(MatrixCoefficients::Identity);
  builder.setTransferFunction(transfer);
  builder.setLuminanceReference(LuminanceReference::HDR);

  return builder.build();
}

bool isValidDescriptor(const ImageDescriptor& descriptor) {
  // Basic validation
  if (descriptor.geometry.width == 0 || descriptor.geometry.height == 0) {
    return false;
  }
  if (descriptor.channels.count == 0) {
    return false;
  }
  if (descriptor.numeric.bitDepth == 0) {
    return false;
  }
  // TODO: More comprehensive validation
  return true;
}

bool areDescriptorsCompatible(const ImageDescriptor& a, const ImageDescriptor& b) {
  // Check if descriptors are compatible for processing
  if (a.geometry.width != b.geometry.width || a.geometry.height != b.geometry.height) {
    return false;
  }
  if (a.channels.model != b.channels.model || a.channels.count != b.channels.count) {
    return false;
  }
  if (a.numeric.dataType != b.numeric.dataType) {
    return false;
  }
  // Color space differences are allowed (can be converted)
  return true;
}

} // namespace jcodecs
