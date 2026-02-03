cmake_minimum_required(VERSION 3.20)
project(jxl_wasm CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Build options
option(BUILD_MT "Build multi-threaded versions" OFF)

# Max threads for multi-threaded builds (must match PTHREAD_POOL_SIZE)
set(MAX_THREADS 8 CACHE STRING "Maximum number of threads for MT builds")

# Paths to pre-built native libraries (set by build script)
set(LIBJXL_LIB "" CACHE PATH "Path to libjxl.a")
set(LIBJXL_THREADS_LIB "" CACHE PATH "Path to libjxl_threads.a")
set(LIBJXL_CMS_LIB "" CACHE PATH "Path to libjxl_cms.a")
set(HWY_LIB "" CACHE PATH "Path to libhwy.a")
set(BROTLI_ENC_LIB "" CACHE PATH "Path to libbrotlienc.a")
set(BROTLI_DEC_LIB "" CACHE PATH "Path to libbrotlidec.a")
set(BROTLI_COMMON_LIB "" CACHE PATH "Path to libbrotlicommon.a")
set(LIBJXL_INCLUDE "" CACHE PATH "Path to libjxl includes")
set(LIBYUV_LIB "" CACHE PATH "Path to libyuv.a (optional)")

# Common Emscripten flags (same as AVIF)
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

# Common JXL libraries (order matters for static linking)
set(JXL_COMMON_LIBS
    ${LIBJXL_LIB}
    ${LIBJXL_CMS_LIB}
    ${HWY_LIB}
    ${BROTLI_ENC_LIB}
    ${BROTLI_DEC_LIB}
    ${BROTLI_COMMON_LIB}
)

# Helper to add optional libyuv
function(add_optional_libyuv target)
    if(LIBYUV_LIB AND EXISTS "${LIBYUV_LIB}")
        target_link_libraries(${target} ${LIBYUV_LIB})
    endif()
endfunction()

# --- Decoder (single-threaded) ---
add_executable(jxl_dec jxl_dec.cpp)
target_include_directories(jxl_dec PRIVATE ${LIBJXL_INCLUDE})
target_compile_options(jxl_dec PRIVATE -O3 -flto -msimd128)
set_target_properties(jxl_dec PROPERTIES
    LINK_FLAGS "${COMMON_LINK_FLAGS_STR} -s EXPORT_NAME='createJXLDecoder' --emit-tsd jxl_dec.d.ts"
    SUFFIX ".js"
)
target_link_libraries(jxl_dec ${JXL_COMMON_LIBS})
add_optional_libyuv(jxl_dec)

# --- Decoder (multi-threaded) ---
if(BUILD_MT)
    add_executable(jxl_dec_mt jxl_dec.cpp)
    target_include_directories(jxl_dec_mt PRIVATE ${LIBJXL_INCLUDE})
    target_compile_options(jxl_dec_mt PRIVATE -O3 -flto -pthread)
    target_compile_definitions(jxl_dec_mt PRIVATE MAX_THREADS=${MAX_THREADS})
    set_target_properties(jxl_dec_mt PROPERTIES
        LINK_FLAGS "${COMMON_LINK_FLAGS_STR} ${MT_FLAGS_STR} -s EXPORT_NAME='createJXLDecoderMT' --emit-tsd jxl_dec_mt.d.ts"
        SUFFIX ".js"
    )
    target_link_libraries(jxl_dec_mt ${JXL_COMMON_LIBS} ${LIBJXL_THREADS_LIB})
    add_optional_libyuv(jxl_dec_mt)
endif()

# --- Encoder (single-threaded) ---
add_executable(jxl_enc jxl_enc.cpp)
target_include_directories(jxl_enc PRIVATE ${LIBJXL_INCLUDE})
target_compile_options(jxl_enc PRIVATE -O3 -flto -msimd128)
set_target_properties(jxl_enc PROPERTIES
    LINK_FLAGS "${COMMON_LINK_FLAGS_STR} -s EXPORT_NAME='createJXLEncoder' --emit-tsd jxl_enc.d.ts"
    SUFFIX ".js"
)
target_link_libraries(jxl_enc ${JXL_COMMON_LIBS})
add_optional_libyuv(jxl_enc)

# --- Encoder (multi-threaded) ---
if(BUILD_MT)
    add_executable(jxl_enc_mt jxl_enc.cpp)
    target_include_directories(jxl_enc_mt PRIVATE ${LIBJXL_INCLUDE})
    target_compile_options(jxl_enc_mt PRIVATE -O3 -flto -pthread)
    target_compile_definitions(jxl_enc_mt PRIVATE MAX_THREADS=${MAX_THREADS})
    set_target_properties(jxl_enc_mt PROPERTIES
        LINK_FLAGS "${COMMON_LINK_FLAGS_STR} ${MT_FLAGS_STR} -s EXPORT_NAME='createJXLEncoderMT' -s STACK_SIZE=131072 --emit-tsd jxl_enc_mt.d.ts"
        SUFFIX ".js"
    )
    target_link_libraries(jxl_enc_mt ${JXL_COMMON_LIBS} ${LIBJXL_THREADS_LIB})
    add_optional_libyuv(jxl_enc_mt)
endif()
