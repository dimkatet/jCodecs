#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <emscripten.h>

#include <ImfOutputFile.h>
#include <ImfHeader.h>
#include <ImfChannelList.h>
#include <ImfFrameBuffer.h>
#include <ImfChromaticitiesAttribute.h>
#include <ImfStandardAttributes.h>
#include <ImfIO.h>
#include <ImfThreading.h>
#include <half.h>

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
// In-memory OStream for writing EXR to a buffer
// ============================================================================

class MemoryOStream : public Imf::OStream
{
public:
    MemoryOStream()
        : Imf::OStream("memory")
        , _pos(0)
    {
        _data.reserve(1024 * 1024);  // 1MB initial reservation
    }

    void write(const char c[], int n) override
    {
        size_t end = _pos + n;
        if (end > _data.size())
        {
            _data.resize(end);
        }
        std::memcpy(_data.data() + _pos, c, n);
        _pos += n;
    }

    uint64_t tellp() override { return _pos; }

    void seekp(uint64_t pos) override
    {
        _pos = static_cast<size_t>(pos);
        if (_pos > _data.size())
        {
            _data.resize(_pos);
        }
    }

    const uint8_t *data() const { return _data.data(); }
    size_t size() const { return _data.size(); }

private:
    std::vector<uint8_t> _data;
    size_t _pos;
};

// ============================================================================
// Compression string to enum
// ============================================================================

Imf::Compression stringToCompression(const std::string &s)
{
    if (s == "none")
        return Imf::NO_COMPRESSION;
    if (s == "rle")
        return Imf::RLE_COMPRESSION;
    if (s == "zips")
        return Imf::ZIPS_COMPRESSION;
    if (s == "zip")
        return Imf::ZIP_COMPRESSION;
    if (s == "piz")
        return Imf::PIZ_COMPRESSION;
    if (s == "pxr24")
        return Imf::PXR24_COMPRESSION;
    if (s == "dwaa")
        return Imf::DWAA_COMPRESSION;
    if (s == "dwab")
        return Imf::DWAB_COMPRESSION;
    return Imf::ZIP_COMPRESSION;  // Default
}

// ============================================================================
// Color space to chromaticities
// ============================================================================

Imf::Chromaticities colorSpaceToChromaticities(const std::string &colorSpace)
{
    Imf::Chromaticities c;

    if (colorSpace == "display-p3" || colorSpace == "p3")
    {
        c.red = Imath::V2f(0.680f, 0.320f);
        c.green = Imath::V2f(0.265f, 0.690f);
        c.blue = Imath::V2f(0.150f, 0.060f);
        c.white = Imath::V2f(0.3127f, 0.3290f);
    }
    else if (colorSpace == "rec2020" || colorSpace == "bt2020")
    {
        c.red = Imath::V2f(0.708f, 0.292f);
        c.green = Imath::V2f(0.170f, 0.797f);
        c.blue = Imath::V2f(0.131f, 0.046f);
        c.white = Imath::V2f(0.3127f, 0.3290f);
    }
    else
    {
        // sRGB / Rec.709 (OpenEXR default)
        c.red = Imath::V2f(0.6400f, 0.3300f);
        c.green = Imath::V2f(0.3000f, 0.6000f);
        c.blue = Imath::V2f(0.1500f, 0.0600f);
        c.white = Imath::V2f(0.3127f, 0.3290f);
    }

    return c;
}

// ============================================================================
// Encode Options
// ============================================================================

struct EncodeOptions
{
    std::string compression;   // "none"|"rle"|"zips"|"zip"|"piz"|"pxr24"|"dwaa"|"dwab"
    std::string dataType;      // "float16"|"float32"
    std::string colorSpace;    // "srgb"|"display-p3"|"rec2020"
    int maxThreads;
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
// Main encode function
// ============================================================================

EncodeResult encode(
    uintptr_t pixelsPtr,
    size_t pixelsSize,
    uint32_t width,
    uint32_t height,
    uint32_t channels,
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

    if (channels < 3 || channels > 4)
    {
        result.error = "Invalid channels: EXR requires 3 (RGB) or 4 (RGBA)";
        return result;
    }

    // Determine pixel type
    Imf::PixelType pixelType;
    int bytesPerSample;
    if (options.dataType == "float32")
    {
        pixelType = Imf::FLOAT;
        bytesPerSample = 4;
    }
    else
    {
        pixelType = Imf::HALF;
        bytesPerSample = 2;
    }

    // Validate input size
    size_t expectedSize = static_cast<size_t>(width) * height * channels * bytesPerSample;
    if (pixelsSize < expectedSize)
    {
        result.error = "Invalid input: pixel data too small";
        return result;
    }

    double t0 = emscripten_get_now();

    // Set thread count for OpenEXR
#if MAX_THREADS > 1
    if (options.maxThreads > 0)
    {
        Imf::setGlobalThreadCount(options.maxThreads);
    }
#endif

    try
    {
        // Setup header
        Imath::Box2i dataWindow(Imath::V2i(0, 0), Imath::V2i(width - 1, height - 1));
        Imf::Header header(dataWindow, dataWindow);

        // Set compression
        header.compression() = stringToCompression(options.compression);

        // Set chromaticities
        Imf::Chromaticities chrom = colorSpaceToChromaticities(options.colorSpace);
        addChromaticities(header, chrom);

        // Add channels
        header.channels().insert("R", Imf::Channel(pixelType));
        header.channels().insert("G", Imf::Channel(pixelType));
        header.channels().insert("B", Imf::Channel(pixelType));
        if (channels == 4)
        {
            header.channels().insert("A", Imf::Channel(pixelType));
        }

        result.timings.setup = emscripten_get_now() - t0;

        // Write to memory
        t0 = emscripten_get_now();
        MemoryOStream ostream;

        size_t pixelStride = channels * bytesPerSample;
        size_t rowStride = static_cast<size_t>(width) * pixelStride;

        // Setup frame buffer (interleaved input)
        Imf::FrameBuffer frameBuffer;
        const char *base = reinterpret_cast<const char *>(pixels);

        frameBuffer.insert("R", Imf::Slice(
                                    pixelType,
                                    const_cast<char *>(base + 0 * bytesPerSample),
                                    pixelStride, rowStride));
        frameBuffer.insert("G", Imf::Slice(
                                    pixelType,
                                    const_cast<char *>(base + 1 * bytesPerSample),
                                    pixelStride, rowStride));
        frameBuffer.insert("B", Imf::Slice(
                                    pixelType,
                                    const_cast<char *>(base + 2 * bytesPerSample),
                                    pixelStride, rowStride));
        if (channels == 4)
        {
            frameBuffer.insert("A", Imf::Slice(
                                        pixelType,
                                        const_cast<char *>(base + 3 * bytesPerSample),
                                        pixelStride, rowStride));
        }

        {
            Imf::OutputFile outFile(ostream, header);
            outFile.setFrameBuffer(frameBuffer);
            outFile.writePixels(height);
        }

        result.timings.encode = emscripten_get_now() - t0;

        // Copy to malloc'd buffer
        t0 = emscripten_get_now();
        size_t outputSize = ostream.size();
        uint8_t *outputPtr = static_cast<uint8_t *>(malloc(outputSize));
        if (!outputPtr)
        {
            result.error = "Failed to allocate output buffer";
            return result;
        }

        std::memcpy(outputPtr, ostream.data(), outputSize);
        result.dataPtr = reinterpret_cast<uintptr_t>(outputPtr);
        result.dataSize = outputSize;

        result.timings.output = emscripten_get_now() - t0;
    }
    catch (const std::exception &e)
    {
        result.error = std::string("EXR encode error: ") + e.what();
        return result;
    }

    result.timings.total = emscripten_get_now() - tStart;

    return result;
}

// ============================================================================
// Emscripten bindings
// ============================================================================

EMSCRIPTEN_BINDINGS(exr_encoder)
{
    value_object<EncodeOptions>("EncodeOptions")
        .field("compression", &EncodeOptions::compression)
        .field("dataType", &EncodeOptions::dataType)
        .field("colorSpace", &EncodeOptions::colorSpace)
        .field("maxThreads", &EncodeOptions::maxThreads);

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
