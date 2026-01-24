#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <avif/avif.h>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

using namespace emscripten;

// ============================================================================
// CICP to string conversion functions
// ============================================================================

std::string colorPrimariesToString(avifColorPrimaries primaries) {
    switch (primaries) {
        case AVIF_COLOR_PRIMARIES_BT709:       return "bt709";
        case AVIF_COLOR_PRIMARIES_BT470M:      return "bt470m";
        case AVIF_COLOR_PRIMARIES_BT470BG:     return "bt470bg";
        case AVIF_COLOR_PRIMARIES_BT601:       return "bt601";
        case AVIF_COLOR_PRIMARIES_SMPTE240:    return "smpte240";
        case AVIF_COLOR_PRIMARIES_GENERIC_FILM:return "generic-film";
        case AVIF_COLOR_PRIMARIES_BT2020:      return "bt2020";
        case AVIF_COLOR_PRIMARIES_XYZ:         return "xyz";
        case AVIF_COLOR_PRIMARIES_SMPTE431:    return "dci-p3";
        case AVIF_COLOR_PRIMARIES_SMPTE432:    return "display-p3";
        case AVIF_COLOR_PRIMARIES_EBU3213:     return "ebu3213";
        default:                               return "unknown";
    }
}

std::string transferToString(avifTransferCharacteristics tc) {
    switch (tc) {
        case AVIF_TRANSFER_CHARACTERISTICS_BT709:     return "bt709";
        case AVIF_TRANSFER_CHARACTERISTICS_BT470M:    return "bt470m";
        case AVIF_TRANSFER_CHARACTERISTICS_BT470BG:   return "bt470bg";
        case AVIF_TRANSFER_CHARACTERISTICS_BT601:     return "bt601";
        case AVIF_TRANSFER_CHARACTERISTICS_SMPTE240:  return "smpte240";
        case AVIF_TRANSFER_CHARACTERISTICS_LINEAR:    return "linear";
        case AVIF_TRANSFER_CHARACTERISTICS_LOG100:    return "log100";
        case AVIF_TRANSFER_CHARACTERISTICS_LOG100_SQRT10: return "log100-sqrt10";
        case AVIF_TRANSFER_CHARACTERISTICS_IEC61966:  return "iec61966";
        case AVIF_TRANSFER_CHARACTERISTICS_BT1361:    return "bt1361";
        case AVIF_TRANSFER_CHARACTERISTICS_SRGB:      return "srgb";
        case AVIF_TRANSFER_CHARACTERISTICS_BT2020_10BIT: return "bt2020-10bit";
        case AVIF_TRANSFER_CHARACTERISTICS_BT2020_12BIT: return "bt2020-12bit";
        case AVIF_TRANSFER_CHARACTERISTICS_PQ:        return "pq";
        case AVIF_TRANSFER_CHARACTERISTICS_SMPTE428:  return "smpte428";
        case AVIF_TRANSFER_CHARACTERISTICS_HLG:       return "hlg";
        default:                                      return "unknown";
    }
}

std::string matrixToString(avifMatrixCoefficients mc) {
    switch (mc) {
        case AVIF_MATRIX_COEFFICIENTS_IDENTITY:    return "identity";
        case AVIF_MATRIX_COEFFICIENTS_BT709:       return "bt709";
        case AVIF_MATRIX_COEFFICIENTS_FCC:         return "fcc";
        case AVIF_MATRIX_COEFFICIENTS_BT470BG:     return "bt470bg";
        case AVIF_MATRIX_COEFFICIENTS_BT601:       return "bt601";
        case AVIF_MATRIX_COEFFICIENTS_SMPTE240:    return "smpte240";
        case AVIF_MATRIX_COEFFICIENTS_YCGCO:       return "ycgco";
        case AVIF_MATRIX_COEFFICIENTS_BT2020_NCL:  return "bt2020-ncl";
        case AVIF_MATRIX_COEFFICIENTS_BT2020_CL:   return "bt2020-cl";
        case AVIF_MATRIX_COEFFICIENTS_SMPTE2085:   return "smpte2085";
        case AVIF_MATRIX_COEFFICIENTS_CHROMA_DERIVED_NCL: return "chroma-derived-ncl";
        case AVIF_MATRIX_COEFFICIENTS_CHROMA_DERIVED_CL:  return "chroma-derived-cl";
        case AVIF_MATRIX_COEFFICIENTS_ICTCP:       return "ictcp";
        default:                                   return "unknown";
    }
}

bool isHDRTransfer(avifTransferCharacteristics tc) {
    return tc == AVIF_TRANSFER_CHARACTERISTICS_PQ ||
           tc == AVIF_TRANSFER_CHARACTERISTICS_HLG;
}

// ============================================================================
// Mastering Display Metadata (SMPTE ST 2086)
// ============================================================================

struct MasteringDisplay {
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

struct ImageMetadata {
    // CICP (as readable strings)
    std::string colorPrimaries;
    std::string transferFunction;
    std::string matrixCoefficients;
    bool fullRange;

    // Content light level
    uint32_t maxCLL;   // nits
    uint32_t maxPALL;  // nits

    // Mastering display
    MasteringDisplay masteringDisplay;

    // ICC profile (raw bytes, empty if not present)
    std::vector<uint8_t> iccProfile;

    // Convenience flags
    bool isHDR;
};

// ============================================================================
// Result structures
// ============================================================================

struct DecodeResult {
    uintptr_t dataPtr;   // Pointer to pixel data in WASM heap
    size_t dataSize;     // Size in bytes
    uint32_t width;
    uint32_t height;
    uint32_t depth;
    bool hasAlpha;
    ImageMetadata metadata;
    std::string error;
};

struct ImageInfo {
    uint32_t width;
    uint32_t height;
    uint32_t depth;
    bool hasAlpha;
    ImageMetadata metadata;
};

// Helper to extract metadata from avifImage
ImageMetadata extractMetadata(const avifImage* image) {
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
        isHDRTransfer(image->transferCharacteristics)) {
        // Check if mastering display data is available via CICP or embedded
        // For now, we'll try to extract from the image if available
        // Note: libavif doesn't expose mdcv directly in avifImage in older versions
        // This may need version-specific handling
    }

    // ICC profile
    if (image->icc.size > 0 && image->icc.data != nullptr) {
        meta.iccProfile.resize(image->icc.size);
        std::memcpy(meta.iccProfile.data(), image->icc.data, image->icc.size);
    }

    // HDR flag
    meta.isHDR = isHDRTransfer(image->transferCharacteristics) || image->depth > 8;

    return meta;
}

DecodeResult decode(
    const std::string& avifData,
    int targetBitDepth,
    int maxThreads
) {
    DecodeResult result;
    result.dataPtr = 0;
    result.dataSize = 0;
    result.width = 0;
    result.height = 0;
    result.depth = 8;
    result.hasAlpha = false;

    avifDecoder* decoder = avifDecoderCreate();
    if (!decoder) {
        result.error = "Failed to create decoder";
        return result;
    }

    decoder->maxThreads = maxThreads > 0 ? maxThreads : 1;
    decoder->codecChoice = AVIF_CODEC_CHOICE_AUTO;
    decoder->strictFlags = AVIF_STRICT_DISABLED;
    decoder->ignoreExif = AVIF_TRUE;
    decoder->ignoreXMP = AVIF_TRUE;

    avifResult res = avifDecoderSetIOMemory(
        decoder,
        reinterpret_cast<const uint8_t*>(avifData.data()),
        avifData.size()
    );

    if (res != AVIF_RESULT_OK) {
        result.error = std::string("IO error: ") + avifResultToString(res);
        avifDecoderDestroy(decoder);
        return result;
    }

    res = avifDecoderParse(decoder);
    if (res != AVIF_RESULT_OK) {
        result.error = std::string("Parse error: ") + avifResultToString(res);
        avifDecoderDestroy(decoder);
        return result;
    }

    res = avifDecoderNextImage(decoder);
    if (res != AVIF_RESULT_OK) {
        result.error = std::string("Decode error: ") + avifResultToString(res);
        avifDecoderDestroy(decoder);
        return result;
    }

    avifImage* image = decoder->image;
    result.width = image->width;
    result.height = image->height;
    result.depth = image->depth;
    result.hasAlpha = image->alphaPlane != nullptr;
    result.metadata = extractMetadata(image);

    // Convert to RGB(A)
    avifRGBImage rgb;
    avifRGBImageSetDefaults(&rgb, image);

    // Determine output bit depth
    int outputDepth = targetBitDepth > 0 ? targetBitDepth : image->depth;
    if (outputDepth < 8) outputDepth = 8;
    if (outputDepth > 16) outputDepth = 16;

    rgb.depth = outputDepth;
    rgb.format = result.hasAlpha ? AVIF_RGB_FORMAT_RGBA : AVIF_RGB_FORMAT_RGB;
    rgb.alphaPremultiplied = AVIF_FALSE;
    rgb.isFloat = AVIF_FALSE;

    avifRGBImageAllocatePixels(&rgb);

    res = avifImageYUVToRGB(image, &rgb);
    if (res != AVIF_RESULT_OK) {
        result.error = std::string("YUV to RGB error: ") + avifResultToString(res);
        avifRGBImageFreePixels(&rgb);
        avifDecoderDestroy(decoder);
        return result;
    }

    // Allocate memory for pixel data (caller must free via Module._free)
    size_t dataSize = rgb.rowBytes * rgb.height;
    uint8_t* dataPtr = static_cast<uint8_t*>(malloc(dataSize));
    if (!dataPtr) {
        result.error = "Failed to allocate output buffer";
        avifRGBImageFreePixels(&rgb);
        avifDecoderDestroy(decoder);
        return result;
    }
    std::memcpy(dataPtr, rgb.pixels, dataSize);

    result.dataPtr = reinterpret_cast<uintptr_t>(dataPtr);
    result.dataSize = dataSize;
    result.depth = outputDepth;

    avifRGBImageFreePixels(&rgb);
    avifDecoderDestroy(decoder);

    return result;
}

ImageInfo getImageInfo(const std::string& avifData) {
    ImageInfo info;
    info.width = 0;
    info.height = 0;
    info.depth = 0;
    info.hasAlpha = false;

    avifDecoder* decoder = avifDecoderCreate();
    if (!decoder) return info;

    decoder->maxThreads = 1;
    decoder->strictFlags = AVIF_STRICT_DISABLED;
    decoder->ignoreExif = AVIF_TRUE;
    decoder->ignoreXMP = AVIF_TRUE;

    avifResult res = avifDecoderSetIOMemory(
        decoder,
        reinterpret_cast<const uint8_t*>(avifData.data()),
        avifData.size()
    );

    if (res != AVIF_RESULT_OK) {
        avifDecoderDestroy(decoder);
        return info;
    }

    res = avifDecoderParse(decoder);
    if (res != AVIF_RESULT_OK) {
        avifDecoderDestroy(decoder);
        return info;
    }

    avifImage* image = decoder->image;

    info.width = image->width;
    info.height = image->height;
    info.depth = image->depth;
    info.hasAlpha = image->alphaPlane != nullptr;
    info.metadata = extractMetadata(image);

    avifDecoderDestroy(decoder);
    return info;
}

EMSCRIPTEN_BINDINGS(avif_decoder) {
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
        .field("iccProfile", &ImageMetadata::iccProfile)
        .field("isHDR", &ImageMetadata::isHDR);

    // Decode result
    value_object<DecodeResult>("DecodeResult")
        .field("dataPtr", &DecodeResult::dataPtr)
        .field("dataSize", &DecodeResult::dataSize)
        .field("width", &DecodeResult::width)
        .field("height", &DecodeResult::height)
        .field("depth", &DecodeResult::depth)
        .field("hasAlpha", &DecodeResult::hasAlpha)
        .field("metadata", &DecodeResult::metadata)
        .field("error", &DecodeResult::error);

    // Image info (without pixel data)
    value_object<ImageInfo>("ImageInfo")
        .field("width", &ImageInfo::width)
        .field("height", &ImageInfo::height)
        .field("depth", &ImageInfo::depth)
        .field("hasAlpha", &ImageInfo::hasAlpha)
        .field("metadata", &ImageInfo::metadata);

    register_vector<uint8_t>("Uint8Vector");

    function("decode", &decode);
    function("getImageInfo", &getImageInfo);
}
