#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <avif/avif.h>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

using namespace emscripten;

struct EncodeOptions {
    int quality;            // 0-100 (100 = lossless-ish, 0 = worst)
    int qualityAlpha;       // 0-100
    int speed;              // 0-10 (10 = fastest)
    int maxThreads;
    std::string tune;       // "default", "ssim", "psnr"
    bool lossless;
    int chromaSubsampling;  // 444, 422, 420, 400
    int bitDepth;           // 8, 10, 12
    std::string colorSpace; // "srgb", "display-p3", "rec2020"
};

struct EncodeResult {
    std::vector<uint8_t> data;
    std::string error;
};

avifColorPrimaries getColorPrimaries(const std::string& cs) {
    if (cs == "display-p3" || cs == "p3") {
        return AVIF_COLOR_PRIMARIES_SMPTE432;
    } else if (cs == "rec2020" || cs == "bt2020") {
        return AVIF_COLOR_PRIMARIES_BT2020;
    }
    return AVIF_COLOR_PRIMARIES_BT709;
}

avifTransferCharacteristics getTransferCharacteristics(const std::string& cs, int bitDepth) {
    if (cs == "rec2020" && bitDepth > 8) {
        return AVIF_TRANSFER_CHARACTERISTICS_PQ;
    }
    return AVIF_TRANSFER_CHARACTERISTICS_SRGB;
}

EncodeResult encode(
    const std::string& pixels,
    uint32_t width,
    uint32_t height,
    bool hasAlpha,
    int inputBitDepth,
    const EncodeOptions& options
) {
    EncodeResult result;

    if (pixels.empty() || width == 0 || height == 0) {
        result.error = "Invalid input: empty pixels or zero dimensions";
        return result;
    }

    // Determine pixel format
    avifPixelFormat yuvFormat;
    switch (options.chromaSubsampling) {
        case 444: yuvFormat = AVIF_PIXEL_FORMAT_YUV444; break;
        case 422: yuvFormat = AVIF_PIXEL_FORMAT_YUV422; break;
        case 400: yuvFormat = AVIF_PIXEL_FORMAT_YUV400; break;
        default:  yuvFormat = AVIF_PIXEL_FORMAT_YUV420; break;
    }

    // Lossless requires 4:4:4
    if (options.lossless) {
        yuvFormat = AVIF_PIXEL_FORMAT_YUV444;
    }

    int outputDepth = options.bitDepth;
    if (outputDepth < 8) outputDepth = 8;
    if (outputDepth > 12) outputDepth = 12;

    avifImage* image = avifImageCreate(width, height, outputDepth, yuvFormat);
    if (!image) {
        result.error = "Failed to create image";
        return result;
    }

    // Set color properties
    image->colorPrimaries = getColorPrimaries(options.colorSpace);
    image->transferCharacteristics = getTransferCharacteristics(options.colorSpace, outputDepth);
    image->matrixCoefficients = AVIF_MATRIX_COEFFICIENTS_BT601;
    image->yuvRange = AVIF_RANGE_FULL;

    // Setup RGB input
    avifRGBImage rgb;
    avifRGBImageSetDefaults(&rgb, image);
    rgb.depth = inputBitDepth;
    rgb.format = hasAlpha ? AVIF_RGB_FORMAT_RGBA : AVIF_RGB_FORMAT_RGB;
    rgb.alphaPremultiplied = AVIF_FALSE;
    rgb.isFloat = AVIF_FALSE;

    int channels = hasAlpha ? 4 : 3;
    int bytesPerChannel = inputBitDepth > 8 ? 2 : 1;
    rgb.rowBytes = width * channels * bytesPerChannel;
    rgb.pixels = const_cast<uint8_t*>(reinterpret_cast<const uint8_t*>(pixels.data()));

    // Convert RGB to YUV
    avifResult res = avifImageRGBToYUV(image, &rgb);
    if (res != AVIF_RESULT_OK) {
        result.error = std::string("RGB to YUV error: ") + avifResultToString(res);
        avifImageDestroy(image);
        return result;
    }

    // Create encoder
    avifEncoder* encoder = avifEncoderCreate();
    if (!encoder) {
        result.error = "Failed to create encoder";
        avifImageDestroy(image);
        return result;
    }

    encoder->maxThreads = options.maxThreads > 0 ? options.maxThreads : 1;
    encoder->speed = options.speed;

    // Quality mapping: libavif uses 0-63 where 0 is best, 63 is worst
    // We use 0-100 where 100 is best
    int q = 63 - (options.quality * 63 / 100);
    int qAlpha = 63 - (options.qualityAlpha * 63 / 100);

    if (options.lossless) {
        encoder->quality = AVIF_QUALITY_LOSSLESS;
        encoder->qualityAlpha = AVIF_QUALITY_LOSSLESS;
    } else {
        encoder->quality = q;
        encoder->qualityAlpha = qAlpha;
    }

    // Tuning
    if (options.tune == "ssim") {
        encoder->autoTiling = AVIF_TRUE;
    }

    // Encode
    avifRWData output = AVIF_DATA_EMPTY;
    res = avifEncoderWrite(encoder, image, &output);

    if (res != AVIF_RESULT_OK) {
        result.error = std::string("Encode error: ") + avifResultToString(res);
    } else {
        result.data.assign(output.data, output.data + output.size);
    }

    avifRWDataFree(&output);
    avifEncoderDestroy(encoder);
    avifImageDestroy(image);

    return result;
}

EMSCRIPTEN_BINDINGS(avif_encoder) {
    value_object<EncodeOptions>("EncodeOptions")
        .field("quality", &EncodeOptions::quality)
        .field("qualityAlpha", &EncodeOptions::qualityAlpha)
        .field("speed", &EncodeOptions::speed)
        .field("maxThreads", &EncodeOptions::maxThreads)
        .field("tune", &EncodeOptions::tune)
        .field("lossless", &EncodeOptions::lossless)
        .field("chromaSubsampling", &EncodeOptions::chromaSubsampling)
        .field("bitDepth", &EncodeOptions::bitDepth)
        .field("colorSpace", &EncodeOptions::colorSpace);

    value_object<EncodeResult>("EncodeResult")
        .field("data", &EncodeResult::data)
        .field("error", &EncodeResult::error);

    register_vector<uint8_t>("Uint8Vector");

    function("encode", &encode);
}
