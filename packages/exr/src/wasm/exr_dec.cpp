#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <emscripten.h>

#include <ImfInputFile.h>
#include <ImfHeader.h>
#include <ImfChannelList.h>
#include <ImfFrameBuffer.h>
#include <ImfChromaticitiesAttribute.h>
#include <ImfFloatAttribute.h>
#include <ImfCompressionAttribute.h>
#include <ImfStandardAttributes.h>
#include <ImfIO.h>
#include <ImfThreading.h>
#include <half.h>

#include "descriptor.hpp"

#include <cstdint>
#include <cstring>
#include <optional>
#include <string>
#include <vector>
#include <algorithm>

using namespace emscripten;
using namespace jcodecs;

// Max threads constant (defined via CMake for MT builds)
#ifndef MAX_THREADS
#define MAX_THREADS 1  // Single-threaded fallback
#endif

// ============================================================================
// In-memory IStream for reading EXR from a buffer
// ============================================================================

class MemoryIStream : public Imf::IStream
{
public:
    MemoryIStream(const uint8_t *data, size_t size)
        : Imf::IStream("memory")
        , _data(data)
        , _size(size)
        , _pos(0)
    {
    }

    bool isMemoryMapped() const override { return true; }

    bool read(char c[], int n) override
    {
        if (_pos + n > _size)
        {
            size_t remaining = _size - _pos;
            if (remaining > 0)
            {
                std::memcpy(c, _data + _pos, remaining);
                _pos = _size;
            }
            return false;
        }
        std::memcpy(c, _data + _pos, n);
        _pos += n;
        return true;
    }

    char *readMemoryMapped(int n) override
    {
        if (_pos + n > _size)
            throw std::runtime_error("Read past end of memory stream");
        char *ptr = const_cast<char *>(reinterpret_cast<const char *>(_data + _pos));
        _pos += n;
        return ptr;
    }

    uint64_t tellg() override { return _pos; }

    void seekg(uint64_t pos) override { _pos = static_cast<size_t>(pos); }

private:
    const uint8_t *_data;
    size_t _size;
    size_t _pos;
};

// ============================================================================
// Chromaticities → ColorPrimaries enum mapping
// ============================================================================

static bool approxEqual(float a, float b, float tol = 0.005f)
{
    return std::abs(a - b) < tol;
}

std::optional<ColorPrimaries> chromaticitiesToColorPrimaries(const Imf::Chromaticities &c)
{
    // sRGB / Rec.709: R(0.64,0.33) G(0.30,0.60) B(0.15,0.06) W(0.3127,0.3290)
    if (approxEqual(c.red.x, 0.64f) && approxEqual(c.red.y, 0.33f) &&
        approxEqual(c.green.x, 0.30f) && approxEqual(c.green.y, 0.60f) &&
        approxEqual(c.blue.x, 0.15f) && approxEqual(c.blue.y, 0.06f))
    {
        return ColorPrimaries::BT709;
    }

    // Display-P3: R(0.680,0.320) G(0.265,0.690) B(0.150,0.060) W(0.3127,0.3290)
    if (approxEqual(c.red.x, 0.680f) && approxEqual(c.red.y, 0.320f) &&
        approxEqual(c.green.x, 0.265f) && approxEqual(c.green.y, 0.690f) &&
        approxEqual(c.blue.x, 0.150f) && approxEqual(c.blue.y, 0.060f))
    {
        return ColorPrimaries::DisplayP3;
    }

    // Rec.2020: R(0.708,0.292) G(0.170,0.797) B(0.131,0.046)
    if (approxEqual(c.red.x, 0.708f) && approxEqual(c.red.y, 0.292f) &&
        approxEqual(c.green.x, 0.170f) && approxEqual(c.green.y, 0.797f) &&
        approxEqual(c.blue.x, 0.131f) && approxEqual(c.blue.y, 0.046f))
    {
        return ColorPrimaries::BT2020;
    }

    return std::nullopt;  // Unknown primaries → use customPrimaries
}

std::string compressionToString(Imf::Compression c)
{
    switch (c)
    {
    case Imf::NO_COMPRESSION:   return "none";
    case Imf::RLE_COMPRESSION:  return "rle";
    case Imf::ZIPS_COMPRESSION: return "zips";
    case Imf::ZIP_COMPRESSION:  return "zip";
    case Imf::PIZ_COMPRESSION:  return "piz";
    case Imf::PXR24_COMPRESSION: return "pxr24";
    case Imf::DWAA_COMPRESSION: return "dwaa";
    case Imf::DWAB_COMPRESSION: return "dwab";
    default:                    return "unknown";
    }
}

// ============================================================================
// EXR-specific format data (kept separate from ImageDescriptor)
// ============================================================================

struct EXRChromaticities
{
    float redX, redY;
    float greenX, greenY;
    float blueX, blueY;
    float whiteX, whiteY;
    bool present;
};

struct EXRWindow
{
    int xMin, yMin, xMax, yMax;
};

struct EXRFormatData
{
    std::string compression;
    EXRWindow dataWindow;
    EXRWindow displayWindow;
    EXRChromaticities chromaticities;
};

// ============================================================================
// Timing structure
// ============================================================================

struct DecodeTimings
{
    double setup;
    double headerParse;
    double decode;
    double memcpy;
    double total;
};

// ============================================================================
// Result structures
// ============================================================================

struct DecodeResult
{
    uintptr_t dataPtr;
    size_t dataSize;
    ImageDescriptor descriptor;
    EXRFormatData formatData;
    std::string error;
    DecodeTimings timings;
};

struct ImageInfo
{
    ImageDescriptor descriptor;
    EXRFormatData formatData;
};

// ============================================================================
// Build ImageDescriptor from EXR header metadata
// ============================================================================

ImageDescriptor buildDescriptor(
    uint32_t width,
    uint32_t height,
    uint32_t channels,
    bool hasA,
    DataType dataType,
    uint32_t bitDepth,
    const std::optional<ColorPrimaries> &primaries,
    const EXRChromaticities &chrom,
    float whiteLuminance)
{
    ImageDescriptorBuilder builder;

    builder.setGeometry(width, height);

    ChannelModel model = hasA ? ChannelModel::RGBA : ChannelModel::RGB;
    builder.setChannels(model, channels);

    builder.setNumeric(SampleType::Float, dataType, bitDepth);
    builder.setQuantization(QuantizationRange::full());
    builder.setSampleLayout(SampleLayout::Interleaved);

    if (primaries)
    {
        builder.setColorPrimaries(*primaries);
    }
    else if (chrom.present)
    {
        // Custom primaries from unknown chromaticities attribute
        CustomPrimaries cp;
        cp.red   = {chrom.redX,   chrom.redY};
        cp.green = {chrom.greenX, chrom.greenY};
        cp.blue  = {chrom.blueX,  chrom.blueY};
        builder.setCustomPrimaries(cp);
        builder.setCustomWhitePoint(chrom.whiteX, chrom.whiteY);
    }
    else
    {
        // No chromaticities attribute → assume BT.709 (sRGB primaries)
        builder.setColorPrimaries(ColorPrimaries::BT709);
    }

    builder.setWhitePoint(WhitePoint::D65);
    builder.setTransferFunction(TransferFunction::Linear);   // EXR is always linear
    builder.setLuminanceReference(LuminanceReference::HDR);  // EXR is always HDR scene-linear

    if (whiteLuminance > 0.0f)
    {
        builder.setDiffuseWhite(whiteLuminance);
    }

    builder.setAlphaMode(hasA ? AlphaMode::Straight : AlphaMode::None);
    builder.setImageDomain(ImageDomain::SceneReferred);

    return builder.build();
}

// ============================================================================
// Main decode function
// ============================================================================

DecodeResult decode(
    uintptr_t inputPtr,
    size_t inputSize,
    std::string requestedDataType,
    int maxThreads)
{
    double tStart = emscripten_get_now();
    DecodeTimings timings = {0};
    DecodeResult result = {};
    result.dataPtr = 0;
    result.dataSize = 0;

    const uint8_t *exrData = reinterpret_cast<const uint8_t *>(inputPtr);

    double t0 = emscripten_get_now();

#if MAX_THREADS > 1
    if (maxThreads > 0)
    {
        Imf::setGlobalThreadCount(maxThreads);
    }
#endif

    timings.setup = emscripten_get_now() - t0;

    try
    {
        t0 = emscripten_get_now();

        MemoryIStream stream(exrData, inputSize);
        Imf::InputFile file(stream);

        const Imf::Header &header = file.header();
        const Imath::Box2i &dataWindow = header.dataWindow();
        const Imath::Box2i &displayWindow = header.displayWindow();

        int width  = dataWindow.max.x - dataWindow.min.x + 1;
        int height = dataWindow.max.y - dataWindow.min.y + 1;

        if (width <= 0 || height <= 0)
        {
            result.error = "Invalid image dimensions";
            return result;
        }

        // Determine available channels
        const Imf::ChannelList &channelList = header.channels();
        bool hasR = channelList.findChannel("R") != nullptr;
        bool hasG = channelList.findChannel("G") != nullptr;
        bool hasB = channelList.findChannel("B") != nullptr;
        bool hasA = channelList.findChannel("A") != nullptr;

        if (!hasR || !hasG || !hasB)
        {
            result.error = "EXR file must contain R, G, B channels";
            return result;
        }

        uint32_t channels = hasA ? 4 : 3;

        // Determine pixel type from file
        Imf::PixelType filePixelType = Imf::HALF;
        const Imf::Channel *rChan = channelList.findChannel("R");
        if (rChan)
        {
            filePixelType = rChan->type;
        }

        // Determine output pixel type
        Imf::PixelType outputPixelType;
        if (requestedDataType == "float32")
        {
            outputPixelType = Imf::FLOAT;
        }
        else if (requestedDataType == "float16")
        {
            outputPixelType = Imf::HALF;
        }
        else
        {
            // "auto" - preserve original
            outputPixelType = filePixelType;
        }

        int bytesPerSample = (outputPixelType == Imf::FLOAT) ? 4 : 2;
        DataType dataType  = (outputPixelType == Imf::FLOAT) ? DataType::Float32 : DataType::Float16;
        uint32_t bitDepth  = (outputPixelType == Imf::FLOAT) ? 32 : 16;

        // === Parse EXR-specific metadata ===

        // Chromaticities
        EXRChromaticities chrom = {};
        std::optional<ColorPrimaries> primaries;

        const Imf::ChromaticitiesAttribute *chromAttr =
            header.findTypedAttribute<Imf::ChromaticitiesAttribute>("chromaticities");
        if (chromAttr)
        {
            const Imf::Chromaticities &c = chromAttr->value();
            chrom.redX   = c.red.x;   chrom.redY   = c.red.y;
            chrom.greenX = c.green.x; chrom.greenY = c.green.y;
            chrom.blueX  = c.blue.x;  chrom.blueY  = c.blue.y;
            chrom.whiteX = c.white.x; chrom.whiteY = c.white.y;
            chrom.present = true;
            primaries = chromaticitiesToColorPrimaries(c);
        }
        else
        {
            chrom.present = false;
            // No chromaticities → default BT.709
        }

        // White luminance
        const Imf::FloatAttribute *lumAttr =
            header.findTypedAttribute<Imf::FloatAttribute>("whiteLuminance");
        float whiteLuminance = lumAttr ? lumAttr->value() : 0.0f;

        // Format-specific data (EXR-only, separate from ImageDescriptor)
        result.formatData.compression  = compressionToString(header.compression());
        result.formatData.dataWindow   = {dataWindow.min.x, dataWindow.min.y,
                                          dataWindow.max.x, dataWindow.max.y};
        result.formatData.displayWindow = {displayWindow.min.x, displayWindow.min.y,
                                           displayWindow.max.x, displayWindow.max.y};
        result.formatData.chromaticities = chrom;

        timings.headerParse = emscripten_get_now() - t0;

        // === Decode pixels ===
        t0 = emscripten_get_now();

        size_t pixelStride = channels * bytesPerSample;
        size_t rowStride   = static_cast<size_t>(width) * pixelStride;
        size_t bufferSize  = static_cast<size_t>(height) * rowStride;

        std::vector<uint8_t> pixels(bufferSize);
        uint8_t *base = pixels.data();

        char *baseOffset = reinterpret_cast<char *>(base)
                           - dataWindow.min.x * pixelStride
                           - dataWindow.min.y * rowStride;

        Imf::FrameBuffer frameBuffer;
        frameBuffer.insert("R", Imf::Slice(outputPixelType,
            baseOffset + 0 * bytesPerSample, pixelStride, rowStride));
        frameBuffer.insert("G", Imf::Slice(outputPixelType,
            baseOffset + 1 * bytesPerSample, pixelStride, rowStride));
        frameBuffer.insert("B", Imf::Slice(outputPixelType,
            baseOffset + 2 * bytesPerSample, pixelStride, rowStride));
        if (hasA)
        {
            frameBuffer.insert("A", Imf::Slice(outputPixelType,
                baseOffset + 3 * bytesPerSample, pixelStride, rowStride,
                1, 1, 1.0));  // Default alpha = 1.0
        }

        file.setFrameBuffer(frameBuffer);
        file.readPixels(dataWindow.min.y, dataWindow.max.y);

        timings.decode = emscripten_get_now() - t0;

        // Copy to malloc'd buffer
        t0 = emscripten_get_now();
        void *dataPtr = malloc(bufferSize);
        if (!dataPtr)
        {
            result.error = "Failed to allocate output buffer";
            return result;
        }
        std::memcpy(dataPtr, pixels.data(), bufferSize);

        result.dataPtr  = reinterpret_cast<uintptr_t>(dataPtr);
        result.dataSize = bufferSize;

        // Build ImageDescriptor via descriptor.hpp
        result.descriptor = buildDescriptor(
            static_cast<uint32_t>(width),
            static_cast<uint32_t>(height),
            channels,
            hasA,
            dataType,
            bitDepth,
            primaries,
            chrom,
            whiteLuminance);

        timings.memcpy = emscripten_get_now() - t0;
    }
    catch (const std::exception &e)
    {
        result.error = std::string("EXR decode error: ") + e.what();
        return result;
    }

    timings.total  = emscripten_get_now() - tStart;
    result.timings = timings;

    return result;
}

// ============================================================================
// Get image info without full decode
// ============================================================================

ImageInfo getImageInfo(uintptr_t inputPtr, size_t inputSize)
{
    ImageInfo info = {};

    const uint8_t *exrData = reinterpret_cast<const uint8_t *>(inputPtr);

    try
    {
        MemoryIStream stream(exrData, inputSize);
        Imf::InputFile file(stream);

        const Imf::Header &header = file.header();
        const Imath::Box2i &dataWindow    = header.dataWindow();
        const Imath::Box2i &displayWindow = header.displayWindow();

        uint32_t width   = static_cast<uint32_t>(dataWindow.max.x - dataWindow.min.x + 1);
        uint32_t height  = static_cast<uint32_t>(dataWindow.max.y - dataWindow.min.y + 1);

        const Imf::ChannelList &channelList = header.channels();
        bool hasA = channelList.findChannel("A") != nullptr;
        uint32_t channels = hasA ? 4 : 3;

        // Pixel type → DataType
        const Imf::Channel *rChan = channelList.findChannel("R");
        DataType dataType = DataType::Float16;
        uint32_t bitDepth = 16;
        if (rChan && rChan->type == Imf::FLOAT)
        {
            dataType  = DataType::Float32;
            bitDepth  = 32;
        }

        // Chromaticities
        EXRChromaticities chrom = {};
        std::optional<ColorPrimaries> primaries;

        const Imf::ChromaticitiesAttribute *chromAttr =
            header.findTypedAttribute<Imf::ChromaticitiesAttribute>("chromaticities");
        if (chromAttr)
        {
            const Imf::Chromaticities &c = chromAttr->value();
            chrom.redX   = c.red.x;   chrom.redY   = c.red.y;
            chrom.greenX = c.green.x; chrom.greenY = c.green.y;
            chrom.blueX  = c.blue.x;  chrom.blueY  = c.blue.y;
            chrom.whiteX = c.white.x; chrom.whiteY = c.white.y;
            chrom.present = true;
            primaries = chromaticitiesToColorPrimaries(c);
        }
        else
        {
            chrom.present = false;
        }

        const Imf::FloatAttribute *lumAttr =
            header.findTypedAttribute<Imf::FloatAttribute>("whiteLuminance");
        float whiteLuminance = lumAttr ? lumAttr->value() : 0.0f;

        info.formatData.compression   = compressionToString(header.compression());
        info.formatData.dataWindow    = {dataWindow.min.x, dataWindow.min.y,
                                         dataWindow.max.x, dataWindow.max.y};
        info.formatData.displayWindow = {displayWindow.min.x, displayWindow.min.y,
                                         displayWindow.max.x, displayWindow.max.y};
        info.formatData.chromaticities = chrom;

        info.descriptor = buildDescriptor(
            width, height, channels, hasA,
            dataType, bitDepth,
            primaries, chrom, whiteLuminance);
    }
    catch (...)
    {
        // Return empty info on error
    }

    return info;
}

// ============================================================================
// Emscripten bindings
// ============================================================================

EMSCRIPTEN_BINDINGS(exr_decoder)
{
    // EXR-specific structs (ImageDescriptor and its enums are registered by descriptor-embind.cpp)

    value_object<EXRChromaticities>("EXRChromaticities")
        .field("redX",   &EXRChromaticities::redX)
        .field("redY",   &EXRChromaticities::redY)
        .field("greenX", &EXRChromaticities::greenX)
        .field("greenY", &EXRChromaticities::greenY)
        .field("blueX",  &EXRChromaticities::blueX)
        .field("blueY",  &EXRChromaticities::blueY)
        .field("whiteX", &EXRChromaticities::whiteX)
        .field("whiteY", &EXRChromaticities::whiteY)
        .field("present",&EXRChromaticities::present);

    value_object<EXRWindow>("EXRWindow")
        .field("xMin", &EXRWindow::xMin)
        .field("yMin", &EXRWindow::yMin)
        .field("xMax", &EXRWindow::xMax)
        .field("yMax", &EXRWindow::yMax);

    value_object<EXRFormatData>("EXRFormatData")
        .field("compression",   &EXRFormatData::compression)
        .field("dataWindow",    &EXRFormatData::dataWindow)
        .field("displayWindow", &EXRFormatData::displayWindow)
        .field("chromaticities",&EXRFormatData::chromaticities);

    value_object<DecodeTimings>("DecodeTimings")
        .field("setup",       &DecodeTimings::setup)
        .field("headerParse", &DecodeTimings::headerParse)
        .field("decode",      &DecodeTimings::decode)
        .field("memcpy",      &DecodeTimings::memcpy)
        .field("total",       &DecodeTimings::total);

    value_object<DecodeResult>("DecodeResult")
        .field("dataPtr",   &DecodeResult::dataPtr)
        .field("dataSize",  &DecodeResult::dataSize)
        .field("descriptor",&DecodeResult::descriptor)
        .field("formatData",&DecodeResult::formatData)
        .field("timings",   &DecodeResult::timings)
        .field("error",     &DecodeResult::error);

    value_object<ImageInfo>("ImageInfo")
        .field("descriptor",&ImageInfo::descriptor)
        .field("formatData",&ImageInfo::formatData);

    function("decode",       &decode);
    function("getImageInfo", &getImageInfo);

    constant("MAX_THREADS", MAX_THREADS);
}
