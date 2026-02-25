cmake_minimum_required(VERSION 3.20)
project(img_process_wasm CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Path to directory containing stb_image_resize2.h (set by build script)
set(STB_INCLUDE "" CACHE PATH "Path to directory containing stb_image_resize2.h")

# Common Emscripten link flags
set(COMMON_LINK_FLAGS
    "-s WASM=1"
    "-s MODULARIZE=1"
    "-s EXPORT_ES6=1"
    "-s ALLOW_MEMORY_GROWTH=1"
    "-s INITIAL_MEMORY=16777216"
    "-s MAXIMUM_MEMORY=2147483648"
    "-s NO_FILESYSTEM=1"
    "-s ENVIRONMENT='web,worker'"
    "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPU8']"
    "-s DYNAMIC_EXECUTION=0"
    "-s EXPORTED_FUNCTIONS=['_malloc','_free']"
    "-s EMBIND_STD_STRING_IS_UTF8=0"
    "-s SINGLE_FILE=1"
    "--bind"
    "-msimd128"
    "-O3"
    "-flto"
)

string(REPLACE ";" " " COMMON_LINK_FLAGS_STR "${COMMON_LINK_FLAGS}")

# img_process — single-threaded, all operations (resize, crop, rotate)
add_executable(img_process img_process.cpp)
target_include_directories(img_process PRIVATE ${STB_INCLUDE})
target_compile_options(img_process PRIVATE -O3 -flto -msimd128)
# STB_IMAGE_RESIZE_IMPLEMENTATION instantiates the stb header-only implementation
target_compile_definitions(img_process PRIVATE STB_IMAGE_RESIZE_IMPLEMENTATION)
set_target_properties(img_process PROPERTIES
    LINK_FLAGS "${COMMON_LINK_FLAGS_STR} -s EXPORT_NAME='createImageProcessor' --emit-tsd img_process.d.ts"
    SUFFIX ".js"
)
