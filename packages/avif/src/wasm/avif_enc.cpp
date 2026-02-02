#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <emscripten.h>
#include <avif/avif.h>
#include <cstdint>
#include <cstring>
#include <string>

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
    int quality;      // 0-100 (100 = best quality)
    int qualityAlpha; // 0-100
    int speed;        // 0-10 (10 = fastest)
    std::string tune; // "default", "ssim", "psnr"
    bool lossless;
    int chromaSubsampling;        // 444, 422, 420, 400
    int bitDepth;                 // 8, 10, 12
    std::string colorSpace;       // "srgb", "display-p3", "rec2020"
    std::string transferFunction; // "srgb", "pq", "hlg", "linear"
    int maxThreads;               // Maximum threads to use
};

struct EncodeTimings
{
    double rgbToYuv;
    double encode;
    double total;
};

struct EncodeResult
{
    uintptr_t dataPtr; // Pointer to encoded data (caller must free)
    size_t dataSize;
    std::string error;
    EncodeTimings timings;
};

// ============================================================================
// Color space helpers
// ============================================================================

avifColorPrimaries getColorPrimaries(const std::string &cs)
{
    if (cs == "display-p3" || cs == "p3")
    {
        return AVIF_COLOR_PRIMARIES_SMPTE432; // Display P3
    }
    else if (cs == "rec2020" || cs == "bt2020")
    {
        return AVIF_COLOR_PRIMARIES_BT2020;
    }
    return AVIF_COLOR_PRIMARIES_BT709; // sRGB
}

avifTransferCharacteristics getTransferCharacteristics(const std::string &tf, const std::string &cs)
{
    if (tf == "pq")
    {
        return AVIF_TRANSFER_CHARACTERISTICS_PQ;
    }
    else if (tf == "hlg")
    {
        return AVIF_TRANSFER_CHARACTERISTICS_HLG;
    }
    else if (tf == "linear")
    {
        return AVIF_TRANSFER_CHARACTERISTICS_LINEAR;
    }
    // Default based on color space
    if (cs == "rec2020" || cs == "bt2020")
    {
        return AVIF_TRANSFER_CHARACTERISTICS_BT2020_10BIT;
    }
    return AVIF_TRANSFER_CHARACTERISTICS_SRGB;
}

avifMatrixCoefficients getMatrixCoefficients(const std::string &cs)
{
    if (cs == "rec2020" || cs == "bt2020")
    {
        return AVIF_MATRIX_COEFFICIENTS_BT2020_NCL;
    }
    else if (cs == "display-p3" || cs == "p3")
    {
        return AVIF_MATRIX_COEFFICIENTS_BT709; // P3 uses BT.709 matrix
    }
    return AVIF_MATRIX_COEFFICIENTS_BT709; // sRGB uses BT.709
}

// ============================================================================
// Main encode function
// ============================================================================

EncodeResult encode(
    uintptr_t pixelsPtr,
    size_t pixelsSize,
    uint32_t width,
    uint32_t height,
    uint32_t channels, // 3 (RGB) or 4 (RGBA)
    int inputBitDepth, // 8 or 16
    const EncodeOptions &options)
{
    double tStart = emscripten_get_now();
    EncodeResult result;
    result.dataPtr = 0;
    result.dataSize = 0;
    result.timings = {0, 0, 0};

    const uint8_t *pixels = reinterpret_cast<const uint8_t *>(pixelsPtr);

    if (pixels == nullptr || pixelsSize == 0 || width == 0 || height == 0)
    {
        result.error = "Invalid input: null pixels or zero dimensions";
        return result;
    }

    // Validate channels
    if (channels != 3 && channels != 4)
    {
        result.error = "Invalid channels: must be 3 (RGB) or 4 (RGBA)";
        return result;
    }

    // Validate input size
    int bytesPerChannel = inputBitDepth > 8 ? 2 : 1;
    size_t expectedSize = width * height * channels * bytesPerChannel;
    if (pixelsSize < expectedSize)
    {
        result.error = "Invalid input: pixel data too small";
        return result;
    }

    // Determine pixel format
    avifPixelFormat yuvFormat;
    switch (options.chromaSubsampling)
    {
    case 444:
        yuvFormat = AVIF_PIXEL_FORMAT_YUV444;
        break;
    case 422:
        yuvFormat = AVIF_PIXEL_FORMAT_YUV422;
        break;
    case 400:
        yuvFormat = AVIF_PIXEL_FORMAT_YUV400;
        break;
    default:
        yuvFormat = AVIF_PIXEL_FORMAT_YUV420;
        break;
    }

    // Lossless requires 4:4:4
    if (options.lossless)
    {
        yuvFormat = AVIF_PIXEL_FORMAT_YUV444;
    }

    int outputDepth = options.bitDepth;
    if (outputDepth < 8)
        outputDepth = 8;
    if (outputDepth > 12)
        outputDepth = 12;

    avifImage *image = avifImageCreate(width, height, outputDepth, yuvFormat);
    if (!image)
    {
        result.error = "Failed to create avifImage";
        return result;
    }

    // Set color properties based on options
    image->colorPrimaries = getColorPrimaries(options.colorSpace);
    image->transferCharacteristics = getTransferCharacteristics(options.transferFunction, options.colorSpace);
    image->matrixCoefficients = getMatrixCoefficients(options.colorSpace);
    image->yuvRange = AVIF_RANGE_FULL;

    // Setup RGB input
    avifRGBImage rgb;
    avifRGBImageSetDefaults(&rgb, image);
    rgb.depth = inputBitDepth;
    rgb.format = (channels == 4) ? AVIF_RGB_FORMAT_RGBA : AVIF_RGB_FORMAT_RGB;
    rgb.alphaPremultiplied = AVIF_FALSE;
    rgb.isFloat = AVIF_FALSE;
    rgb.rowBytes = width * channels * bytesPerChannel;
    rgb.pixels = const_cast<uint8_t *>(pixels);

    // Convert RGB to YUV
    double t0 = emscripten_get_now();
    avifResult res = avifImageRGBToYUV(image, &rgb);
    result.timings.rgbToYuv = emscripten_get_now() - t0;

    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("RGB to YUV error: ") + avifResultToString(res);
        avifImageDestroy(image);
        return result;
    }

    // Create encoder
    avifEncoder *encoder = avifEncoderCreate();
    if (!encoder)
    {
        result.error = "Failed to create encoder";
        avifImageDestroy(image);
        return result;
    }

    // Configure encoder
    encoder->maxThreads = options.maxThreads;
    encoder->speed = options.speed;

    if (options.lossless)
    {
        encoder->quality = AVIF_QUALITY_LOSSLESS;
        encoder->qualityAlpha = AVIF_QUALITY_LOSSLESS;
    }
    else
    {
        encoder->quality = options.quality;
        encoder->qualityAlpha = options.qualityAlpha;
    }

    // Tuning via codec-specific options
    if (options.tune == "ssim")
    {
        avifEncoderSetCodecSpecificOption(encoder, "tune", "ssim");
    }
    else if (options.tune == "psnr")
    {
        avifEncoderSetCodecSpecificOption(encoder, "tune", "psnr");
    }
    encoder->autoTiling = AVIF_TRUE;

    // Encode
    avifRWData output = AVIF_DATA_EMPTY;
    t0 = emscripten_get_now();
    res = avifEncoderWrite(encoder, image, &output);
    result.timings.encode = emscripten_get_now() - t0;

    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("Encode error: ") + avifResultToString(res);
        avifRWDataFree(&output);
        avifEncoderDestroy(encoder);
        avifImageDestroy(image);
        return result;
    }

    // Copy output to malloc'd buffer for JS to read
    uint8_t *outputBuffer = static_cast<uint8_t *>(malloc(output.size));
    if (!outputBuffer)
    {
        result.error = "Failed to allocate output buffer";
        avifRWDataFree(&output);
        avifEncoderDestroy(encoder);
        avifImageDestroy(image);
        return result;
    }

    std::memcpy(outputBuffer, output.data, output.size);
    result.dataPtr = reinterpret_cast<uintptr_t>(outputBuffer);
    result.dataSize = output.size;

    avifRWDataFree(&output);
    avifEncoderDestroy(encoder);
    avifImageDestroy(image);

    result.timings.total = emscripten_get_now() - tStart;
    return result;
}

// ============================================================================
// Emscripten bindings
// ============================================================================

EMSCRIPTEN_BINDINGS(avif_encoder)
{
    value_object<EncodeOptions>("EncodeOptions")
        .field("quality", &EncodeOptions::quality)
        .field("qualityAlpha", &EncodeOptions::qualityAlpha)
        .field("speed", &EncodeOptions::speed)
        .field("tune", &EncodeOptions::tune)
        .field("lossless", &EncodeOptions::lossless)
        .field("chromaSubsampling", &EncodeOptions::chromaSubsampling)
        .field("bitDepth", &EncodeOptions::bitDepth)
        .field("colorSpace", &EncodeOptions::colorSpace)
        .field("transferFunction", &EncodeOptions::transferFunction)
        .field("maxThreads", &EncodeOptions::maxThreads);

    value_object<EncodeTimings>("EncodeTimings")
        .field("rgbToYuv", &EncodeTimings::rgbToYuv)
        .field("encode", &EncodeTimings::encode)
        .field("total", &EncodeTimings::total);

    value_object<EncodeResult>("EncodeResult")
        .field("dataPtr", &EncodeResult::dataPtr)
        .field("dataSize", &EncodeResult::dataSize)
        .field("error", &EncodeResult::error)
        .field("timings", &EncodeResult::timings);

    function("encode", &encode);

    // Export max threads constant
    constant("MAX_THREADS", MAX_THREADS);
}
