// ============================================================================
// jCodecs Core - Embind Bindings for Image Descriptor
// ============================================================================
//
// Binds C++ ImageDescriptor types to JavaScript/TypeScript
// Generated types must match descriptor-types.ts
//

#include "descriptor.hpp"
#include <emscripten/bind.h>

using namespace emscripten;
using namespace jcodecs;

EMSCRIPTEN_BINDINGS(jcodecs_descriptor) {

  value_array<std::array<float, 2>>("ArrayFloat2")
    .element(emscripten::index<0>())
    .element(emscripten::index<1>());

  value_array<std::array<float, 3>>("ArrayFloat3")
    .element(emscripten::index<0>())
    .element(emscripten::index<1>())
    .element(emscripten::index<2>());

  // ==========================================================================
  // 1. Geometry
  // ==========================================================================

  value_object<GeometryInfo>("GeometryInfo")
      .field("width", &GeometryInfo::width)
      .field("height", &GeometryInfo::height)
      .field("orientation", &GeometryInfo::orientation)
      .field("pixelAspectRatio", &GeometryInfo::pixelAspectRatio);

  // ==========================================================================
  // 2. Sampling
  // ==========================================================================

  enum_<SampleLayout>("SampleLayout")
      .value("interleaved", SampleLayout::Interleaved)
      .value("planar", SampleLayout::Planar)
      .value("semiPlanar", SampleLayout::SemiPlanar);

  enum_<ChromaSubsampling>("ChromaSubsampling")
      .value("444", ChromaSubsampling::Chroma444)
      .value("422", ChromaSubsampling::Chroma422)
      .value("420", ChromaSubsampling::Chroma420)
      .value("400", ChromaSubsampling::Chroma400);

  enum_<ChromaSamplePosition>("ChromaSamplePosition")
      .value("centered", ChromaSamplePosition::Centered)
      .value("cosited", ChromaSamplePosition::Cosited)
      .value("vertical", ChromaSamplePosition::Vertical)
      .value("topleft", ChromaSamplePosition::TopLeft);

  value_object<SamplingInfo>("SamplingInfo")
      .field("layout", &SamplingInfo::layout)
      .field("chromaSubsampling", &SamplingInfo::chromaSubsampling)
      .field("chromaSamplePosition", &SamplingInfo::chromaSamplePosition);

  // ==========================================================================
  // 3. Channels
  // ==========================================================================

  enum_<ChannelModel>("ChannelModel")
      .value("rgb", ChannelModel::RGB)
      .value("rgba", ChannelModel::RGBA)
      .value("gray", ChannelModel::Gray)
      .value("graya", ChannelModel::GrayA)
      .value("ycbcr", ChannelModel::YCbCr)
      .value("ycbcra", ChannelModel::YCbCrA)
      .value("cmyk", ChannelModel::CMYK)
      .value("cmyka", ChannelModel::CMYKA)
      .value("xyz", ChannelModel::XYZ)
      .value("lab", ChannelModel::LAB)
      .value("custom", ChannelModel::Custom);

  enum_<ChannelRole>("ChannelRole")
      .value("red", ChannelRole::Red)
      .value("green", ChannelRole::Green)
      .value("blue", ChannelRole::Blue)
      .value("luma", ChannelRole::Luma)
      .value("chromaBlue", ChannelRole::ChromaBlue)
      .value("chromaRed", ChannelRole::ChromaRed)
      .value("cyan", ChannelRole::Cyan)
      .value("magenta", ChannelRole::Magenta)
      .value("yellow", ChannelRole::Yellow)
      .value("black", ChannelRole::Black)
      .value("gray", ChannelRole::Gray)
      .value("alpha", ChannelRole::Alpha)
      .value("depth", ChannelRole::Depth)
      .value("normalX", ChannelRole::NormalX)
      .value("normalY", ChannelRole::NormalY)
      .value("normalZ", ChannelRole::NormalZ)
      .value("specular", ChannelRole::Specular)
      .value("roughness", ChannelRole::Roughness)
      .value("metallic", ChannelRole::Metallic)
      .value("occlusion", ChannelRole::Occlusion)
      .value("x", ChannelRole::X)
      .value("y", ChannelRole::Y)
      .value("z", ChannelRole::Z)
      .value("lightness", ChannelRole::Lightness)
      .value("a", ChannelRole::A)
      .value("b", ChannelRole::B)
      .value("custom", ChannelRole::Custom);

  value_object<ChannelDescriptor>("ChannelDescriptor")
      .field("name", &ChannelDescriptor::name)
      .field("role", &ChannelDescriptor::role)
      .field("index", &ChannelDescriptor::index);

  value_object<ChannelsInfo>("ChannelsInfo")
      .field("model", &ChannelsInfo::model)
      .field("count", &ChannelsInfo::count)
      .field("channels", &ChannelsInfo::channels);

  // ==========================================================================
  // 4. Numeric Representation
  // ==========================================================================

  enum_<SampleType>("SampleType")
      .value("uint", SampleType::Uint)
      .value("sint", SampleType::Sint)
      .value("float", SampleType::Float);

  enum_<DataType>("DataType")
      .value("uint8", DataType::Uint8)
      .value("uint16", DataType::Uint16)
      .value("float16", DataType::Float16)
      .value("float32", DataType::Float32);

  enum_<Endianness>("Endianness")
      .value("little", Endianness::Little)
      .value("big", Endianness::Big)
      .value("native", Endianness::Native);

  value_object<QuantizationRange>("QuantizationRange")
      .field("type", &QuantizationRange::type)
      .field("min", &QuantizationRange::min)
      .field("max", &QuantizationRange::max);

  enum_<QuantizationRange::Type>("QuantizationRangeType")
      .value("full", QuantizationRange::Type::Full)
      .value("limited", QuantizationRange::Type::Limited)
      .value("custom", QuantizationRange::Type::Custom);

  value_object<NumericInfo>("NumericInfo")
      .field("sampleType", &NumericInfo::sampleType)
      .field("dataType", &NumericInfo::dataType)
      .field("bitDepth", &NumericInfo::bitDepth)
      .field("endianness", &NumericInfo::endianness)
      .field("quantization", &NumericInfo::quantization);

  // ==========================================================================
  // 5. Color Geometry
  // ==========================================================================

  enum_<ColorPrimaries>("ColorPrimaries")
      .value("bt709", ColorPrimaries::BT709)
      .value("bt2020", ColorPrimaries::BT2020)
      .value("displayP3", ColorPrimaries::DisplayP3)
      .value("dciP3", ColorPrimaries::DCIP3)
      .value("bt470m", ColorPrimaries::BT470M)
      .value("bt470bg", ColorPrimaries::BT470BG)
      .value("bt601", ColorPrimaries::BT601)
      .value("smpte240", ColorPrimaries::SMPTE240)
      .value("genericFilm", ColorPrimaries::GenericFilm)
      .value("xyz", ColorPrimaries::XYZ)
      .value("ebu3213", ColorPrimaries::EBU3213)
      .value("aces", ColorPrimaries::ACES)
      .value("acescg", ColorPrimaries::ACEScg);

  enum_<WhitePoint>("WhitePoint")
      .value("d65", WhitePoint::D65)
      .value("d50", WhitePoint::D50)
      .value("dci", WhitePoint::DCI)
      .value("e", WhitePoint::E);

  enum_<MatrixCoefficients>("MatrixCoefficients")
      .value("identity", MatrixCoefficients::Identity)
      .value("bt709", MatrixCoefficients::BT709)
      .value("bt2020Ncl", MatrixCoefficients::BT2020NCL)
      .value("bt2020Cl", MatrixCoefficients::BT2020CL)
      .value("bt601", MatrixCoefficients::BT601)
      .value("smpte240", MatrixCoefficients::SMPTE240)
      .value("ycgco", MatrixCoefficients::YCgCo)
      .value("ictcp", MatrixCoefficients::ICtCp)
      .value("fcc", MatrixCoefficients::FCC);

  value_object<CustomPrimaries>("CustomPrimaries")
      .field("red", &CustomPrimaries::red)
      .field("green", &CustomPrimaries::green)
      .field("blue", &CustomPrimaries::blue);

  value_object<ColorInfo>("ColorInfo")
      .field("primaries", &ColorInfo::primaries)
      .field("whitePoint", &ColorInfo::whitePoint)
      .field("matrix", &ColorInfo::matrix)
      .field("customPrimaries", &ColorInfo::customPrimaries)
      .field("customWhitePoint", &ColorInfo::customWhitePoint);

  // ==========================================================================
  // 6. Transfer Function
  // ==========================================================================

  enum_<TransferFunction>("TransferFunction")
      .value("linear", TransferFunction::Linear)
      .value("srgb", TransferFunction::SRGB)
      .value("bt709", TransferFunction::BT709)
      .value("pq", TransferFunction::PQ)
      .value("hlg", TransferFunction::HLG)
      .value("gamma", TransferFunction::Gamma)
      .value("bt470m", TransferFunction::BT470M)
      .value("bt470bg", TransferFunction::BT470BG)
      .value("bt601", TransferFunction::BT601)
      .value("smpte240", TransferFunction::SMPTE240)
      .value("bt202010Bit", TransferFunction::BT2020_10bit)
      .value("bt202012Bit", TransferFunction::BT2020_12bit)
      .value("log100", TransferFunction::Log100)
      .value("log100Sqrt10", TransferFunction::Log100Sqrt10)
      .value("iec61966", TransferFunction::IEC61966)
      .value("bt1361", TransferFunction::BT1361)
      .value("smpte428", TransferFunction::SMPTE428)
      .value("dci", TransferFunction::DCI);

  value_object<TransferInfo>("TransferInfo")
      .field("function", &TransferInfo::function)
      .field("gammaValue", &TransferInfo::gammaValue);

  // ==========================================================================
  // 7. Luminance Model
  // ==========================================================================

  enum_<LuminanceReference>("LuminanceReference")
      .value("sdr", LuminanceReference::SDR)
      .value("hdr", LuminanceReference::HDR);

  value_object<LuminanceInfo>("LuminanceInfo")
      .field("reference", &LuminanceInfo::reference)
      .field("diffuseWhite", &LuminanceInfo::diffuseWhite)
      .field("peakBrightness", &LuminanceInfo::peakBrightness)
      .field("minBrightness", &LuminanceInfo::minBrightness);

  // ==========================================================================
  // 8. Alpha and Compositing
  // ==========================================================================

  enum_<AlphaMode>("AlphaMode")
      .value("none", AlphaMode::None)
      .value("straight", AlphaMode::Straight)
      .value("premultiplied", AlphaMode::Premultiplied);

  enum_<AlphaColorSpace>("AlphaColorSpace")
      .value("linear", AlphaColorSpace::Linear)
      .value("encoded", AlphaColorSpace::Encoded);

  value_object<AlphaInfo>("AlphaInfo")
      .field("mode", &AlphaInfo::mode)
      .field("colorSpace", &AlphaInfo::colorSpace)
      .field("matteColor", &AlphaInfo::matteColor);

  // ==========================================================================
  // 9. HDR Metadata
  // ==========================================================================

  value_object<MasteringDisplayPrimaries>("MasteringDisplayPrimaries")
      .field("red", &MasteringDisplayPrimaries::red)
      .field("green", &MasteringDisplayPrimaries::green)
      .field("blue", &MasteringDisplayPrimaries::blue);

  value_object<MasteringDisplayLuminance>("MasteringDisplayLuminance")
      .field("min", &MasteringDisplayLuminance::min)
      .field("max", &MasteringDisplayLuminance::max);

  value_object<MasteringDisplay>("MasteringDisplay")
      .field("primaries", &MasteringDisplay::primaries)
      .field("whitePoint", &MasteringDisplay::whitePoint)
      .field("luminance", &MasteringDisplay::luminance);

  enum_<ToneMappingHint>("ToneMappingHint")
      .value("none", ToneMappingHint::None)
      .value("clip", ToneMappingHint::Clip)
      .value("reinhard", ToneMappingHint::Reinhard)
      .value("filmic", ToneMappingHint::Filmic)
      .value("aces", ToneMappingHint::ACES)
      .value("custom", ToneMappingHint::Custom);

  value_object<HDRMetadata>("HDRMetadata")
      .field("maxCLL", &HDRMetadata::maxCLL)
      .field("maxPALL", &HDRMetadata::maxPALL)
      .field("masteringDisplay", &HDRMetadata::masteringDisplay)
      .field("toneMappingHint", &HDRMetadata::toneMappingHint);

  // ==========================================================================
  // 10. Rendering Intent
  // ==========================================================================

  enum_<RenderingIntent>("RenderingIntent")
      .value("perceptual", RenderingIntent::Perceptual)
      .value("relative", RenderingIntent::Relative)
      .value("absolute", RenderingIntent::Absolute)
      .value("saturation", RenderingIntent::Saturation);

  enum_<ImageDomain>("ImageDomain")
      .value("sceneReferred", ImageDomain::SceneReferred)
      .value("displayReferred", ImageDomain::DisplayReferred)
      .value("outputReferred", ImageDomain::OutputReferred);

  value_object<RenderingInfo>("RenderingInfo")
      .field("intent", &RenderingInfo::intent)
      .field("domain", &RenderingInfo::domain);

  // ==========================================================================
  // 11. Auxiliary Images
  // ==========================================================================

  enum_<AuxiliaryRole>("AuxiliaryRole")
      .value("gainMap", AuxiliaryRole::GainMap)
      .value("alpha", AuxiliaryRole::Alpha)
      .value("depth", AuxiliaryRole::Depth)
      .value("disparity", AuxiliaryRole::Disparity)
      .value("normal", AuxiliaryRole::Normal)
      .value("specular", AuxiliaryRole::Specular)
      .value("roughness", AuxiliaryRole::Roughness)
      .value("metallic", AuxiliaryRole::Metallic)
      .value("occlusion", AuxiliaryRole::Occlusion)
      .value("emissive", AuxiliaryRole::Emissive)
      .value("thumbnail", AuxiliaryRole::Thumbnail)
      .value("mipmap", AuxiliaryRole::Mipmap)
      .value("custom", AuxiliaryRole::Custom);


  // ==========================================================================
  // 12. Complete Image Descriptor
  // ==========================================================================

  value_object<ImageDescriptor>("ImageDescriptor")
      .field("geometry", &ImageDescriptor::geometry)
      .field("channels", &ImageDescriptor::channels)
      .field("numeric", &ImageDescriptor::numeric)
      .field("color", &ImageDescriptor::color)
      .field("transfer", &ImageDescriptor::transfer)
      .field("luminance", &ImageDescriptor::luminance)
      .field("sampling", &ImageDescriptor::sampling)
      .field("alpha", &ImageDescriptor::alpha)
      .field("hdr", &ImageDescriptor::hdr)
      .field("rendering", &ImageDescriptor::rendering)
      .field("iccProfile", &ImageDescriptor::iccProfile);

  // ==========================================================================
  // 13. Builder Pattern
  // ==========================================================================

  class_<ImageDescriptorBuilder>("ImageDescriptorBuilder")
      .constructor<>()

      // Geometry
      .function("setGeometry", &ImageDescriptorBuilder::setGeometry)
      .function("setOrientation", &ImageDescriptorBuilder::setOrientation)
      .function("setPixelAspectRatio", &ImageDescriptorBuilder::setPixelAspectRatio)

      // Channels
      .function("setChannels", &ImageDescriptorBuilder::setChannels)
      .function("addChannel", &ImageDescriptorBuilder::addChannel)

      // Numeric
      .function("setNumeric", &ImageDescriptorBuilder::setNumeric)
      .function("setEndianness", &ImageDescriptorBuilder::setEndianness)
      .function("setQuantization", &ImageDescriptorBuilder::setQuantization)

      // Color
      .function("setColorPrimaries", &ImageDescriptorBuilder::setColorPrimaries)
      .function("setWhitePoint", &ImageDescriptorBuilder::setWhitePoint)
      .function("setMatrixCoefficients", &ImageDescriptorBuilder::setMatrixCoefficients)
      .function("setCustomPrimaries", &ImageDescriptorBuilder::setCustomPrimaries)
      .function("setCustomWhitePoint", &ImageDescriptorBuilder::setCustomWhitePoint)

      // Transfer
      .function("setTransferFunction", &ImageDescriptorBuilder::setTransferFunction)
      .function("setGammaValue", &ImageDescriptorBuilder::setGammaValue)

      // Luminance
      .function("setLuminanceReference", &ImageDescriptorBuilder::setLuminanceReference)
      .function("setDiffuseWhite", &ImageDescriptorBuilder::setDiffuseWhite)
      .function("setPeakBrightness", &ImageDescriptorBuilder::setPeakBrightness)
      .function("setMinBrightness", &ImageDescriptorBuilder::setMinBrightness)

      // Sampling
      .function("setSampleLayout", &ImageDescriptorBuilder::setSampleLayout)
      .function("setChromaSubsampling", &ImageDescriptorBuilder::setChromaSubsampling)
      .function("setChromaSamplePosition", &ImageDescriptorBuilder::setChromaSamplePosition)

      // Alpha
      .function("setAlphaMode", &ImageDescriptorBuilder::setAlphaMode)
      .function("setAlphaColorSpace", &ImageDescriptorBuilder::setAlphaColorSpace)
      .function("setMatteColor", &ImageDescriptorBuilder::setMatteColor)

      // HDR
      .function("setMaxCLL", &ImageDescriptorBuilder::setMaxCLL)
      .function("setMaxPALL", &ImageDescriptorBuilder::setMaxPALL)
      .function("setMasteringDisplay", &ImageDescriptorBuilder::setMasteringDisplay)
      .function("setToneMappingHint", &ImageDescriptorBuilder::setToneMappingHint)

      // Rendering
      .function("setRenderingIntent", &ImageDescriptorBuilder::setRenderingIntent)
      .function("setImageDomain", &ImageDescriptorBuilder::setImageDomain)

      // ICC Profile
      .function("setICCProfile", &ImageDescriptorBuilder::setICCProfile)

      // Build
      .function("build", &ImageDescriptorBuilder::build);

  // ==========================================================================
  // 14. Utility Functions
  // ==========================================================================

  function("createSDRDescriptor", &createSDRDescriptor);
  function("createHDRDescriptor", &createHDRDescriptor);
  function("isValidDescriptor", &isValidDescriptor);
  function("areDescriptorsCompatible", &areDescriptorsCompatible);

  // ==========================================================================
  // Register vectors and optionals
  // ==========================================================================

  register_vector<ChannelDescriptor>("VectorChannelDescriptor");
  register_vector<uint8_t>("VectorUint8");

  // Primitive optionals
  register_optional<uint8_t>();
  register_optional<float>();
  register_optional<std::array<float, 2>>();
  register_optional<std::array<float, 3>>();
  register_optional<std::vector<uint8_t>>();

  // Enum optionals
  register_optional<SampleLayout>();
  register_optional<ChromaSubsampling>();
  register_optional<ChromaSamplePosition>();
  register_optional<ColorPrimaries>();
  register_optional<WhitePoint>();
  register_optional<MatrixCoefficients>();
  register_optional<TransferFunction>();
  register_optional<LuminanceReference>();
  register_optional<AlphaMode>();
  register_optional<AlphaColorSpace>();
  register_optional<ToneMappingHint>();
  register_optional<RenderingIntent>();
  register_optional<ImageDomain>();
  register_optional<Endianness>();

  // Struct optionals
  register_optional<CustomPrimaries>();
  register_optional<MasteringDisplay>();
  register_optional<QuantizationRange>();
  register_optional<std::vector<ChannelDescriptor>>();
  register_optional<ColorInfo>();
  register_optional<TransferInfo>();
  register_optional<LuminanceInfo>();
  register_optional<SamplingInfo>();
  register_optional<AlphaInfo>();
  register_optional<HDRMetadata>();
  register_optional<RenderingInfo>();
}
