# =============================================================================
# jCodecs WASM Build
# Multi-stage Dockerfile for building codec WASM modules
#
# Usage:
#   docker build --target avif --output packages/avif/wasm .
#   docker build --target jxl --output packages/jxl/wasm .
# =============================================================================

# === BASE: Emscripten + build tools ===
FROM emscripten/emsdk:latest AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ninja-build \
    meson \
    nasm \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g typescript

# Meson cross-file for Emscripten
COPY emscripten-cross.txt /opt/emscripten-cross.txt

# === COMMON: Shared dependencies (libyuv) ===
FROM base AS common

ARG LIBYUV_VERSION=main

WORKDIR /src
RUN git clone --depth 1 https://chromium.googlesource.com/libyuv/libyuv

WORKDIR /build/libyuv
RUN emcmake cmake /src/libyuv \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-msimd128" \
    -DCMAKE_CXX_FLAGS="-msimd128" \
    -DBUILD_SHARED_LIBS=OFF \
    && make -j$(nproc) yuv

# === AVIF: libavif + dav1d decoder + aom encoder ===
FROM common AS avif-build

ARG LIBAVIF_VERSION=v1.3.0
ARG DAV1D_VERSION=1.5.3
ARG AOM_VERSION=v3.11.0

# Clone sources
WORKDIR /src
RUN git clone --depth 1 --branch ${DAV1D_VERSION} https://code.videolan.org/videolan/dav1d.git
RUN git clone --depth 1 --branch ${LIBAVIF_VERSION} https://github.com/AOMediaCodec/libavif.git
RUN git clone --depth 1 --branch ${AOM_VERSION} https://aomedia.googlesource.com/aom

# Build dav1d
WORKDIR /build/dav1d
RUN meson setup /src/dav1d . \
    --cross-file=/opt/emscripten-cross.txt \
    --default-library=static \
    --buildtype=release \
    -Denable_tools=false \
    -Denable_tests=false \
    -Denable_examples=false \
    -Dbitdepths='["8","16"]' \
    && ninja

# Build libaom (encoder + decoder, libavif needs both in codec_aom.c)
WORKDIR /build/aom
RUN emcmake cmake /src/aom \
    -DCMAKE_BUILD_TYPE=Release \
    -DAOM_TARGET_CPU=generic \
    -DCONFIG_MULTITHREAD=1 \
    -DENABLE_THREADS=ON \
    -DCMAKE_C_FLAGS="-pthread -s USE_PTHREADS=1" \
    -DCMAKE_CXX_FLAGS="-pthread -s USE_PTHREADS=1" \
    -DCONFIG_RUNTIME_CPU_DETECT=0 \
    -DCONFIG_WEBM_IO=0 \
    -DCONFIG_AV1_DECODER=1 \
    -DCONFIG_AV1_ENCODER=1 \
    -DENABLE_DOCS=0 \
    -DENABLE_TESTS=0 \
    -DENABLE_EXAMPLES=0 \
    -DENABLE_TOOLS=0 \
    -DENABLE_TESTDATA=0 \
    -DBUILD_SHARED_LIBS=OFF \
    -G Ninja \
    && ninja

# Create pkg-config files
RUN mkdir -p /build/pkgconfig && \
    echo "prefix=/build/dav1d" > /build/pkgconfig/dav1d.pc && \
    echo "libdir=\${prefix}/src" >> /build/pkgconfig/dav1d.pc && \
    echo "includedir=/src/dav1d/include" >> /build/pkgconfig/dav1d.pc && \
    echo "" >> /build/pkgconfig/dav1d.pc && \
    echo "Name: dav1d" >> /build/pkgconfig/dav1d.pc && \
    echo "Description: AV1 decoder" >> /build/pkgconfig/dav1d.pc && \
    echo "Version: 1.5.3" >> /build/pkgconfig/dav1d.pc && \
    echo "Libs: -L\${libdir} -ldav1d" >> /build/pkgconfig/dav1d.pc && \
    echo "Cflags: -I\${includedir} -I/build/dav1d/include/dav1d" >> /build/pkgconfig/dav1d.pc

ENV PKG_CONFIG_PATH=/build/pkgconfig

# Build libavif for decoder (dav1d only)
WORKDIR /build/libavif-dec
RUN emcmake cmake /src/libavif \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-pthread" \
    -DCMAKE_CXX_FLAGS="-pthread" \
    -DAVIF_CODEC_AOM=OFF \
    -DAVIF_CODEC_DAV1D=SYSTEM \
    -DDAV1D_LIBRARY="/build/dav1d/src/libdav1d.a" \
    -DDAV1D_INCLUDE_DIR="/src/dav1d/include;/build/dav1d/include/dav1d" \
    -DAVIF_LIBYUV=SYSTEM \
    -DLIBYUV_LIBRARY="/build/libyuv/libyuv.a" \
    -DLIBYUV_INCLUDE_DIR="/src/libyuv/include" \
    -DAVIF_BUILD_APPS=OFF \
    -DAVIF_BUILD_TESTS=OFF \
    -DAVIF_ENABLE_WERROR=OFF \
    -DBUILD_SHARED_LIBS=OFF \
    -G Ninja \
    && ninja

# Build libavif for encoder (aom only)
WORKDIR /build/libavif-enc
RUN emcmake cmake /src/libavif \
    -DCMAKE_C_FLAGS="-pthread" \
    -DCMAKE_CXX_FLAGS="-pthread" \
    -DCMAKE_BUILD_TYPE=Release \
    -DAVIF_CODEC_AOM=SYSTEM \
    -DAOM_LIBRARY="/build/aom/libaom.a" \
    -DAOM_INCLUDE_DIR="/src/aom;/build/aom" \
    -DAVIF_CODEC_DAV1D=OFF \
    -DAVIF_LIBYUV=SYSTEM \
    -DLIBYUV_LIBRARY="/build/libyuv/libyuv.a" \
    -DLIBYUV_INCLUDE_DIR="/src/libyuv/include" \
    -DAVIF_BUILD_APPS=OFF \
    -DAVIF_BUILD_TESTS=OFF \
    -DAVIF_ENABLE_WERROR=OFF \
    -DBUILD_SHARED_LIBS=OFF \
    -G Ninja \
    && ninja

# Copy WASM source and build
COPY packages/avif/src/wasm /src/avif-wasm

WORKDIR /build/avif-wasm
RUN emcmake cmake /src/avif-wasm \
    -DCMAKE_BUILD_TYPE=Release \
    -DLIBAVIF_DEC_LIB="/build/libavif-dec/libavif.a" \
    -DLIBAVIF_ENC_LIB="/build/libavif-enc/libavif.a" \
    -DLIBAVIF_INCLUDE="/src/libavif/include" \
    -DDAV1D_LIB="/build/dav1d/src/libdav1d.a" \
    -DDAV1D_INCLUDE="/src/dav1d/include;/build/dav1d/include/dav1d" \
    -DAOM_LIB="/build/aom/libaom.a" \
    -DAOM_INCLUDE="/src/aom;/build/aom" \
    -DLIBYUV_LIB="/build/libyuv/libyuv.a" \
    -DBUILD_MT=ON \
    -DBUILD_ENCODER=ON \
    -G Ninja \
    && ninja

# === AVIF: Output stage (only artifacts) ===
FROM scratch AS avif
COPY --from=avif-build /build/avif-wasm/avif_dec.js /
COPY --from=avif-build /build/avif-wasm/avif_dec.d.ts /
COPY --from=avif-build /build/avif-wasm/avif_dec_mt.js /
COPY --from=avif-build /build/avif-wasm/avif_dec_mt.d.ts /
COPY --from=avif-build /build/avif-wasm/avif_enc.js /
COPY --from=avif-build /build/avif-wasm/avif_enc.d.ts /
COPY --from=avif-build /build/avif-wasm/avif_enc_mt.js /
COPY --from=avif-build /build/avif-wasm/avif_enc_mt.d.ts /

# === JXL: libjxl encoder/decoder ===
FROM common AS jxl-build

ARG LIBJXL_VERSION=v0.10.3

# Clone libjxl with submodules (highway, brotli, skcms)
WORKDIR /src
RUN git clone --depth 1 --recursive --branch ${LIBJXL_VERSION} https://github.com/libjxl/libjxl.git

# Build libjxl with Emscripten
WORKDIR /build/libjxl
RUN emcmake cmake /src/libjxl \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-pthread -msimd128" \
    -DCMAKE_CXX_FLAGS="-pthread -msimd128" \
    -DBUILD_TESTING=OFF \
    -DJPEGXL_ENABLE_TOOLS=OFF \
    -DJPEGXL_ENABLE_DOXYGEN=OFF \
    -DJPEGXL_ENABLE_MANPAGES=OFF \
    -DJPEGXL_ENABLE_BENCHMARK=OFF \
    -DJPEGXL_ENABLE_EXAMPLES=OFF \
    -DJPEGXL_ENABLE_JNI=OFF \
    -DJPEGXL_ENABLE_SJPEG=OFF \
    -DJPEGXL_ENABLE_OPENEXR=OFF \
    -DJPEGXL_ENABLE_SKCMS=ON \
    -DJPEGXL_ENABLE_VIEWERS=OFF \
    -DJPEGXL_ENABLE_TCMALLOC=OFF \
    -DJPEGXL_BUNDLE_LIBPNG=OFF \
    -DJPEGXL_ENABLE_TRANSCODE_JPEG=OFF \
    -DJPEGXL_STATIC=ON \
    -DJPEGXL_FORCE_SYSTEM_BROTLI=OFF \
    -DJPEGXL_FORCE_SYSTEM_HWY=OFF \
    -G Ninja \
    && ninja jxl jxl_cms jxl_threads

# Copy WASM source and build
COPY packages/jxl/src/wasm /src/jxl-wasm

WORKDIR /build/jxl-wasm
RUN emcmake cmake /src/jxl-wasm \
    -DCMAKE_BUILD_TYPE=Release \
    -DLIBJXL_LIB="/build/libjxl/lib/libjxl.a" \
    -DLIBJXL_THREADS_LIB="/build/libjxl/lib/libjxl_threads.a" \
    -DLIBJXL_CMS_LIB="/build/libjxl/lib/libjxl_cms.a" \
    -DHWY_LIB="/build/libjxl/third_party/highway/libhwy.a" \
    -DBROTLI_ENC_LIB="/build/libjxl/third_party/brotli/libbrotlienc.a" \
    -DBROTLI_DEC_LIB="/build/libjxl/third_party/brotli/libbrotlidec.a" \
    -DBROTLI_COMMON_LIB="/build/libjxl/third_party/brotli/libbrotlicommon.a" \
    -DLIBJXL_INCLUDE="/src/libjxl/lib/include;/build/libjxl/lib/include" \
    -DLIBYUV_LIB="/build/libyuv/libyuv.a" \
    -DBUILD_MT=ON \
    -G Ninja \
    && ninja

# === JXL: Output stage (only artifacts) ===
FROM scratch AS jxl
COPY --from=jxl-build /build/jxl-wasm/jxl_dec.js /
COPY --from=jxl-build /build/jxl-wasm/jxl_dec.d.ts /
COPY --from=jxl-build /build/jxl-wasm/jxl_dec_mt.js /
COPY --from=jxl-build /build/jxl-wasm/jxl_dec_mt.d.ts /
COPY --from=jxl-build /build/jxl-wasm/jxl_enc.js /
COPY --from=jxl-build /build/jxl-wasm/jxl_enc.d.ts /
COPY --from=jxl-build /build/jxl-wasm/jxl_enc_mt.js /
COPY --from=jxl-build /build/jxl-wasm/jxl_enc_mt.d.ts /
