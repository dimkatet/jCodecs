#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <emscripten.h>
#include <jxl/decode.h>
#include <jxl/decode_cxx.h>
#include <jxl/thread_parallel_runner.h>
#include <jxl/thread_parallel_runner_cxx.h>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

#include "descriptor.hpp"

using namespace emscripten;
using namespace jcodecs;

// Max threads constant (defined via CMake for MT builds)
#ifndef MAX_THREADS
#define MAX_THREADS 1  // Single-threaded fallback
#endif

// ============================================================================
// JXL → jcodecs enum mapping
// ============================================================================

std::optional<ColorPrimaries> mapJxlColorPrimaries(JxlPrimaries primaries)
{
    switch (primaries)
    {
    case JXL_PRIMARIES_SRGB: return ColorPrimaries::BT709;
    case JXL_PRIMARIES_P3:   return ColorPrimaries::DisplayP3;
    case JXL_PRIMARIES_2100: return ColorPrimaries::BT2020;
    default:                 return std::nullopt;
    }
}

std::optional<TransferFunction> mapJxlTransferFunction(JxlTransferFunction tf)
{
    switch (tf)
    {
    case JXL_TRANSFER_FUNCTION_709:    return TransferFunction::BT709;
    case JXL_TRANSFER_FUNCTION_LINEAR: return TransferFunction::Linear;
    case JXL_TRANSFER_FUNCTION_SRGB:   return TransferFunction::SRGB;
    case JXL_TRANSFER_FUNCTION_PQ:     return TransferFunction::PQ;
    case JXL_TRANSFER_FUNCTION_DCI:    return TransferFunction::DCI;
    case JXL_TRANSFER_FUNCTION_HLG:    return TransferFunction::HLG;
    case JXL_TRANSFER_FUNCTION_GAMMA:  return TransferFunction::Gamma;
    default:                           return std::nullopt;
    }
}

bool isHDRTransfer(JxlTransferFunction tf)
{
    return tf == JXL_TRANSFER_FUNCTION_PQ || tf == JXL_TRANSFER_FUNCTION_HLG;
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
// Build ImageDescriptor from decoded JXL info
// ============================================================================

ImageDescriptor buildDescriptor(
    const JxlBasicInfo& info,
    const JxlColorEncoding* colorEnc,
    bool hasColorEnc,
    uint32_t outputDepth,
    JxlDataType outputJxlDataType)
{
    ImageDescriptorBuilder builder;

    uint32_t channels = info.num_color_channels + (info.alpha_bits > 0 ? 1 : 0);

    // Geometry
    builder.setGeometry(info.xsize, info.ysize);

    // Channels
    ChannelModel model;
    if (channels == 1)      model = ChannelModel::Gray;
    else if (channels == 2) model = ChannelModel::GrayA;
    else if (channels == 4) model = ChannelModel::RGBA;
    else                    model = ChannelModel::RGB;
    builder.setChannels(model, channels);

    // Numeric
    SampleType sampleType;
    DataType dataType;
    switch (outputJxlDataType)
    {
    case JXL_TYPE_FLOAT:
        sampleType = SampleType::Float;
        dataType   = DataType::Float32;
        break;
    case JXL_TYPE_FLOAT16:
        sampleType = SampleType::Float;
        dataType   = DataType::Float16;
        break;
    case JXL_TYPE_UINT16:
        sampleType = SampleType::Uint;
        dataType   = DataType::Uint16;
        break;
    default: // JXL_TYPE_UINT8
        sampleType = SampleType::Uint;
        dataType   = DataType::Uint8;
        break;
    }
    builder.setNumeric(sampleType, dataType, outputDepth);

    // JXL always outputs full-range RGB
    builder.setQuantization(QuantizationRange::full());

    // Interleaved layout
    builder.setSampleLayout(SampleLayout::Interleaved);

    // Color and transfer info
    if (hasColorEnc)
    {
        auto primaries = mapJxlColorPrimaries(colorEnc->primaries);
        if (primaries) builder.setColorPrimaries(*primaries);
        builder.setWhitePoint(WhitePoint::D65);

        // JXL decodes to RGB → identity matrix
        builder.setMatrixCoefficients(MatrixCoefficients::Identity);

        auto tf = mapJxlTransferFunction(colorEnc->transfer_function);
        if (tf) builder.setTransferFunction(*tf);

        bool hdr = isHDRTransfer(colorEnc->transfer_function);
        builder.setLuminanceReference(hdr ? LuminanceReference::HDR : LuminanceReference::SDR);
    }
    else
    {
        builder.setMatrixCoefficients(MatrixCoefficients::Identity);
    }

    // Alpha
    if (info.alpha_bits > 0)
        builder.setAlphaMode(AlphaMode::Straight);
    else
        builder.setAlphaMode(AlphaMode::None);

    // Domain
    builder.setImageDomain(ImageDomain::DisplayReferred);

    return builder.build();
}

// ============================================================================
// Main decode function using libjxl streaming API
// ============================================================================

DecodeResult decode(
    uintptr_t inputPtr,
    size_t inputSize,
    int targetBitDepth,
    int maxThreads)
{
    DecodeResult result = {};
    result.dataPtr = 0;
    result.dataSize = 0;

    const uint8_t* jxlData = reinterpret_cast<const uint8_t*>(inputPtr);

    // Create decoder
    auto dec = JxlDecoderMake(nullptr);
    if (!dec)
    {
        result.error = "Failed to create JXL decoder";
        return result;
    }

    // Setup thread runner for MT builds
    JxlThreadParallelRunnerPtr runner = nullptr;
#if MAX_THREADS > 1
    if (maxThreads > 1)
    {
        runner = JxlThreadParallelRunnerMake(nullptr, static_cast<size_t>(maxThreads));
        if (JxlDecoderSetParallelRunner(dec.get(), JxlThreadParallelRunner, runner.get()) != JXL_DEC_SUCCESS)
        {
            result.error = "Failed to set parallel runner";
            return result;
        }
    }
#endif

    // Subscribe to events
    if (JxlDecoderSubscribeEvents(dec.get(),
                                   JXL_DEC_BASIC_INFO |
                                       JXL_DEC_COLOR_ENCODING |
                                       JXL_DEC_FULL_IMAGE) != JXL_DEC_SUCCESS)
    {
        result.error = "Failed to subscribe to events";
        return result;
    }

    // Set input
    JxlDecoderSetInput(dec.get(), jxlData, inputSize);
    JxlDecoderCloseInput(dec.get());

    JxlBasicInfo info = {};
    JxlPixelFormat format = {};
    std::vector<uint8_t> pixels;
    JxlColorEncoding colorEnc = {};
    bool hasColorEnc = false;
    uint32_t outputDepth = 8;
    JxlDataType outputJxlDataType = JXL_TYPE_UINT8;

    // Process decoder events
    for (;;)
    {
        JxlDecoderStatus status = JxlDecoderProcessInput(dec.get());

        if (status == JXL_DEC_ERROR)
        {
            result.error = "Decoder error";
            return result;
        }
        else if (status == JXL_DEC_NEED_MORE_INPUT)
        {
            result.error = "Incomplete input data";
            return result;
        }
        else if (status == JXL_DEC_BASIC_INFO)
        {
            if (JxlDecoderGetBasicInfo(dec.get(), &info) != JXL_DEC_SUCCESS)
            {
                result.error = "Failed to get basic info";
                return result;
            }
        }
        else if (status == JXL_DEC_COLOR_ENCODING)
        {
            // Try to get color encoding as CICP
            if (JxlDecoderGetColorAsEncodedProfile(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA,
                                                    &colorEnc) == JXL_DEC_SUCCESS)
            {
                hasColorEnc = true;
            }
        }
        else if (status == JXL_DEC_NEED_IMAGE_OUT_BUFFER)
        {
            // Determine output format
            format.num_channels = info.num_color_channels + (info.alpha_bits > 0 ? 1 : 0);
            format.endianness = JXL_NATIVE_ENDIAN;
            format.align = 0;

            if (targetBitDepth > 0)
            {
                // Explicit depth requested — override file format
                if (targetBitDepth <= 8)
                {
                    format.data_type   = JXL_TYPE_UINT8;
                    outputDepth        = 8;
                    outputJxlDataType  = JXL_TYPE_UINT8;
                }
                else
                {
                    format.data_type   = JXL_TYPE_UINT16;
                    outputDepth        = static_cast<uint32_t>(targetBitDepth);
                    outputJxlDataType  = JXL_TYPE_UINT16;
                }
            }
            else
            {
                // Auto-detect from file
                if (info.exponent_bits_per_sample > 0)
                {
                    // Float format
                    if (info.exponent_bits_per_sample == 5 && info.bits_per_sample == 16)
                    {
                        format.data_type  = JXL_TYPE_FLOAT16;
                        outputDepth       = 16;
                        outputJxlDataType = JXL_TYPE_FLOAT16;
                    }
                    else if (info.exponent_bits_per_sample == 8 && info.bits_per_sample == 32)
                    {
                        format.data_type  = JXL_TYPE_FLOAT;
                        outputDepth       = 32;
                        outputJxlDataType = JXL_TYPE_FLOAT;
                    }
                    else
                    {
                        result.error = "Unsupported float format";
                        return result;
                    }
                }
                else
                {
                    // Integer format — use source bit depth
                    int outDepth = static_cast<int>(info.bits_per_sample);
                    if (outDepth < 8)  outDepth = 8;
                    if (outDepth > 16) outDepth = 16;

                    format.data_type  = (outDepth > 8) ? JXL_TYPE_UINT16 : JXL_TYPE_UINT8;
                    outputDepth       = static_cast<uint32_t>(outDepth);
                    outputJxlDataType = format.data_type;
                }
            }

            // Get required buffer size
            size_t bufferSize;
            if (JxlDecoderImageOutBufferSize(dec.get(), &format, &bufferSize) != JXL_DEC_SUCCESS)
            {
                result.error = "Failed to get output buffer size";
                return result;
            }

            pixels.resize(bufferSize);
            if (JxlDecoderSetImageOutBuffer(dec.get(), &format, pixels.data(), bufferSize) != JXL_DEC_SUCCESS)
            {
                result.error = "Failed to set output buffer";
                return result;
            }
        }
        else if (status == JXL_DEC_FULL_IMAGE)
        {
            // Image decoded successfully, continue to JXL_DEC_SUCCESS
        }
        else if (status == JXL_DEC_SUCCESS)
        {
            break;
        }
    }

    // Copy pixel data to malloc'd buffer (caller must free via Module._free)
    void* dataPtr = malloc(pixels.size());
    if (!dataPtr)
    {
        result.error = "Failed to allocate output buffer";
        return result;
    }
    std::memcpy(dataPtr, pixels.data(), pixels.size());
    result.dataPtr  = reinterpret_cast<uintptr_t>(dataPtr);
    result.dataSize = pixels.size();

    // Build ImageDescriptor
    result.descriptor = buildDescriptor(info, hasColorEnc ? &colorEnc : nullptr, hasColorEnc,
                                         outputDepth, outputJxlDataType);

    return result;
}

// ============================================================================
// Get image info without full decode
// ============================================================================

ImageDescriptor getImageInfo(uintptr_t inputPtr, size_t inputSize)
{
    const uint8_t* jxlData = reinterpret_cast<const uint8_t*>(inputPtr);

    auto dec = JxlDecoderMake(nullptr);
    if (!dec)
    {
        ImageDescriptorBuilder builder;
        builder.setGeometry(0, 0);
        builder.setChannels(ChannelModel::RGB, 3);
        builder.setNumeric(SampleType::Uint, DataType::Uint8, 8);
        return builder.build();
    }

    if (JxlDecoderSubscribeEvents(dec.get(),
                                   JXL_DEC_BASIC_INFO | JXL_DEC_COLOR_ENCODING) != JXL_DEC_SUCCESS)
    {
        ImageDescriptorBuilder builder;
        builder.setGeometry(0, 0);
        builder.setChannels(ChannelModel::RGB, 3);
        builder.setNumeric(SampleType::Uint, DataType::Uint8, 8);
        return builder.build();
    }

    JxlDecoderSetInput(dec.get(), jxlData, inputSize);
    JxlDecoderCloseInput(dec.get());

    JxlBasicInfo basicInfo = {};
    JxlColorEncoding colorEnc = {};
    bool hasColorEnc = false;
    bool hasBasicInfo = false;

    for (;;)
    {
        JxlDecoderStatus status = JxlDecoderProcessInput(dec.get());

        if (status == JXL_DEC_ERROR || status == JXL_DEC_NEED_MORE_INPUT)
        {
            break;
        }
        else if (status == JXL_DEC_BASIC_INFO)
        {
            if (JxlDecoderGetBasicInfo(dec.get(), &basicInfo) == JXL_DEC_SUCCESS)
                hasBasicInfo = true;
        }
        else if (status == JXL_DEC_COLOR_ENCODING)
        {
            if (JxlDecoderGetColorAsEncodedProfile(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA,
                                                    &colorEnc) == JXL_DEC_SUCCESS)
            {
                hasColorEnc = true;
            }
            break; // Have all info we need
        }
        else if (status == JXL_DEC_SUCCESS)
        {
            break;
        }
    }

    if (!hasBasicInfo)
    {
        ImageDescriptorBuilder builder;
        builder.setGeometry(0, 0);
        builder.setChannels(ChannelModel::RGB, 3);
        builder.setNumeric(SampleType::Uint, DataType::Uint8, 8);
        return builder.build();
    }

    // Determine native data type from file (no targetBitDepth for info)
    uint32_t nativeDepth;
    JxlDataType nativeDataType;
    if (basicInfo.exponent_bits_per_sample > 0)
    {
        if (basicInfo.exponent_bits_per_sample == 5 && basicInfo.bits_per_sample == 16)
        {
            nativeDepth    = 16;
            nativeDataType = JXL_TYPE_FLOAT16;
        }
        else
        {
            nativeDepth    = 32;
            nativeDataType = JXL_TYPE_FLOAT;
        }
    }
    else
    {
        uint32_t d = basicInfo.bits_per_sample;
        if (d < 8)  d = 8;
        if (d > 16) d = 16;
        nativeDepth    = d;
        nativeDataType = (d > 8) ? JXL_TYPE_UINT16 : JXL_TYPE_UINT8;
    }

    return buildDescriptor(basicInfo, hasColorEnc ? &colorEnc : nullptr, hasColorEnc,
                           nativeDepth, nativeDataType);
}

// ============================================================================
// Emscripten bindings
// ============================================================================

EMSCRIPTEN_BINDINGS(jxl_decoder)
{
    value_object<DecodeResult>("DecodeResult")
        .field("dataPtr",    &DecodeResult::dataPtr)
        .field("dataSize",   &DecodeResult::dataSize)
        .field("descriptor", &DecodeResult::descriptor)
        .field("error",      &DecodeResult::error);

    function("decode",       &decode);
    function("getImageInfo", &getImageInfo);

    constant("MAX_THREADS", MAX_THREADS);
}
