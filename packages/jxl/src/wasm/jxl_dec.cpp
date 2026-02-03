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

using namespace emscripten;

// Max threads constant (defined via CMake for MT builds)
#ifndef MAX_THREADS
#define MAX_THREADS 1  // Single-threaded fallback
#endif

// ============================================================================
// Color space to string conversion functions
// ============================================================================

std::string colorPrimariesToString(JxlPrimaries primaries)
{
    switch (primaries)
    {
    case JXL_PRIMARIES_SRGB:
        return "bt709";
    case JXL_PRIMARIES_2100:
        return "bt2020";
    case JXL_PRIMARIES_P3:
        return "display-p3";
    default:
        return "unknown";
    }
}

std::string transferFunctionToString(JxlTransferFunction tf)
{
    switch (tf)
    {
    case JXL_TRANSFER_FUNCTION_SRGB:
        return "srgb";
    case JXL_TRANSFER_FUNCTION_LINEAR:
        return "linear";
    case JXL_TRANSFER_FUNCTION_PQ:
        return "pq";
    case JXL_TRANSFER_FUNCTION_HLG:
        return "hlg";
    case JXL_TRANSFER_FUNCTION_709:
        return "bt709";
    case JXL_TRANSFER_FUNCTION_DCI:
        return "dci";
    case JXL_TRANSFER_FUNCTION_GAMMA:
        return "gamma";
    default:
        return "unknown";
    }
}

bool isHDRTransfer(JxlTransferFunction tf)
{
    return tf == JXL_TRANSFER_FUNCTION_PQ || tf == JXL_TRANSFER_FUNCTION_HLG;
}

// ============================================================================
// Timing structure
// ============================================================================

struct DecodeTimings
{
    double setup;
    double basicInfo;
    double colorInfo;
    double decode;
    double memcpy;
    double total;
};

// ============================================================================
// Mastering Display Metadata
// ============================================================================

struct MasteringDisplay
{
    float redX;
    float redY;
    float greenX;
    float greenY;
    float blueX;
    float blueY;
    float whiteX;
    float whiteY;
    float minLuminance;
    float maxLuminance;
    bool present;
};

// ============================================================================
// Metadata structures
// ============================================================================

struct ImageMetadata
{
    std::string colorPrimaries;
    std::string transferFunction;
    std::string matrixCoefficients;  // JXL doesn't have this, always "identity" for RGB
    bool fullRange;

    uint32_t maxCLL;
    uint32_t maxPALL;

    MasteringDisplay masteringDisplay;

    uintptr_t iccProfilePtr;
    size_t iccProfileSize;

    bool isHDR;
    bool isAnimated;
    uint32_t frameCount;
};

// ============================================================================
// Result structures
// ============================================================================

struct DecodeResult
{
    uintptr_t dataPtr;
    size_t dataSize;
    uint32_t width;
    uint32_t height;
    uint32_t depth;
    uint32_t channels;
    std::string dataType;  // "uint8", "uint16", "float16", "float32"
    ImageMetadata metadata;
    std::string error;
    DecodeTimings timings;
};

struct ImageInfo
{
    uint32_t width;
    uint32_t height;
    uint32_t depth;
    uint32_t channels;
    ImageMetadata metadata;
};

// ============================================================================
// Main decode function using libjxl streaming API
// ============================================================================

DecodeResult decode(
    uintptr_t inputPtr,
    size_t inputSize,
    int maxThreads)
{
    double tStart = emscripten_get_now();
    DecodeTimings timings = {0};
    DecodeResult result = {};
    result.dataPtr = 0;
    result.dataSize = 0;
    result.depth = 8;

    const uint8_t *jxlData = reinterpret_cast<const uint8_t *>(inputPtr);

    double t0 = emscripten_get_now();

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

    timings.setup = emscripten_get_now() - t0;

    JxlBasicInfo info;
    JxlPixelFormat format;
    std::vector<uint8_t> pixels;
    std::vector<uint8_t> iccProfile;
    JxlColorEncoding colorEnc = {};
    bool hasColorEnc = false;

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
            t0 = emscripten_get_now();
            if (JxlDecoderGetBasicInfo(dec.get(), &info) != JXL_DEC_SUCCESS)
            {
                result.error = "Failed to get basic info";
                return result;
            }

            result.width = info.xsize;
            result.height = info.ysize;
            result.depth = info.bits_per_sample;
            result.channels = info.num_color_channels + (info.alpha_bits > 0 ? 1 : 0);
            result.metadata.isAnimated = info.have_animation;
            result.metadata.frameCount = result.metadata.isAnimated ? 0 : 1;  // Will be updated if animated

            timings.basicInfo = emscripten_get_now() - t0;
        }
        else if (status == JXL_DEC_COLOR_ENCODING)
        {
            t0 = emscripten_get_now();

            // Try to get ICC profile size
            size_t iccSize = 0;
            if (JxlDecoderGetICCProfileSize(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA, &iccSize) == JXL_DEC_SUCCESS && iccSize > 0)
            {
                iccProfile.resize(iccSize);
                if (JxlDecoderGetColorAsICCProfile(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA,
                                                    iccProfile.data(), iccSize) != JXL_DEC_SUCCESS)
                {
                    iccProfile.clear();
                }
            }

            // Try to get color encoding
            if (JxlDecoderGetColorAsEncodedProfile(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA,
                                                    &colorEnc) == JXL_DEC_SUCCESS)
            {
                hasColorEnc = true;
            }

            timings.colorInfo = emscripten_get_now() - t0;
        }
        else if (status == JXL_DEC_NEED_IMAGE_OUT_BUFFER)
        {
            t0 = emscripten_get_now();

            // Determine output format - auto-detect float vs integer from file
            format.num_channels = result.channels;
            format.endianness = JXL_NATIVE_ENDIAN;
            format.align = 0;

            // Check if the image is in float format
            if (info.exponent_bits_per_sample > 0) {
                // Float format detected
                if (info.exponent_bits_per_sample == 5 && info.bits_per_sample == 16) {
                    // float16 (5-bit exponent, 16-bit total)
                    format.data_type = JXL_TYPE_FLOAT16;
                    result.depth = 16;
                    result.dataType = "float16";
                } else if (info.exponent_bits_per_sample == 8 && info.bits_per_sample == 32) {
                    // float32 (8-bit exponent, 32-bit total)
                    format.data_type = JXL_TYPE_FLOAT;
                    result.depth = 32;
                    result.dataType = "float32";
                } else {
                    DecodeResult errorResult;
                    errorResult.error = "Unsupported float format";
                    return errorResult;
                }
            } else {
                // Integer format
                int outDepth = static_cast<int>(info.bits_per_sample);
                if (outDepth < 8)
                    outDepth = 8;
                if (outDepth > 16)
                    outDepth = 16;

                format.data_type = (outDepth > 8) ? JXL_TYPE_UINT16 : JXL_TYPE_UINT8;
                result.depth = static_cast<uint32_t>(outDepth);
                result.dataType = (outDepth > 8) ? "uint16" : "uint8";
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
            timings.decode = emscripten_get_now() - t0;
            // Image decoded successfully, continue to get JXL_DEC_SUCCESS
        }
        else if (status == JXL_DEC_SUCCESS)
        {
            break;
        }
    }

    // Copy pixel data to malloc'd buffer (caller must free via Module._free)
    t0 = emscripten_get_now();
    void *dataPtr = malloc(pixels.size());
    if (!dataPtr)
    {
        result.error = "Failed to allocate output buffer";
        return result;
    }
    std::memcpy(dataPtr, pixels.data(), pixels.size());
    result.dataPtr = reinterpret_cast<uintptr_t>(dataPtr);
    result.dataSize = pixels.size();
    timings.memcpy = emscripten_get_now() - t0;

    // Fill metadata
    if (hasColorEnc)
    {
        result.metadata.colorPrimaries = colorPrimariesToString(colorEnc.primaries);
        result.metadata.transferFunction = transferFunctionToString(colorEnc.transfer_function);
    }
    else
    {
        result.metadata.colorPrimaries = "unknown";
        result.metadata.transferFunction = "unknown";
    }
    result.metadata.matrixCoefficients = "identity";  // JXL decodes to RGB
    result.metadata.fullRange = true;  // JXL always full range for RGB output

    // Copy ICC profile to malloc'd buffer
    if (!iccProfile.empty())
    {
        uint8_t *iccPtr = static_cast<uint8_t *>(malloc(iccProfile.size()));
        if (iccPtr)
        {
            std::memcpy(iccPtr, iccProfile.data(), iccProfile.size());
            result.metadata.iccProfilePtr = reinterpret_cast<uintptr_t>(iccPtr);
            result.metadata.iccProfileSize = iccProfile.size();
        }
    }
    else
    {
        result.metadata.iccProfilePtr = 0;
        result.metadata.iccProfileSize = 0;
    }

    // HDR detection
    result.metadata.isHDR = (hasColorEnc && isHDRTransfer(colorEnc.transfer_function)) ||
                            result.depth > 8;

    // Content light level (JXL may not have this)
    result.metadata.maxCLL = 0;
    result.metadata.maxPALL = 0;
    result.metadata.masteringDisplay.present = false;

    timings.total = emscripten_get_now() - tStart;
    result.timings = timings;

    return result;
}

// ============================================================================
// Get image info without full decode
// ============================================================================

ImageInfo getImageInfo(uintptr_t inputPtr, size_t inputSize)
{
    ImageInfo info = {};
    const uint8_t *jxlData = reinterpret_cast<const uint8_t *>(inputPtr);

    auto dec = JxlDecoderMake(nullptr);
    if (!dec)
        return info;

    if (JxlDecoderSubscribeEvents(dec.get(),
                                   JXL_DEC_BASIC_INFO | JXL_DEC_COLOR_ENCODING) != JXL_DEC_SUCCESS)
    {
        return info;
    }

    JxlDecoderSetInput(dec.get(), jxlData, inputSize);
    JxlDecoderCloseInput(dec.get());

    JxlBasicInfo basicInfo;
    JxlColorEncoding colorEnc = {};
    bool hasColorEnc = false;
    std::vector<uint8_t> iccProfile;

    for (;;)
    {
        JxlDecoderStatus status = JxlDecoderProcessInput(dec.get());

        if (status == JXL_DEC_ERROR || status == JXL_DEC_NEED_MORE_INPUT)
        {
            return info;
        }
        else if (status == JXL_DEC_BASIC_INFO)
        {
            if (JxlDecoderGetBasicInfo(dec.get(), &basicInfo) != JXL_DEC_SUCCESS)
            {
                return info;
            }

            info.width = basicInfo.xsize;
            info.height = basicInfo.ysize;
            info.depth = basicInfo.bits_per_sample;
            info.channels = basicInfo.num_color_channels + (basicInfo.alpha_bits > 0 ? 1 : 0);
            info.metadata.isAnimated = basicInfo.have_animation;
            info.metadata.frameCount = info.metadata.isAnimated ? 0 : 1;
        }
        else if (status == JXL_DEC_COLOR_ENCODING)
        {
            // Get ICC profile
            size_t iccSize = 0;
            if (JxlDecoderGetICCProfileSize(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA, &iccSize) == JXL_DEC_SUCCESS && iccSize > 0)
            {
                iccProfile.resize(iccSize);
                if (JxlDecoderGetColorAsICCProfile(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA,
                                                    iccProfile.data(), iccSize) == JXL_DEC_SUCCESS)
                {
                    uint8_t *iccPtr = static_cast<uint8_t *>(malloc(iccProfile.size()));
                    if (iccPtr)
                    {
                        std::memcpy(iccPtr, iccProfile.data(), iccProfile.size());
                        info.metadata.iccProfilePtr = reinterpret_cast<uintptr_t>(iccPtr);
                        info.metadata.iccProfileSize = iccProfile.size();
                    }
                }
            }

            // Get color encoding
            if (JxlDecoderGetColorAsEncodedProfile(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA,
                                                    &colorEnc) == JXL_DEC_SUCCESS)
            {
                hasColorEnc = true;
            }

            // We have all the info we need
            break;
        }
        else if (status == JXL_DEC_SUCCESS)
        {
            break;
        }
    }

    // Fill metadata
    if (hasColorEnc)
    {
        info.metadata.colorPrimaries = colorPrimariesToString(colorEnc.primaries);
        info.metadata.transferFunction = transferFunctionToString(colorEnc.transfer_function);
    }
    else
    {
        info.metadata.colorPrimaries = "unknown";
        info.metadata.transferFunction = "unknown";
    }
    info.metadata.matrixCoefficients = "identity";
    info.metadata.fullRange = true;
    info.metadata.isHDR = (hasColorEnc && isHDRTransfer(colorEnc.transfer_function)) ||
                          info.depth > 8;
    info.metadata.maxCLL = 0;
    info.metadata.maxPALL = 0;
    info.metadata.masteringDisplay.present = false;

    return info;
}

// ============================================================================
// Emscripten bindings
// ============================================================================

EMSCRIPTEN_BINDINGS(jxl_decoder)
{
    value_object<MasteringDisplay>("MasteringDisplay")
        .field("redX", &MasteringDisplay::redX)
        .field("redY", &MasteringDisplay::redY)
        .field("greenX", &MasteringDisplay::greenX)
        .field("greenY", &MasteringDisplay::greenY)
        .field("blueX", &MasteringDisplay::blueX)
        .field("blueY", &MasteringDisplay::blueY)
        .field("whiteX", &MasteringDisplay::whiteX)
        .field("whiteY", &MasteringDisplay::whiteY)
        .field("minLuminance", &MasteringDisplay::minLuminance)
        .field("maxLuminance", &MasteringDisplay::maxLuminance)
        .field("present", &MasteringDisplay::present);

    value_object<ImageMetadata>("ImageMetadata")
        .field("colorPrimaries", &ImageMetadata::colorPrimaries)
        .field("transferFunction", &ImageMetadata::transferFunction)
        .field("matrixCoefficients", &ImageMetadata::matrixCoefficients)
        .field("fullRange", &ImageMetadata::fullRange)
        .field("maxCLL", &ImageMetadata::maxCLL)
        .field("maxPALL", &ImageMetadata::maxPALL)
        .field("masteringDisplay", &ImageMetadata::masteringDisplay)
        .field("iccProfilePtr", &ImageMetadata::iccProfilePtr)
        .field("iccProfileSize", &ImageMetadata::iccProfileSize)
        .field("isHDR", &ImageMetadata::isHDR)
        .field("isAnimated", &ImageMetadata::isAnimated)
        .field("frameCount", &ImageMetadata::frameCount);

    value_object<DecodeResult>("DecodeResult")
        .field("dataPtr", &DecodeResult::dataPtr)
        .field("dataSize", &DecodeResult::dataSize)
        .field("width", &DecodeResult::width)
        .field("height", &DecodeResult::height)
        .field("depth", &DecodeResult::depth)
        .field("channels", &DecodeResult::channels)
        .field("dataType", &DecodeResult::dataType)
        .field("metadata", &DecodeResult::metadata)
        .field("timings", &DecodeResult::timings)
        .field("error", &DecodeResult::error);

    value_object<ImageInfo>("ImageInfo")
        .field("width", &ImageInfo::width)
        .field("height", &ImageInfo::height)
        .field("depth", &ImageInfo::depth)
        .field("channels", &ImageInfo::channels)
        .field("metadata", &ImageInfo::metadata);

    value_object<DecodeTimings>("DecodeTimings")
        .field("setup", &DecodeTimings::setup)
        .field("basicInfo", &DecodeTimings::basicInfo)
        .field("colorInfo", &DecodeTimings::colorInfo)
        .field("decode", &DecodeTimings::decode)
        .field("memcpy", &DecodeTimings::memcpy)
        .field("total", &DecodeTimings::total);

    function("decode", &decode);
    function("getImageInfo", &getImageInfo);

    constant("MAX_THREADS", MAX_THREADS);
}
