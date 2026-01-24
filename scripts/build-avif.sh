#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ROOT_DIR/build"
OUTPUT_DIR="$ROOT_DIR/packages/avif/wasm"
NATIVE_DIR="$ROOT_DIR/native"

# Versions
LIBAVIF_VERSION="v1.1.1"
AOM_VERSION="v3.9.1"
DAV1D_VERSION="1.4.3"

echo "=== jCodecs AVIF WASM Build ==="
echo "Build dir: $BUILD_DIR"
echo "Output dir: $OUTPUT_DIR"

# Check if running in emscripten environment
if ! command -v emcc &> /dev/null; then
    echo "Error: emcc not found. Please run this script inside Emscripten environment."
    echo "You can use: docker run -v \$(pwd):/build -w /build -it emscripten/emsdk:3.1.61 bash scripts/build-avif.sh"
    exit 1
fi

# Install build dependencies if missing
install_deps() {
    local need_install=false

    command -v ninja &> /dev/null || need_install=true
    command -v meson &> /dev/null || need_install=true
    command -v pkg-config &> /dev/null || need_install=true

    if [ "$need_install" = true ]; then
        echo "Installing build dependencies..."
        apt-get update && apt-get install -y --no-install-recommends \
            ninja-build \
            meson \
            nasm \
            pkg-config \
            && rm -rf /var/lib/apt/lists/*
    fi
}

install_deps

mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

# Clone/update native dependencies
clone_or_update() {
    local name=$1
    local url=$2
    local version=$3
    local dir="$NATIVE_DIR/$name"

    if [ -d "$dir" ]; then
        echo "Updating $name..."
        cd "$dir"
        git fetch --tags
        git checkout "$version"
    else
        echo "Cloning $name..."
        git clone "$url" "$dir"
        cd "$dir"
        git checkout "$version"
    fi
}

echo ""
echo "=== Fetching dependencies ==="
mkdir -p "$NATIVE_DIR"

clone_or_update "libavif" "https://github.com/AOMediaCodec/libavif.git" "$LIBAVIF_VERSION"
clone_or_update "aom" "https://aomedia.googlesource.com/aom" "$AOM_VERSION"
clone_or_update "dav1d" "https://code.videolan.org/videolan/dav1d.git" "$DAV1D_VERSION"

# Build libyuv (fetched by libavif)
echo ""
echo "=== Building libyuv ==="
LIBYUV_BUILD_DIR="$BUILD_DIR/libyuv"

# Clean previous build to avoid conflicts
rm -rf "$LIBYUV_BUILD_DIR"
mkdir -p "$LIBYUV_BUILD_DIR"
cd "$LIBYUV_BUILD_DIR"

# Clone libyuv if not exists
if [ ! -d "$NATIVE_DIR/libyuv" ]; then
    git clone https://chromium.googlesource.com/libyuv/libyuv "$NATIVE_DIR/libyuv"
fi

# Use Makefiles for libyuv (Ninja fails due to duplicate target rules in libyuv CMake)
emcmake cmake "$NATIVE_DIR/libyuv" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF

make -j$(nproc) yuv

# Build dav1d (decoder)
echo ""
echo "=== Building dav1d ==="
DAV1D_BUILD_DIR="$BUILD_DIR/dav1d"
mkdir -p "$DAV1D_BUILD_DIR"
cd "$DAV1D_BUILD_DIR"

# Clean previous build
rm -rf "$DAV1D_BUILD_DIR"/*

meson setup "$NATIVE_DIR/dav1d" "$DAV1D_BUILD_DIR" \
    --cross-file="$SCRIPT_DIR/emscripten-cross.txt" \
    --default-library=static \
    --buildtype=release \
    -Denable_tools=false \
    -Denable_tests=false \
    -Denable_examples=false \
    -Dbitdepths='["8","16"]'

ninja

# Skip aom for now - decoder only (dav1d)
# TODO: Add aom encoder support later with proper WASM SIMD configuration
echo ""
echo "=== Skipping aom (encoder) - decoder only build ==="

# Build libavif (decoder only with dav1d)
echo ""
echo "=== Building libavif (decoder only) ==="
LIBAVIF_BUILD_DIR="$BUILD_DIR/libavif"
rm -rf "$LIBAVIF_BUILD_DIR"
mkdir -p "$LIBAVIF_BUILD_DIR"
cd "$LIBAVIF_BUILD_DIR"

# Create pkg-config files for our pre-built libraries
mkdir -p "$BUILD_DIR/pkgconfig"

cat > "$BUILD_DIR/pkgconfig/dav1d.pc" << EOF
prefix=$DAV1D_BUILD_DIR
libdir=\${prefix}/src
includedir=$NATIVE_DIR/dav1d/include

Name: dav1d
Description: AV1 decoder
Version: 1.4.3
Libs: -L\${libdir} -ldav1d
Cflags: -I\${includedir} -I$DAV1D_BUILD_DIR/include/dav1d
EOF

export PKG_CONFIG_PATH="$BUILD_DIR/pkgconfig"

# Use SYSTEM to find our pre-built dav1d via pkg-config
# Also pass explicit paths as fallback
# Disable libyuv to simplify (not strictly required)
emcmake cmake "$NATIVE_DIR/libavif" \
    -DCMAKE_BUILD_TYPE=Release \
    -DAVIF_CODEC_AOM=OFF \
    -DAVIF_CODEC_DAV1D=SYSTEM \
    -DDAV1D_LIBRARY="$DAV1D_BUILD_DIR/src/libdav1d.a" \
    -DDAV1D_INCLUDE_DIR="$NATIVE_DIR/dav1d/include;$DAV1D_BUILD_DIR/include/dav1d" \
    -DAVIF_LIBYUV=OFF \
    -DAVIF_BUILD_APPS=OFF \
    -DAVIF_BUILD_TESTS=OFF \
    -DAVIF_ENABLE_WERROR=OFF \
    -DBUILD_SHARED_LIBS=OFF \
    -G Ninja

ninja

# Build WASM modules
echo ""
echo "=== Building WASM modules ==="
WASM_BUILD_DIR="$BUILD_DIR/wasm"
mkdir -p "$WASM_BUILD_DIR"
cd "$WASM_BUILD_DIR"

# Decoder only build (no aom/encoder)
emcmake cmake "$ROOT_DIR/packages/avif/src/wasm" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_ENCODER=OFF \
    -DBUILD_MT=OFF \
    -DLIBAVIF_LIB="$LIBAVIF_BUILD_DIR/libavif.a" \
    -DLIBAVIF_INCLUDE="$NATIVE_DIR/libavif/include" \
    -DDAV1D_LIB="$DAV1D_BUILD_DIR/src/libdav1d.a" \
    -DDAV1D_INCLUDE="$NATIVE_DIR/dav1d/include;$DAV1D_BUILD_DIR/include/dav1d" \
    -G Ninja

ninja

# Copy outputs
echo ""
echo "=== Copying outputs ==="
cp avif_dec.js avif_dec.wasm "$OUTPUT_DIR/"

# Encoder (if built)
if [ -f avif_enc.js ]; then
    cp avif_enc.js avif_enc.wasm "$OUTPUT_DIR/"
fi

# Multi-threaded versions (if built)
if [ -f avif_dec_mt.js ]; then
    cp avif_dec_mt.js avif_dec_mt.wasm avif_dec_mt.worker.js "$OUTPUT_DIR/" 2>/dev/null || true
fi
if [ -f avif_enc_mt.js ]; then
    cp avif_enc_mt.js avif_enc_mt.wasm avif_enc_mt.worker.js "$OUTPUT_DIR/" 2>/dev/null || true
fi

echo ""
echo "=== Build complete! ==="
echo "WASM files are in: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"
