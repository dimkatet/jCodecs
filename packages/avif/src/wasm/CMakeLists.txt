cmake_minimum_required(VERSION 3.20)
project(avif_wasm CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Build options
option(BUILD_ENCODER "Build encoder (requires aom)" OFF)
option(BUILD_MT "Build multi-threaded versions" OFF)

# Max threads for multi-threaded builds (must match PTHREAD_POOL_SIZE)
set(MAX_THREADS 8 CACHE STRING "Maximum number of threads for MT builds")

# Paths to pre-built native libraries (set by build script)
set(LIBAVIF_DEC_LIB "" CACHE PATH "Path to libavif.a (decoder, built with dav1d)")
set(LIBAVIF_ENC_LIB "" CACHE PATH "Path to libavif.a (encoder, built with aom)")
set(DAV1D_LIB "" CACHE PATH "Path to libdav1d.a")
set(AOM_LIB "" CACHE PATH "Path to libaom.a")
set(LIBYUV_LIB "" CACHE PATH "Path to libyuv.a (optional)")
set(LIBAVIF_INCLUDE "" CACHE PATH "Path to libavif includes")
set(DAV1D_INCLUDE "" CACHE PATH "Path to dav1d includes")
set(AOM_INCLUDE "" CACHE PATH "Path to aom includes")

# Common Emscripten flags
set(COMMON_LINK_FLAGS
    "-s WASM=1"
    "-s MODULARIZE=1"
    "-s EXPORT_ES6=1"
    "-s ALLOW_MEMORY_GROWTH=1"
    "-s INITIAL_MEMORY=33554432"
    "-s MAXIMUM_MEMORY=2147483648"
    "-s NO_FILESYSTEM=1"
    "-s ENVIRONMENT='web,worker'"
    "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPU8','HEAPU16']"
    "-s DYNAMIC_EXECUTION=0"
    "-s EXPORTED_FUNCTIONS=['_malloc','_free']"
    "-s EMBIND_STD_STRING_IS_UTF8=0"
    "-s SINGLE_FILE=1"
    "--bind"
    "-msimd128"
    "-O3"
    "-flto"
)

# Multithreaded flags
set(MT_FLAGS
    "-pthread"
    "-s USE_PTHREADS=1"
    "-s PTHREAD_POOL_SIZE=${MAX_THREADS}"
)

string(REPLACE ";" " " COMMON_LINK_FLAGS_STR "${COMMON_LINK_FLAGS}")
string(REPLACE ";" " " MT_FLAGS_STR "${MT_FLAGS}")

# Helper to add optional libyuv
function(add_optional_libyuv target)
    if(LIBYUV_LIB AND EXISTS "${LIBYUV_LIB}")
        target_link_libraries(${target} ${LIBYUV_LIB})
    endif()
endfunction()

# --- Decoder (single-threaded) ---
add_executable(avif_dec avif_dec.cpp)
target_include_directories(avif_dec PRIVATE
    ${LIBAVIF_INCLUDE}
    ${DAV1D_INCLUDE}
)
target_compile_options(avif_dec PRIVATE -O3 -flto -msimd128)
set_target_properties(avif_dec PROPERTIES
    LINK_FLAGS "${COMMON_LINK_FLAGS_STR} -s EXPORT_NAME='createAVIFDecoder' --emit-tsd avif_dec.d.ts"
    SUFFIX ".js"
)
target_link_libraries(avif_dec
    ${LIBAVIF_DEC_LIB}
    ${DAV1D_LIB}
)
add_optional_libyuv(avif_dec)

# --- Decoder (multi-threaded) ---
if(BUILD_MT)
    add_executable(avif_dec_mt avif_dec.cpp)
    target_include_directories(avif_dec_mt PRIVATE
        ${LIBAVIF_INCLUDE}
        ${DAV1D_INCLUDE}
    )
    target_compile_options(avif_dec_mt PRIVATE -O3 -flto -pthread)
    target_compile_definitions(avif_dec_mt PRIVATE MAX_THREADS=${MAX_THREADS})
    set_target_properties(avif_dec_mt PROPERTIES
        LINK_FLAGS "${COMMON_LINK_FLAGS_STR} ${MT_FLAGS_STR} -s EXPORT_NAME='createAVIFDecoderMT' --emit-tsd avif_dec_mt.d.ts"
        SUFFIX ".js"
    )
    target_link_libraries(avif_dec_mt
        ${LIBAVIF_DEC_LIB}
        ${DAV1D_LIB}
    )
    add_optional_libyuv(avif_dec_mt)
endif()

# --- Encoder (single-threaded only for now) ---
if(BUILD_ENCODER)
    add_executable(avif_enc avif_enc.cpp)
    target_include_directories(avif_enc PRIVATE
        ${LIBAVIF_INCLUDE}
        ${AOM_INCLUDE}
    )
    target_compile_options(avif_enc PRIVATE -O3 -flto -msimd128)
    set_target_properties(avif_enc PROPERTIES
        LINK_FLAGS "${COMMON_LINK_FLAGS_STR} -s EXPORT_NAME='createAVIFEncoder' --emit-tsd avif_enc.d.ts"
        SUFFIX ".js"
    )
    target_link_libraries(avif_enc
        ${LIBAVIF_ENC_LIB}
        ${AOM_LIB}
    )
    add_optional_libyuv(avif_enc)

    if(BUILD_MT)
        add_executable(avif_enc_mt avif_enc.cpp)
        target_include_directories(avif_enc_mt PRIVATE
            ${LIBAVIF_INCLUDE}
            ${AOM_INCLUDE}
        )
        target_compile_options(avif_enc_mt PRIVATE -O3 -flto -pthread)
        target_compile_definitions(avif_enc_mt PRIVATE MAX_THREADS=${MAX_THREADS})
        set_target_properties(avif_enc_mt PROPERTIES
            LINK_FLAGS "${COMMON_LINK_FLAGS_STR} ${MT_FLAGS_STR} -s EXPORT_NAME='createAVIFEncoderMT' -s STACK_SIZE=131072 --emit-tsd avif_enc_mt.d.ts"
            SUFFIX ".js"
        )
        target_link_libraries(avif_enc_mt
            ${LIBAVIF_ENC_LIB}
            ${AOM_LIB}
        )
        add_optional_libyuv(avif_enc_mt)
    endif()
endif()
