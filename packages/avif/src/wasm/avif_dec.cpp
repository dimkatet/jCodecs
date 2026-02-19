#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <avif/avif.h>
#include <cstdint>
#include <cstring>
#include <string>
#include <optional>

#include "descriptor.hpp"

using namespace emscripten;
using namespace jcodecs;

// Max threads constant (defined via CMake for MT builds)
#ifndef MAX_THREADS
#define MAX_THREADS 1  // Single-threaded fallback
#endif

// ============================================================================
// CICP → jcodecs enum mapping
// ============================================================================

std::optional<ColorPrimaries> mapColorPrimaries(avifColorPrimaries primaries)
{
    switch (primaries)
    {
    case AVIF_COLOR_PRIMARIES_BT709:        return ColorPrimaries::BT709;
    case AVIF_COLOR_PRIMARIES_BT470M:       return ColorPrimaries::BT470M;
    case AVIF_COLOR_PRIMARIES_BT470BG:      return ColorPrimaries::BT470BG;
    case AVIF_COLOR_PRIMARIES_BT601:        return ColorPrimaries::BT601;
    case AVIF_COLOR_PRIMARIES_SMPTE240:     return ColorPrimaries::SMPTE240;
    case AVIF_COLOR_PRIMARIES_GENERIC_FILM: return ColorPrimaries::GenericFilm;
    case AVIF_COLOR_PRIMARIES_BT2020:       return ColorPrimaries::BT2020;
    case AVIF_COLOR_PRIMARIES_XYZ:          return ColorPrimaries::XYZ;
    case AVIF_COLOR_PRIMARIES_SMPTE431:     return ColorPrimaries::DCIP3;
    case AVIF_COLOR_PRIMARIES_SMPTE432:     return ColorPrimaries::DisplayP3;
    case AVIF_COLOR_PRIMARIES_EBU3213:      return ColorPrimaries::EBU3213;
    default:                                return std::nullopt;
    }
}

std::optional<TransferFunction> mapTransferFunction(avifTransferCharacteristics tc)
{
    switch (tc)
    {
    case AVIF_TRANSFER_CHARACTERISTICS_BT709:        return TransferFunction::BT709;
    case AVIF_TRANSFER_CHARACTERISTICS_BT470M:       return TransferFunction::BT470M;
    case AVIF_TRANSFER_CHARACTERISTICS_BT470BG:      return TransferFunction::BT470BG;
    case AVIF_TRANSFER_CHARACTERISTICS_BT601:        return TransferFunction::BT601;
    case AVIF_TRANSFER_CHARACTERISTICS_SMPTE240:     return TransferFunction::SMPTE240;
    case AVIF_TRANSFER_CHARACTERISTICS_LINEAR:       return TransferFunction::Linear;
    case AVIF_TRANSFER_CHARACTERISTICS_LOG100:       return TransferFunction::Log100;
    case AVIF_TRANSFER_CHARACTERISTICS_LOG100_SQRT10:return TransferFunction::Log100Sqrt10;
    case AVIF_TRANSFER_CHARACTERISTICS_IEC61966:     return TransferFunction::IEC61966;
    case AVIF_TRANSFER_CHARACTERISTICS_BT1361:       return TransferFunction::BT1361;
    case AVIF_TRANSFER_CHARACTERISTICS_SRGB:         return TransferFunction::SRGB;
    case AVIF_TRANSFER_CHARACTERISTICS_BT2020_10BIT: return TransferFunction::BT2020_10bit;
    case AVIF_TRANSFER_CHARACTERISTICS_BT2020_12BIT: return TransferFunction::BT2020_12bit;
    case AVIF_TRANSFER_CHARACTERISTICS_PQ:           return TransferFunction::PQ;
    case AVIF_TRANSFER_CHARACTERISTICS_SMPTE428:     return TransferFunction::SMPTE428;
    case AVIF_TRANSFER_CHARACTERISTICS_HLG:          return TransferFunction::HLG;
    default:                                         return std::nullopt;
    }
}

std::optional<MatrixCoefficients> mapMatrixCoefficients(avifMatrixCoefficients mc)
{
    switch (mc)
    {
    case AVIF_MATRIX_COEFFICIENTS_IDENTITY:  return MatrixCoefficients::Identity;
    case AVIF_MATRIX_COEFFICIENTS_BT709:     return MatrixCoefficients::BT709;
    case AVIF_MATRIX_COEFFICIENTS_FCC:       return MatrixCoefficients::FCC;
    case AVIF_MATRIX_COEFFICIENTS_BT470BG:   return MatrixCoefficients::BT601;
    case AVIF_MATRIX_COEFFICIENTS_BT601:     return MatrixCoefficients::BT601;
    case AVIF_MATRIX_COEFFICIENTS_SMPTE240:  return MatrixCoefficients::SMPTE240;
    case AVIF_MATRIX_COEFFICIENTS_YCGCO:     return MatrixCoefficients::YCgCo;
    case AVIF_MATRIX_COEFFICIENTS_BT2020_NCL:return MatrixCoefficients::BT2020NCL;
    case AVIF_MATRIX_COEFFICIENTS_BT2020_CL: return MatrixCoefficients::BT2020CL;
    case AVIF_MATRIX_COEFFICIENTS_ICTCP:     return MatrixCoefficients::ICtCp;
    default:                                 return std::nullopt;
    }
}

bool isHDRTransfer(avifTransferCharacteristics tc)
{
    return tc == AVIF_TRANSFER_CHARACTERISTICS_PQ ||
           tc == AVIF_TRANSFER_CHARACTERISTICS_HLG;
}

// ============================================================================
// Result structures
// ============================================================================

struct DecodeResult
{
    uintptr_t dataPtr;
    size_t dataSize;
    ImageDescriptor descriptor;
    std::string error;
};

// ============================================================================
// Build ImageDescriptor from avifImage (after YUV→RGB conversion)
// ============================================================================

ImageDescriptor buildDescriptor(
    const avifImage *image,
    uint32_t outputWidth,
    uint32_t outputHeight,
    uint32_t outputDepth,
    uint32_t outputChannels,
    bool alphaPremultiplied)
{
    ImageDescriptorBuilder builder;

    // Geometry
    builder.setGeometry(outputWidth, outputHeight);

    // Channels (post YUV→RGB conversion)
    ChannelModel model;
    if (outputChannels == 1) {
        model = ChannelModel::Gray;
    } else if (outputChannels == 2) {
        model = ChannelModel::GrayA;
    } else if (outputChannels == 4) {
        model = ChannelModel::RGBA;
    } else {
        model = ChannelModel::RGB;
    }
    builder.setChannels(model, outputChannels);

    // Numeric
    DataType dataType = (outputDepth > 8) ? DataType::Uint16 : DataType::Uint8;
    builder.setNumeric(SampleType::Uint, dataType, outputDepth);

    // Quantization
    if (image->yuvRange == AVIF_RANGE_FULL) {
        builder.setQuantization(QuantizationRange::full());
    } else {
        builder.setQuantization(QuantizationRange::limited());
    }

    // Sampling (post-conversion: always interleaved RGB)
    builder.setSampleLayout(SampleLayout::Interleaved);

    // Color primaries
    auto primaries = mapColorPrimaries(image->colorPrimaries);
    if (primaries) {
        builder.setColorPrimaries(*primaries);
    }

    // White point (most CICP primaries use D65)
    builder.setWhitePoint(WhitePoint::D65);

    // Matrix coefficients (identity after YUV→RGB conversion)
    builder.setMatrixCoefficients(MatrixCoefficients::Identity);

    // Transfer function
    auto transfer = mapTransferFunction(image->transferCharacteristics);
    if (transfer) {
        builder.setTransferFunction(*transfer);
    }

    // Luminance reference
    if (isHDRTransfer(image->transferCharacteristics)) {
        builder.setLuminanceReference(LuminanceReference::HDR);
    } else {
        builder.setLuminanceReference(LuminanceReference::SDR);
    }

    // Alpha
    if (image->alphaPlane != nullptr) {
        builder.setAlphaMode(
            alphaPremultiplied ? AlphaMode::Premultiplied : AlphaMode::Straight
        );
    } else {
        builder.setAlphaMode(AlphaMode::None);
    }

    // HDR metadata
    if (image->clli.maxCLL > 0) {
        builder.setMaxCLL(static_cast<float>(image->clli.maxCLL));
    }
    if (image->clli.maxPALL > 0) {
        builder.setMaxPALL(static_cast<float>(image->clli.maxPALL));
    }

    // Rendering intent (display-referred for decoded images)
    builder.setImageDomain(ImageDomain::DisplayReferred);

    return builder.build();
}

// ============================================================================
// Main decode function
// ============================================================================

DecodeResult decode(
    uintptr_t inputPtr,
    size_t inputSize,
    int targetBitDepth,
    int maxThreads)
{
    const uint8_t *avifData = reinterpret_cast<const uint8_t *>(inputPtr);
    DecodeResult result;
    result.dataPtr = 0;
    result.dataSize = 0;

    avifDecoder *decoder = avifDecoderCreate();
    if (!decoder)
    {
        result.error = "Failed to create decoder";
        return result;
    }

    decoder->maxThreads = maxThreads > 0 ? maxThreads : 1;
    decoder->codecChoice = AVIF_CODEC_CHOICE_AUTO;
    decoder->strictFlags = AVIF_STRICT_DISABLED;
    decoder->ignoreExif = AVIF_TRUE;
    decoder->ignoreXMP = AVIF_TRUE;

    avifResult res = avifDecoderSetIOMemory(decoder, avifData, inputSize);
    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("IO error: ") + avifResultToString(res);
        avifDecoderDestroy(decoder);
        return result;
    }

    res = avifDecoderParse(decoder);
    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("Parse error: ") + avifResultToString(res);
        avifDecoderDestroy(decoder);
        return result;
    }

    res = avifDecoderNextImage(decoder);
    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("Decode error: ") + avifResultToString(res);
        avifDecoderDestroy(decoder);
        return result;
    }

    avifImage *image = decoder->image;

    const uint8_t colorChannels = (image->yuvFormat == AVIF_PIXEL_FORMAT_YUV400) ? 1 : 3;
    const uint8_t alphaChannel = (image->alphaPlane != nullptr) ? 1 : 0;
    const uint32_t totalChannels = colorChannels + alphaChannel;

    // Convert to RGB(A)
    avifRGBImage rgb;
    avifRGBImageSetDefaults(&rgb, image);

    // Determine output bit depth
    int outputDepth = targetBitDepth > 0 ? targetBitDepth : image->depth;
    if (outputDepth < 8)
        outputDepth = 8;
    if (outputDepth > 16)
        outputDepth = 16;

    rgb.depth = outputDepth;
    rgb.format = (totalChannels == 4) ? AVIF_RGB_FORMAT_RGBA
               : (totalChannels == 3) ? AVIF_RGB_FORMAT_RGB
                                      : AVIF_RGB_FORMAT_GRAY;
    rgb.alphaPremultiplied = AVIF_FALSE;
    rgb.isFloat = AVIF_FALSE;

    avifRGBImageAllocatePixels(&rgb);

    res = avifImageYUVToRGB(image, &rgb);
    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("YUV to RGB error: ") + avifResultToString(res);
        avifRGBImageFreePixels(&rgb);
        avifDecoderDestroy(decoder);
        return result;
    }

    // Allocate output buffer (caller must free via Module._free)
    size_t dataSize = rgb.rowBytes * rgb.height;
    void *dataPtr = malloc(dataSize);
    if (!dataPtr)
    {
        result.error = "Failed to allocate output buffer";
        avifRGBImageFreePixels(&rgb);
        avifDecoderDestroy(decoder);
        return result;
    }

    std::memcpy(dataPtr, rgb.pixels, dataSize);
    result.dataPtr = reinterpret_cast<uintptr_t>(dataPtr);
    result.dataSize = dataSize;

    // Build descriptor
    result.descriptor = buildDescriptor(
        image,
        image->width,
        image->height,
        static_cast<uint32_t>(outputDepth),
        totalChannels,
        rgb.alphaPremultiplied == AVIF_TRUE
    );

    avifRGBImageFreePixels(&rgb);
    avifDecoderDestroy(decoder);
    return result;
}

// ============================================================================
// Get image info without full decode
// ============================================================================

ImageDescriptor getImageInfo(uintptr_t inputPtr, size_t inputSize)
{
    const uint8_t *avifData = reinterpret_cast<const uint8_t *>(inputPtr);

    avifDecoder *decoder = avifDecoderCreate();
    if (!decoder)
    {
        // Return minimal descriptor on error
        ImageDescriptorBuilder builder;
        builder.setGeometry(0, 0);
        builder.setChannels(ChannelModel::RGB, 3);
        builder.setNumeric(SampleType::Uint, DataType::Uint8, 8);
        return builder.build();
    }

    decoder->maxThreads = 1;
    decoder->strictFlags = AVIF_STRICT_DISABLED;
    decoder->ignoreExif = AVIF_TRUE;
    decoder->ignoreXMP = AVIF_TRUE;

    avifResult res = avifDecoderSetIOMemory(decoder, avifData, inputSize);
    if (res != AVIF_RESULT_OK)
    {
        avifDecoderDestroy(decoder);
        ImageDescriptorBuilder builder;
        builder.setGeometry(0, 0);
        builder.setChannels(ChannelModel::RGB, 3);
        builder.setNumeric(SampleType::Uint, DataType::Uint8, 8);
        return builder.build();
    }

    res = avifDecoderParse(decoder);
    if (res != AVIF_RESULT_OK)
    {
        avifDecoderDestroy(decoder);
        ImageDescriptorBuilder builder;
        builder.setGeometry(0, 0);
        builder.setChannels(ChannelModel::RGB, 3);
        builder.setNumeric(SampleType::Uint, DataType::Uint8, 8);
        return builder.build();
    }

    avifImage *image = decoder->image;

    const uint8_t colorChannels = (image->yuvFormat == AVIF_PIXEL_FORMAT_YUV400) ? 1 : 3;
    const uint8_t alphaChannel = (image->alphaPlane != nullptr) ? 1 : 0;
    const uint32_t totalChannels = colorChannels + alphaChannel;

    // Determine data type from source depth
    DataType dataType = (image->depth > 8) ? DataType::Uint16 : DataType::Uint8;

    ImageDescriptor descriptor = buildDescriptor(
        image,
        image->width,
        image->height,
        image->depth,
        totalChannels,
        false // no premultiplication info without decode
    );

    avifDecoderDestroy(decoder);
    return descriptor;
}

EMSCRIPTEN_BINDINGS(avif_decoder)
{
    // Decode result
    value_object<DecodeResult>("DecodeResult")
        .field("dataPtr", &DecodeResult::dataPtr)
        .field("dataSize", &DecodeResult::dataSize)
        .field("descriptor", &DecodeResult::descriptor)
        .field("error", &DecodeResult::error);

    function("decode", &decode);
    function("getImageInfo", &getImageInfo);

    // Export max threads constant
    constant("MAX_THREADS", MAX_THREADS);
}
