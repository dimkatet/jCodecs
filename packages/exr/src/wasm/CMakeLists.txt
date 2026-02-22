cmake_minimum_required(VERSION 3.20)
project(exr_wasm CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Build options
option(BUILD_MT "Build multi-threaded versions" OFF)

# Max threads for multi-threaded builds (must match PTHREAD_POOL_SIZE)
set(MAX_THREADS 8 CACHE STRING "Maximum number of threads for MT builds")

# Paths to pre-built native libraries (set by build script)
set(OPENEXR_LIB "" CACHE PATH "Path to libOpenEXR.a")
set(OPENEXR_CORE_LIB "" CACHE PATH "Path to libOpenEXRCore.a")
set(OPENEXR_UTIL_LIB "" CACHE PATH "Path to libOpenEXRUtil.a")
set(ILMTHREAD_LIB "" CACHE PATH "Path to libIlmThread.a")
set(IEX_LIB "" CACHE PATH "Path to libIex.a")
set(IMATH_LIB "" CACHE PATH "Path to libImath.a")
set(OPENEXR_INCLUDE "" CACHE PATH "Path to OpenEXR includes")
set(IMATH_INCLUDE "" CACHE PATH "Path to Imath includes")

# jCodecs core library (ImageDescriptor + descriptor-embind.cpp)
set(JCODECS_CORE_LIB "" CACHE PATH "Path to libjcodecs_core.a")
set(JCODECS_CORE_INCLUDE "" CACHE PATH "Path to jcodecs core wasm descriptor includes")

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
    "-s USE_ZLIB=1"
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

# Common OpenEXR libraries (order matters for static linking)
set(EXR_COMMON_LIBS
    ${OPENEXR_LIB}
    ${OPENEXR_CORE_LIB}
    ${ILMTHREAD_LIB}
    ${IEX_LIB}
    ${IMATH_LIB}
)

# Helper to add optional OpenEXRUtil
function(add_optional_exrutil target)
    if(OPENEXR_UTIL_LIB AND EXISTS "${OPENEXR_UTIL_LIB}")
        target_link_libraries(${target} ${OPENEXR_UTIL_LIB})
    endif()
endfunction()

# Include directories for all targets
set(EXR_INCLUDES ${OPENEXR_INCLUDE} ${IMATH_INCLUDE})

# --- Decoder (single-threaded) ---
add_executable(exr_dec exr_dec.cpp ${JCODECS_CORE_INCLUDE}/descriptor-embind.cpp)
target_include_directories(exr_dec PRIVATE ${EXR_INCLUDES} ${JCODECS_CORE_INCLUDE})
target_compile_options(exr_dec PRIVATE -O3 -flto -msimd128)
set_target_properties(exr_dec PROPERTIES
    LINK_FLAGS "${COMMON_LINK_FLAGS_STR} -s EXPORT_NAME='createEXRDecoder' --emit-tsd exr_dec.d.ts"
    SUFFIX ".js"
)
target_link_libraries(exr_dec ${EXR_COMMON_LIBS} ${JCODECS_CORE_LIB})
add_optional_exrutil(exr_dec)

# --- Decoder (multi-threaded) ---
if(BUILD_MT)
    add_executable(exr_dec_mt exr_dec.cpp ${JCODECS_CORE_INCLUDE}/descriptor-embind.cpp)
    target_include_directories(exr_dec_mt PRIVATE ${EXR_INCLUDES} ${JCODECS_CORE_INCLUDE})
    target_compile_options(exr_dec_mt PRIVATE -O3 -flto -pthread)
    target_compile_definitions(exr_dec_mt PRIVATE MAX_THREADS=${MAX_THREADS})
    set_target_properties(exr_dec_mt PROPERTIES
        LINK_FLAGS "${COMMON_LINK_FLAGS_STR} ${MT_FLAGS_STR} -s EXPORT_NAME='createEXRDecoderMT' --emit-tsd exr_dec_mt.d.ts"
        SUFFIX ".js"
    )
    target_link_libraries(exr_dec_mt ${EXR_COMMON_LIBS} ${JCODECS_CORE_LIB})
    add_optional_exrutil(exr_dec_mt)
endif()

# --- Encoder (single-threaded) ---
add_executable(exr_enc exr_enc.cpp)
target_include_directories(exr_enc PRIVATE ${EXR_INCLUDES})
target_compile_options(exr_enc PRIVATE -O3 -flto -msimd128)
set_target_properties(exr_enc PROPERTIES
    LINK_FLAGS "${COMMON_LINK_FLAGS_STR} -s EXPORT_NAME='createEXREncoder' --emit-tsd exr_enc.d.ts"
    SUFFIX ".js"
)
target_link_libraries(exr_enc ${EXR_COMMON_LIBS})
add_optional_exrutil(exr_enc)

# --- Encoder (multi-threaded) ---
if(BUILD_MT)
    add_executable(exr_enc_mt exr_enc.cpp)
    target_include_directories(exr_enc_mt PRIVATE ${EXR_INCLUDES})
    target_compile_options(exr_enc_mt PRIVATE -O3 -flto -pthread)
    target_compile_definitions(exr_enc_mt PRIVATE MAX_THREADS=${MAX_THREADS})
    set_target_properties(exr_enc_mt PROPERTIES
        LINK_FLAGS "${COMMON_LINK_FLAGS_STR} ${MT_FLAGS_STR} -s EXPORT_NAME='createEXREncoderMT' -s STACK_SIZE=131072 --emit-tsd exr_enc_mt.d.ts"
        SUFFIX ".js"
    )
    target_link_libraries(exr_enc_mt ${EXR_COMMON_LIBS})
    add_optional_exrutil(exr_enc_mt)
endif()
