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

# === AVIF: libavif + dav1d decoder ===
FROM common AS avif-build

ARG LIBAVIF_VERSION=v1.3.0
ARG DAV1D_VERSION=1.5.3

# Clone sources
WORKDIR /src
RUN git clone --depth 1 --branch ${DAV1D_VERSION} https://code.videolan.org/videolan/dav1d.git
RUN git clone --depth 1 --branch ${LIBAVIF_VERSION} https://github.com/AOMediaCodec/libavif.git

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

# Build libavif (decoder only)
WORKDIR /build/libavif

# Create pkg-config for dav1d
RUN mkdir -p /build/pkgconfig && \
    echo "prefix=/build/dav1d" > /build/pkgconfig/dav1d.pc && \
    echo "libdir=\${prefix}/src" >> /build/pkgconfig/dav1d.pc && \
    echo "includedir=/src/dav1d/include" >> /build/pkgconfig/dav1d.pc && \
    echo "" >> /build/pkgconfig/dav1d.pc && \
    echo "Name: dav1d" >> /build/pkgconfig/dav1d.pc && \
    echo "Description: AV1 decoder" >> /build/pkgconfig/dav1d.pc && \
    echo "Version: ${DAV1D_VERSION}" >> /build/pkgconfig/dav1d.pc && \
    echo "Libs: -L\${libdir} -ldav1d" >> /build/pkgconfig/dav1d.pc && \
    echo "Cflags: -I\${includedir} -I/build/dav1d/include/dav1d" >> /build/pkgconfig/dav1d.pc

ENV PKG_CONFIG_PATH=/build/pkgconfig

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

# Copy WASM source and build
COPY packages/avif/src/wasm /src/avif-wasm

WORKDIR /build/avif-wasm
RUN emcmake cmake /src/avif-wasm \
    -DCMAKE_BUILD_TYPE=Release \
    -DLIBAVIF_LIB="/build/libavif/libavif.a" \
    -DLIBAVIF_INCLUDE="/src/libavif/include" \
    -DDAV1D_LIB="/build/dav1d/src/libdav1d.a" \
    -DDAV1D_INCLUDE="/src/dav1d/include;/build/dav1d/include/dav1d" \
    -DLIBYUV_LIB="/build/libyuv/libyuv.a" \
    -DBUILD_MT=ON \
    -G Ninja \
    && ninja

# === AVIF: Output stage (only artifacts) ===
FROM scratch AS avif
COPY --from=avif-build /build/avif-wasm/avif_dec.js /
COPY --from=avif-build /build/avif-wasm/avif_dec.wasm /
COPY --from=avif-build /build/avif-wasm/avif_dec_mt.js /
COPY --from=avif-build /build/avif-wasm/avif_dec_mt.wasm /

# === JXL: (placeholder for future) ===
# FROM common AS jxl-build
# ...
# FROM scratch AS jxl
# ...
