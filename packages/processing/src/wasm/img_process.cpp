#include <cstdlib>
#include <cstring>
#include <string>
#include <emscripten/bind.h>

// stb_image_resize2.h — header-only, implementation instantiated via compile definition
#include "stb_image_resize2.h"

// ============================================================================
// Result type
// ============================================================================

struct ProcessResult {
  uintptr_t dataPtr = 0;
  size_t    dataSize = 0;
  std::string error;
};

// ============================================================================
// Helpers
// ============================================================================

static stbir_datatype parseDataType(const std::string& dt) {
  if (dt == "uint8")   return STBIR_TYPE_UINT8_SRGB;
  if (dt == "uint16")  return STBIR_TYPE_UINT16;
  if (dt == "float16") return STBIR_TYPE_HALF_FLOAT;
  if (dt == "float32") return STBIR_TYPE_FLOAT;
  return STBIR_TYPE_UINT8_SRGB;
}

static stbir_filter parseFilter(const std::string& alg) {
  if (alg == "mitchell") return STBIR_FILTER_MITCHELL;
  if (alg == "lanczos3") return STBIR_FILTER_CATMULLROM; // stb v2 has no Lanczos; Catmull-Rom is the closest high-quality filter
  if (alg == "bilinear") return STBIR_FILTER_TRIANGLE;
  return STBIR_FILTER_DEFAULT;
}

static stbir_pixel_layout parseLayout(uint32_t numCh, const std::string& alpha) {
  const bool isPM     = (alpha == "premultiplied");
  const bool straight = (alpha == "straight");

  if (numCh == 1) return STBIR_1CHANNEL;
  if (numCh == 2) {
    if (isPM)     return STBIR_RA_PM;
    if (straight) return STBIR_RA;
    return STBIR_2CHANNEL;
  }
  if (numCh == 3) return STBIR_RGB;
  // numCh == 4
  if (isPM)     return STBIR_RGBA_PM;
  if (straight) return STBIR_RGBA;
  return STBIR_4CHANNEL;
}

static size_t bytesPerElem(const std::string& dt) {
  if (dt == "uint16" || dt == "float16") return 2;
  if (dt == "float32")                   return 4;
  return 1; // uint8
}

// ============================================================================
// resize
// ============================================================================

ProcessResult resize(
  uintptr_t   inputPtr,
  size_t      /*inputSize*/,
  uint32_t    srcW,
  uint32_t    srcH,
  uint32_t    dstW,
  uint32_t    dstH,
  uint32_t    numChannels,
  std::string dataTypeStr,
  std::string algorithmStr,
  std::string alphaStr
) {
  ProcessResult result;

  const stbir_datatype   dtype  = parseDataType(dataTypeStr);
  const stbir_pixel_layout layout = parseLayout(numChannels, alphaStr);
  const stbir_filter     filter = parseFilter(algorithmStr);
  const size_t           bpe    = bytesPerElem(dataTypeStr);

  const size_t outSize = static_cast<size_t>(dstW) * dstH * numChannels * bpe;
  void* dst = malloc(outSize);
  if (!dst) {
    result.error = "resize: malloc failed";
    return result;
  }

  const void* src   = reinterpret_cast<const void*>(inputPtr);
  const int inStride  = static_cast<int>(srcW * numChannels * bpe);
  const int outStride = static_cast<int>(dstW * numChannels * bpe);

  STBIR_RESIZE info;
  stbir_resize_init(&info, src, srcW, srcH, inStride,
                    dst, dstW, dstH, outStride, layout, dtype);
  stbir_set_filters(&info, filter, STBIR_FILTER_DEFAULT);

  if (!stbir_resize_extended(&info)) {
    free(dst);
    result.error = "resize: stbir_resize_extended failed";
    return result;
  }

  result.dataPtr  = reinterpret_cast<uintptr_t>(dst);
  result.dataSize = outSize;
  return result;
}

// ============================================================================
// crop
// ============================================================================

ProcessResult crop(
  uintptr_t inputPtr,
  uint32_t  srcW,
  uint32_t  srcH,
  uint32_t  numChannels,
  uint32_t  x,
  uint32_t  y,
  uint32_t  cropW,
  uint32_t  cropH,
  uint32_t  bytesPerElement
) {
  ProcessResult result;

  if (x + cropW > srcW || y + cropH > srcH) {
    result.error = "crop: region out of bounds";
    return result;
  }
  if (cropW == 0 || cropH == 0) {
    result.error = "crop: zero-size region";
    return result;
  }

  const size_t pixBytes  = static_cast<size_t>(numChannels) * bytesPerElement;
  const size_t srcStride = static_cast<size_t>(srcW)  * pixBytes;
  const size_t dstStride = static_cast<size_t>(cropW) * pixBytes;
  const size_t outSize   = static_cast<size_t>(cropH) * dstStride;
  const size_t xOffset   = static_cast<size_t>(x) * pixBytes;

  uint8_t* dst = static_cast<uint8_t*>(malloc(outSize));
  if (!dst) {
    result.error = "crop: malloc failed";
    return result;
  }

  const uint8_t* src = reinterpret_cast<const uint8_t*>(inputPtr);

  for (uint32_t row = 0; row < cropH; ++row) {
    const uint8_t* srcRow = src + (static_cast<size_t>(y + row) * srcStride) + xOffset;
    uint8_t*       dstRow = dst + row * dstStride;
    memcpy(dstRow, srcRow, dstStride);
  }

  result.dataPtr  = reinterpret_cast<uintptr_t>(dst);
  result.dataSize = outSize;
  return result;
}

// ============================================================================
// rotate
// ============================================================================

ProcessResult rotate(
  uintptr_t inputPtr,
  uint32_t  srcW,
  uint32_t  srcH,
  uint32_t  numChannels,
  uint32_t  degrees,
  uint32_t  bytesPerElement
) {
  ProcessResult result;

  if (degrees != 90 && degrees != 180 && degrees != 270) {
    result.error = "rotate: degrees must be 90, 180, or 270";
    return result;
  }

  // Output dimensions: 90/270 swap W and H
  const uint32_t dstW = (degrees == 90 || degrees == 270) ? srcH : srcW;
  const uint32_t dstH = (degrees == 90 || degrees == 270) ? srcW : srcH;

  const size_t pixBytes = static_cast<size_t>(numChannels) * bytesPerElement;
  const size_t outSize  = static_cast<size_t>(dstW) * dstH * pixBytes;

  uint8_t* dst = static_cast<uint8_t*>(malloc(outSize));
  if (!dst) {
    result.error = "rotate: malloc failed";
    return result;
  }

  const uint8_t* src = reinterpret_cast<const uint8_t*>(inputPtr);

  if (degrees == 90) {
    // 90° CW: src(srcY, srcX) → dst(dstY=srcX, dstX=srcH-1-srcY)
    // dstW=srcH, dstH=srcW
    for (uint32_t srcY = 0; srcY < srcH; ++srcY) {
      for (uint32_t srcX = 0; srcX < srcW; ++srcX) {
        const uint32_t dstY = srcX;
        const uint32_t dstX = srcH - 1 - srcY;
        const uint8_t* s = src + (static_cast<size_t>(srcY) * srcW + srcX) * pixBytes;
        uint8_t*       d = dst + (static_cast<size_t>(dstY) * dstW + dstX) * pixBytes;
        memcpy(d, s, pixBytes);
      }
    }
  } else if (degrees == 180) {
    // 180°: src(srcY, srcX) → dst(srcH-1-srcY, srcW-1-srcX)
    for (uint32_t srcY = 0; srcY < srcH; ++srcY) {
      for (uint32_t srcX = 0; srcX < srcW; ++srcX) {
        const uint32_t dstY = srcH - 1 - srcY;
        const uint32_t dstX = srcW - 1 - srcX;
        const uint8_t* s = src + (static_cast<size_t>(srcY) * srcW + srcX) * pixBytes;
        uint8_t*       d = dst + (static_cast<size_t>(dstY) * dstW + dstX) * pixBytes;
        memcpy(d, s, pixBytes);
      }
    }
  } else {
    // 270° CW (= 90° CCW): src(srcY, srcX) → dst(dstY=srcW-1-srcX, dstX=srcY)
    // dstW=srcH, dstH=srcW
    for (uint32_t srcY = 0; srcY < srcH; ++srcY) {
      for (uint32_t srcX = 0; srcX < srcW; ++srcX) {
        const uint32_t dstY = srcW - 1 - srcX;
        const uint32_t dstX = srcY;
        const uint8_t* s = src + (static_cast<size_t>(srcY) * srcW + srcX) * pixBytes;
        uint8_t*       d = dst + (static_cast<size_t>(dstY) * dstW + dstX) * pixBytes;
        memcpy(d, s, pixBytes);
      }
    }
  }

  result.dataPtr  = reinterpret_cast<uintptr_t>(dst);
  result.dataSize = outSize;
  return result;
}

// ============================================================================
// Embind bindings
// ============================================================================

EMSCRIPTEN_BINDINGS(img_process) {
  emscripten::value_object<ProcessResult>("ProcessResult")
    .field("dataPtr",  &ProcessResult::dataPtr)
    .field("dataSize", &ProcessResult::dataSize)
    .field("error",    &ProcessResult::error);

  emscripten::function("resize", &resize);
  emscripten::function("crop",   &crop);
  emscripten::function("rotate", &rotate);
}
