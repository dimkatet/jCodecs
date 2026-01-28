#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <emscripten.h>
#include <avif/avif.h>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

using namespace emscripten;

// ============================================================================
// CICP to string conversion functions
// ============================================================================

std::string colorPrimariesToString(avifColorPrimaries primaries)
{
    switch (primaries)
    {
    case AVIF_COLOR_PRIMARIES_BT709:
        return "bt709";
    case AVIF_COLOR_PRIMARIES_BT470M:
        return "bt470m";
    case AVIF_COLOR_PRIMARIES_BT470BG:
        return "bt470bg";
    case AVIF_COLOR_PRIMARIES_BT601:
        return "bt601";
    case AVIF_COLOR_PRIMARIES_SMPTE240:
        return "smpte240";
    case AVIF_COLOR_PRIMARIES_GENERIC_FILM:
        return "generic-film";
    case AVIF_COLOR_PRIMARIES_BT2020:
        return "bt2020";
    case AVIF_COLOR_PRIMARIES_XYZ:
        return "xyz";
    case AVIF_COLOR_PRIMARIES_SMPTE431:
        return "dci-p3";
    case AVIF_COLOR_PRIMARIES_SMPTE432:
        return "display-p3";
    case AVIF_COLOR_PRIMARIES_EBU3213:
        return "ebu3213";
    default:
        return "unknown";
    }
}

std::string transferToString(avifTransferCharacteristics tc)
{
    switch (tc)
    {
    case AVIF_TRANSFER_CHARACTERISTICS_BT709:
        return "bt709";
    case AVIF_TRANSFER_CHARACTERISTICS_BT470M:
        return "bt470m";
    case AVIF_TRANSFER_CHARACTERISTICS_BT470BG:
        return "bt470bg";
    case AVIF_TRANSFER_CHARACTERISTICS_BT601:
        return "bt601";
    case AVIF_TRANSFER_CHARACTERISTICS_SMPTE240:
        return "smpte240";
    case AVIF_TRANSFER_CHARACTERISTICS_LINEAR:
        return "linear";
    case AVIF_TRANSFER_CHARACTERISTICS_LOG100:
        return "log100";
    case AVIF_TRANSFER_CHARACTERISTICS_LOG100_SQRT10:
        return "log100-sqrt10";
    case AVIF_TRANSFER_CHARACTERISTICS_IEC61966:
        return "iec61966";
    case AVIF_TRANSFER_CHARACTERISTICS_BT1361:
        return "bt1361";
    case AVIF_TRANSFER_CHARACTERISTICS_SRGB:
        return "srgb";
    case AVIF_TRANSFER_CHARACTERISTICS_BT2020_10BIT:
        return "bt2020-10bit";
    case AVIF_TRANSFER_CHARACTERISTICS_BT2020_12BIT:
        return "bt2020-12bit";
    case AVIF_TRANSFER_CHARACTERISTICS_PQ:
        return "pq";
    case AVIF_TRANSFER_CHARACTERISTICS_SMPTE428:
        return "smpte428";
    case AVIF_TRANSFER_CHARACTERISTICS_HLG:
        return "hlg";
    default:
        return "unknown";
    }
}

std::string matrixToString(avifMatrixCoefficients mc)
{
    switch (mc)
    {
    case AVIF_MATRIX_COEFFICIENTS_IDENTITY:
        return "identity";
    case AVIF_MATRIX_COEFFICIENTS_BT709:
        return "bt709";
    case AVIF_MATRIX_COEFFICIENTS_FCC:
        return "fcc";
    case AVIF_MATRIX_COEFFICIENTS_BT470BG:
        return "bt470bg";
    case AVIF_MATRIX_COEFFICIENTS_BT601:
        return "bt601";
    case AVIF_MATRIX_COEFFICIENTS_SMPTE240:
        return "smpte240";
    case AVIF_MATRIX_COEFFICIENTS_YCGCO:
        return "ycgco";
    case AVIF_MATRIX_COEFFICIENTS_BT2020_NCL:
        return "bt2020-ncl";
    case AVIF_MATRIX_COEFFICIENTS_BT2020_CL:
        return "bt2020-cl";
    case AVIF_MATRIX_COEFFICIENTS_SMPTE2085:
        return "smpte2085";
    case AVIF_MATRIX_COEFFICIENTS_CHROMA_DERIVED_NCL:
        return "chroma-derived-ncl";
    case AVIF_MATRIX_COEFFICIENTS_CHROMA_DERIVED_CL:
        return "chroma-derived-cl";
    case AVIF_MATRIX_COEFFICIENTS_ICTCP:
        return "ictcp";
    default:
        return "unknown";
    }
}

bool isHDRTransfer(avifTransferCharacteristics tc)
{
    return tc == AVIF_TRANSFER_CHARACTERISTICS_PQ ||
           tc == AVIF_TRANSFER_CHARACTERISTICS_HLG;
}

struct DecodeTimings
{
    double io;
    double parse;
    double decode;
    double yuvToRgb;
    double memcpy;
    double total;
};

// ============================================================================
// Mastering Display Metadata (SMPTE ST 2086)
// ============================================================================

struct MasteringDisplay
{
    // Chromaticity coordinates (CIE 1931 xy)
    float redX;
    float redY;
    float greenX;
    float greenY;
    float blueX;
    float blueY;
    float whiteX;
    float whiteY;
    // Luminance in nits
    float minLuminance;
    float maxLuminance;
    bool present;
};

// ============================================================================
// Metadata structures
// ============================================================================

struct ImageMetadata
{
    // CICP (as readable strings)
    std::string colorPrimaries;
    std::string transferFunction;
    std::string matrixCoefficients;
    bool fullRange;

    // Content light level
    uint32_t maxCLL;  // nits
    uint32_t maxPALL; // nits

    // Mastering display
    MasteringDisplay masteringDisplay;

    // ICC profile (pointer to malloc'd buffer, caller must free via Module._free)
    uintptr_t iccProfilePtr;
    size_t iccProfileSize;

    // Convenience flags
    bool isHDR;
};

// ============================================================================
// Result structures
// ============================================================================

struct DecodeResult
{
    uintptr_t dataPtr; // Pointer to pixel data in WASM heap
    size_t dataSize;   // Size in bytes
    uint32_t width;
    uint32_t height;
    uint32_t depth;
    uint32_t channels;
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

// Helper to extract metadata from avifImage
ImageMetadata extractMetadata(const avifImage *image)
{
    ImageMetadata meta;

    // CICP as strings
    meta.colorPrimaries = colorPrimariesToString(image->colorPrimaries);
    meta.transferFunction = transferToString(image->transferCharacteristics);
    meta.matrixCoefficients = matrixToString(image->matrixCoefficients);
    meta.fullRange = (image->yuvRange == AVIF_RANGE_FULL);

    // Content light level
    meta.maxCLL = image->clli.maxCLL;
    meta.maxPALL = image->clli.maxPALL;

    // Mastering display (SMPTE ST 2086)
    meta.masteringDisplay.present = false;
    // libavif stores these as fixed-point: chromaticity * 50000, luminance * 10000
    if (image->colorPrimaries == AVIF_COLOR_PRIMARIES_BT2020 ||
        isHDRTransfer(image->transferCharacteristics))
    {
        // Check if mastering display data is available via CICP or embedded
        // For now, we'll try to extract from the image if available
        // Note: libavif doesn't expose mdcv directly in avifImage in older versions
        // This may need version-specific handling
    }

    // ICC profile - copy to malloc'd buffer for JS to read
    if (image->icc.size > 0 && image->icc.data != nullptr)
    {
        uint8_t *iccBuffer = static_cast<uint8_t *>(malloc(image->icc.size));
        if (iccBuffer)
        {
            std::memcpy(iccBuffer, image->icc.data, image->icc.size);
            meta.iccProfilePtr = reinterpret_cast<uintptr_t>(iccBuffer);
            meta.iccProfileSize = image->icc.size;
        }
        else
        {
            meta.iccProfilePtr = 0;
            meta.iccProfileSize = 0;
        }
    }
    else
    {
        meta.iccProfilePtr = 0;
        meta.iccProfileSize = 0;
    }

    // HDR flag
    meta.isHDR = isHDRTransfer(image->transferCharacteristics) || image->depth > 8;

    return meta;
}

DecodeResult decode(
    uintptr_t inputPtr,
    size_t inputSize,
    int targetBitDepth,
    int maxThreads)
{
    double tStart = emscripten_get_now();
    DecodeTimings timings;
    const uint8_t *avifData = reinterpret_cast<const uint8_t *>(inputPtr);
    DecodeResult result;
    result.dataPtr = 0;
    result.dataSize = 0;
    result.width = 0;
    result.height = 0;
    result.depth = 8;
    result.channels = 0;
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

    double t0 = emscripten_get_now();
    avifResult res = avifDecoderSetIOMemory(
        decoder,
        avifData,
        inputSize);
    timings.io = emscripten_get_now() - t0;
    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("IO error: ") + avifResultToString(res);
        avifDecoderDestroy(decoder);
        return result;
    }
    t0 = emscripten_get_now();
    res = avifDecoderParse(decoder);
    timings.parse = emscripten_get_now() - t0;
    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("Parse error: ") + avifResultToString(res);
        avifDecoderDestroy(decoder);
        return result;
    }
    t0 = emscripten_get_now();
    res = avifDecoderNextImage(decoder);
    timings.decode = emscripten_get_now() - t0;
    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("Decode error: ") + avifResultToString(res);
        avifDecoderDestroy(decoder);
        return result;
    }

    avifImage *image = decoder->image;
    result.width = image->width;
    result.height = image->height;
    result.depth = image->depth;

    const uint8_t colorChannels = (image->yuvFormat == AVIF_PIXEL_FORMAT_YUV400) ? 1 : 3;
    const uint8_t alphaChannel = (image->alphaPlane != nullptr) ? 1 : 0;
    result.channels = colorChannels + alphaChannel;
    result.metadata = extractMetadata(image);

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
    rgb.format = (result.channels == 4) ? AVIF_RGB_FORMAT_RGBA : (result.channels == 3) ? AVIF_RGB_FORMAT_RGB
                                                                                        : AVIF_RGB_FORMAT_GRAY;
    rgb.alphaPremultiplied = AVIF_FALSE;
    rgb.isFloat = AVIF_FALSE;

    avifRGBImageAllocatePixels(&rgb);

    t0 = emscripten_get_now();
    res = avifImageYUVToRGB(image, &rgb);
    timings.yuvToRgb = emscripten_get_now() - t0;
    if (res != AVIF_RESULT_OK)
    {
        result.error = std::string("YUV to RGB error: ") + avifResultToString(res);
        avifRGBImageFreePixels(&rgb);
        avifDecoderDestroy(decoder);
        return result;
    }

    // Allocate memory for pixel data (caller must free via Module._free)
    size_t dataSize = rgb.rowBytes * rgb.height;
    void *dataPtr = malloc(dataSize);
    // uint8_t* dataPtr = static_cast<uint8_t*>(malloc(dataSize));
    if (!dataPtr)
    {
        result.error = "Failed to allocate output buffer";
        avifRGBImageFreePixels(&rgb);
        avifDecoderDestroy(decoder);
        return result;
    }
    t0 = emscripten_get_now();
    std::memcpy(dataPtr, rgb.pixels, dataSize);
    timings.memcpy = emscripten_get_now() - t0;
    result.dataPtr = reinterpret_cast<uintptr_t>(dataPtr);
    result.dataSize = dataSize;
    result.depth = outputDepth;

    avifRGBImageFreePixels(&rgb);
    avifDecoderDestroy(decoder);
    timings.total = emscripten_get_now() - tStart;
    result.timings = timings;
    return result;
}

ImageInfo getImageInfo(uintptr_t inputPtr, size_t inputSize)
{
    const uint8_t *avifData = reinterpret_cast<const uint8_t *>(inputPtr);
    ImageInfo info;
    info.width = 0;
    info.height = 0;
    info.depth = 0;
    info.channels = 0;

    avifDecoder *decoder = avifDecoderCreate();
    if (!decoder)
        return info;

    decoder->maxThreads = 1;
    decoder->strictFlags = AVIF_STRICT_DISABLED;
    decoder->ignoreExif = AVIF_TRUE;
    decoder->ignoreXMP = AVIF_TRUE;

    avifResult res = avifDecoderSetIOMemory(
        decoder,
        avifData,
        inputSize);

    if (res != AVIF_RESULT_OK)
    {
        avifDecoderDestroy(decoder);
        return info;
    }

    res = avifDecoderParse(decoder);
    if (res != AVIF_RESULT_OK)
    {
        avifDecoderDestroy(decoder);
        return info;
    }

    avifImage *image = decoder->image;

    info.width = image->width;
    info.height = image->height;
    info.depth = image->depth;

    const uint8_t colorChannels = (image->yuvFormat == AVIF_PIXEL_FORMAT_YUV400) ? 1 : 3;
    const uint8_t alphaChannel = (image->alphaPlane != nullptr) ? 1 : 0;
    info.channels = colorChannels + alphaChannel;
    info.metadata = extractMetadata(image);

    avifDecoderDestroy(decoder);
    return info;
}

EMSCRIPTEN_BINDINGS(avif_decoder)
{
    // Mastering display metadata
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

    // Image metadata
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
        .field("isHDR", &ImageMetadata::isHDR);

    // Decode result
    value_object<DecodeResult>("DecodeResult")
        .field("dataPtr", &DecodeResult::dataPtr)
        .field("dataSize", &DecodeResult::dataSize)
        .field("width", &DecodeResult::width)
        .field("height", &DecodeResult::height)
        .field("depth", &DecodeResult::depth)
        .field("channels", &DecodeResult::channels)
        .field("metadata", &DecodeResult::metadata)
        .field("timings", &DecodeResult::timings)
        .field("error", &DecodeResult::error);

    // Image info (without pixel data)
    value_object<ImageInfo>("ImageInfo")
        .field("width", &ImageInfo::width)
        .field("height", &ImageInfo::height)
        .field("depth", &ImageInfo::depth)
        .field("channels", &ImageInfo::channels)
        .field("metadata", &ImageInfo::metadata);

    value_object<DecodeTimings>("DecodeTimings")
        .field("io", &DecodeTimings::io)
        .field("parse", &DecodeTimings::parse)
        .field("decode", &DecodeTimings::decode)
        .field("yuvToRgb", &DecodeTimings::yuvToRgb)
        .field("memcpy", &DecodeTimings::memcpy)
        .field("total", &DecodeTimings::total);

    function("decode", &decode);
    function("getImageInfo", &getImageInfo);
}
