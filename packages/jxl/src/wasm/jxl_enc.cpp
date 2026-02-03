#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <emscripten.h>
#include <jxl/encode.h>
#include <jxl/encode_cxx.h>
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
// Encode Options
// ============================================================================

struct EncodeOptions
{
    float quality;            // 0-100 (100 = best quality), maps to distance
    int effort;               // 1-10 (10 = slowest/best compression)
    bool lossless;
    int bitDepth;             // 8, 10, 12, 16, 32
    std::string colorSpace;   // "srgb", "display-p3", "rec2020"
    std::string transferFunction; // "srgb", "pq", "hlg", "linear"
    bool progressive;         // Enable progressive decoding support
    int maxThreads;
    std::string dataType;     // "uint8", "uint16", "float16", "float32"
};

struct EncodeTimings
{
    double setup;
    double encode;
    double output;
    double total;
};

struct EncodeResult
{
    uintptr_t dataPtr;
    size_t dataSize;
    std::string error;
    EncodeTimings timings;
};

// ============================================================================
// Quality to distance conversion
// ============================================================================

// JXL uses "distance" where:
// - 0.0 = mathematically lossless (only if lossless flag set)
// - 1.0 = visually lossless (recommended default)
// - 15.0+ = very lossy
// We map quality 0-100 to distance 15.0-0.0
float qualityToDistance(float quality, bool lossless)
{
    if (lossless)
        return 0.0f;

    // Clamp quality to valid range
    if (quality < 0.0f) quality = 0.0f;
    if (quality > 100.0f) quality = 100.0f;

    // Map: quality 100 -> distance 0.0 (best)
    //      quality 0   -> distance 15.0 (worst)
    // Using butteraugli distance scale
    return (100.0f - quality) * 0.15f;
}

// ============================================================================
// Color space helpers
// ============================================================================

void setColorEncoding(JxlColorEncoding &enc, const std::string &colorSpace, const std::string &transferFunction)
{
    // Start with sRGB defaults
    JxlColorEncodingSetToSRGB(&enc, JXL_FALSE);

    // Set primaries
    if (colorSpace == "display-p3" || colorSpace == "p3")
    {
        enc.primaries = JXL_PRIMARIES_P3;
        enc.white_point = JXL_WHITE_POINT_D65;
    }
    else if (colorSpace == "rec2020" || colorSpace == "bt2020")
    {
        enc.primaries = JXL_PRIMARIES_2100;
        enc.white_point = JXL_WHITE_POINT_D65;
    }
    // else: keep sRGB primaries

    // Set transfer function
    if (transferFunction == "pq")
    {
        enc.transfer_function = JXL_TRANSFER_FUNCTION_PQ;
    }
    else if (transferFunction == "hlg")
    {
        enc.transfer_function = JXL_TRANSFER_FUNCTION_HLG;
    }
    else if (transferFunction == "linear")
    {
        enc.transfer_function = JXL_TRANSFER_FUNCTION_LINEAR;
    }
    // else: keep sRGB transfer function
}

// ============================================================================
// Main encode function
// ============================================================================

EncodeResult encode(
    uintptr_t pixelsPtr,
    size_t pixelsSize,
    uint32_t width,
    uint32_t height,
    uint32_t channels,
    int inputBitDepth,
    const EncodeOptions &options)
{
    double tStart = emscripten_get_now();
    EncodeResult result = {};
    result.dataPtr = 0;
    result.dataSize = 0;

    const uint8_t *pixels = reinterpret_cast<const uint8_t *>(pixelsPtr);

    if (pixels == nullptr || pixelsSize == 0 || width == 0 || height == 0)
    {
        result.error = "Invalid input: null pixels or zero dimensions";
        return result;
    }

    if (channels < 1 || channels > 4)
    {
        result.error = "Invalid channels: must be 1-4";
        return result;
    }

    // Determine bytes per sample based on data type
    int bytesPerSample;
    if (options.dataType == "float32") {
        bytesPerSample = 4;
    } else if (options.dataType == "float16" || options.dataType == "uint16") {
        bytesPerSample = 2;
    } else {
        bytesPerSample = 1; // uint8
    }

    // Validate input size
    size_t expectedSize = static_cast<size_t>(width) * height * channels * bytesPerSample;
    if (pixelsSize < expectedSize)
    {
        result.error = "Invalid input: pixel data too small";
        return result;
    }

    double t0 = emscripten_get_now();

    // Create encoder
    auto enc = JxlEncoderMake(nullptr);
    if (!enc)
    {
        result.error = "Failed to create JXL encoder";
        return result;
    }

    // Setup thread runner for MT builds
    JxlThreadParallelRunnerPtr runner = nullptr;
#if MAX_THREADS > 1
    if (options.maxThreads > 1)
    {
        runner = JxlThreadParallelRunnerMake(nullptr, static_cast<size_t>(options.maxThreads));
        if (JxlEncoderSetParallelRunner(enc.get(), JxlThreadParallelRunner, runner.get()) != JXL_ENC_SUCCESS)
        {
            result.error = "Failed to set parallel runner";
            return result;
        }
    }
#endif

    // Setup basic info
    JxlBasicInfo info;
    JxlEncoderInitBasicInfo(&info);
    info.xsize = width;
    info.ysize = height;

    // Determine output format based on dataType
    if (options.dataType == "float32") {
        info.bits_per_sample = 32;
        info.exponent_bits_per_sample = 8;  // float32: 8-bit exponent
    } else if (options.dataType == "float16") {
        info.bits_per_sample = 16;
        info.exponent_bits_per_sample = 5;  // float16: 5-bit exponent
    } else {
        // Integer formats (uint8, uint16)
        int outputDepth = options.bitDepth > 0 ? options.bitDepth : inputBitDepth;
        if (outputDepth < 8) outputDepth = 8;
        if (outputDepth > 16) outputDepth = 16;
        info.bits_per_sample = static_cast<uint32_t>(outputDepth);
        info.exponent_bits_per_sample = 0;  // Integer samples
    }
    info.num_color_channels = (channels >= 3) ? 3 : 1;
    info.alpha_bits = (channels == 4 || channels == 2) ? info.bits_per_sample : 0;
    // For float formats, alpha also needs exponent bits
    info.alpha_exponent_bits = (info.alpha_bits > 0) ? info.exponent_bits_per_sample : 0;
    info.num_extra_channels = (info.alpha_bits > 0) ? 1 : 0;
    info.uses_original_profile = JXL_FALSE;

    if (JxlEncoderSetBasicInfo(enc.get(), &info) != JXL_ENC_SUCCESS)
    {
        result.error = "Failed to set basic info";
        return result;
    }

    // Setup color encoding
    JxlColorEncoding colorEnc;
    setColorEncoding(colorEnc, options.colorSpace, options.transferFunction);

    if (JxlEncoderSetColorEncoding(enc.get(), &colorEnc) != JXL_ENC_SUCCESS)
    {
        result.error = "Failed to set color encoding";
        return result;
    }

    // Get frame settings
    JxlEncoderFrameSettings *frameSettings = JxlEncoderFrameSettingsCreate(enc.get(), nullptr);
    if (!frameSettings)
    {
        result.error = "Failed to create frame settings";
        return result;
    }

    // Set encoding quality
    if (options.lossless)
    {
        JxlEncoderSetFrameLossless(frameSettings, JXL_TRUE);
        JxlEncoderSetFrameDistance(frameSettings, 0.0f);
    }
    else
    {
        float distance = qualityToDistance(options.quality, false);
        JxlEncoderSetFrameDistance(frameSettings, distance);
    }

    // Set effort (1-10)
    int effort = options.effort;
    if (effort < 1) effort = 1;
    if (effort > 10) effort = 10;
    JxlEncoderFrameSettingsSetOption(frameSettings, JXL_ENC_FRAME_SETTING_EFFORT, effort);

    // Progressive decoding support
    if (options.progressive)
    {
        JxlEncoderFrameSettingsSetOption(frameSettings, JXL_ENC_FRAME_SETTING_RESPONSIVE, 1);
    }

    result.timings.setup = emscripten_get_now() - t0;

    // Setup pixel format
    JxlPixelFormat format;
    format.num_channels = channels;

    // Determine JXL data type based on input dataType
    if (options.dataType == "float32") {
        format.data_type = JXL_TYPE_FLOAT;
    } else if (options.dataType == "float16") {
        format.data_type = JXL_TYPE_FLOAT16;
    } else if (options.dataType == "uint16") {
        format.data_type = JXL_TYPE_UINT16;
    } else {
        format.data_type = JXL_TYPE_UINT8;
    }

    format.endianness = JXL_NATIVE_ENDIAN;
    format.align = 0;

    // Add image frame
    t0 = emscripten_get_now();
    if (JxlEncoderAddImageFrame(frameSettings, &format, pixels, pixelsSize) != JXL_ENC_SUCCESS)
    {
        result.error = "Failed to add image frame";
        return result;
    }

    // Close input (signal no more frames)
    JxlEncoderCloseInput(enc.get());

    result.timings.encode = emscripten_get_now() - t0;

    // Process encoder output
    t0 = emscripten_get_now();
    std::vector<uint8_t> output;
    output.resize(64 * 1024);  // Start with 64KB

    uint8_t *nextOut = output.data();
    size_t availOut = output.size();

    JxlEncoderStatus status;
    while ((status = JxlEncoderProcessOutput(enc.get(), &nextOut, &availOut)) == JXL_ENC_NEED_MORE_OUTPUT)
    {
        size_t offset = nextOut - output.data();
        output.resize(output.size() * 2);
        nextOut = output.data() + offset;
        availOut = output.size() - offset;
    }

    if (status != JXL_ENC_SUCCESS)
    {
        result.error = "Encoding failed";
        return result;
    }

    // Calculate actual output size
    size_t outputSize = nextOut - output.data();

    // Copy to malloc'd buffer for JS to read
    uint8_t *outputPtr = static_cast<uint8_t *>(malloc(outputSize));
    if (!outputPtr)
    {
        result.error = "Failed to allocate output buffer";
        return result;
    }

    std::memcpy(outputPtr, output.data(), outputSize);
    result.dataPtr = reinterpret_cast<uintptr_t>(outputPtr);
    result.dataSize = outputSize;

    result.timings.output = emscripten_get_now() - t0;
    result.timings.total = emscripten_get_now() - tStart;

    return result;
}

// ============================================================================
// Emscripten bindings
// ============================================================================

EMSCRIPTEN_BINDINGS(jxl_encoder)
{
    value_object<EncodeOptions>("EncodeOptions")
        .field("quality", &EncodeOptions::quality)
        .field("effort", &EncodeOptions::effort)
        .field("lossless", &EncodeOptions::lossless)
        .field("bitDepth", &EncodeOptions::bitDepth)
        .field("colorSpace", &EncodeOptions::colorSpace)
        .field("transferFunction", &EncodeOptions::transferFunction)
        .field("progressive", &EncodeOptions::progressive)
        .field("maxThreads", &EncodeOptions::maxThreads)
        .field("dataType", &EncodeOptions::dataType);

    value_object<EncodeTimings>("EncodeTimings")
        .field("setup", &EncodeTimings::setup)
        .field("encode", &EncodeTimings::encode)
        .field("output", &EncodeTimings::output)
        .field("total", &EncodeTimings::total);

    value_object<EncodeResult>("EncodeResult")
        .field("dataPtr", &EncodeResult::dataPtr)
        .field("dataSize", &EncodeResult::dataSize)
        .field("error", &EncodeResult::error)
        .field("timings", &EncodeResult::timings);

    function("encode", &encode);

    constant("MAX_THREADS", MAX_THREADS);
}
