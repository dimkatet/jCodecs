# ==============================================================================
# jCodecs Core - Image Descriptor Library
# ==============================================================================
#
# Builds static library for Image Descriptor that can be linked by codec packages
# Usage in codec CMakeLists.txt:
#   add_subdirectory(${CORE_DIR}/wasm jcodecs_core)
#   target_link_libraries(avif_dec PRIVATE jcodecs_core)
#

cmake_minimum_required(VERSION 3.20)
project(jcodecs_core CXX)

# C++17 required for std::optional
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ==============================================================================
# Source Files
# ==============================================================================

set(CORE_SOURCES
    descriptor.cpp
)

set(CORE_HEADERS
    descriptor.hpp
)

# ==============================================================================
# Static Library
# ==============================================================================

# Create static library (will be linked into WASM modules)
add_library(jcodecs_core STATIC ${CORE_SOURCES} ${CORE_HEADERS})

# Include directory for dependent targets
target_include_directories(jcodecs_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

# Compiler flags
if(EMSCRIPTEN)
    target_compile_options(jcodecs_core PRIVATE -O3)
endif()

# ==============================================================================
# Embind Bindings (Optional - for standalone testing)
# ==============================================================================

# This is typically included directly in codec modules, but can be built standalone
if(BUILD_STANDALONE_DESCRIPTOR)
    add_executable(jcodecs-descriptor descriptor-embind.cpp)
    target_link_libraries(jcodecs-descriptor PRIVATE jcodecs_core)

    if(EMSCRIPTEN)
        target_compile_options(jcodecs-descriptor PRIVATE -O3)

        set_target_properties(jcodecs-descriptor PROPERTIES
            LINK_FLAGS "\
-lembind \
-s MODULARIZE=1 \
-s EXPORT_ES6=1 \
-s EXPORT_NAME='createDescriptorModule' \
-s ALLOW_MEMORY_GROWTH=1 \
-s ENVIRONMENT=web,worker \
--emit-tsd jcodecs-descriptor.d.ts"
        )
    endif()
endif()

# ==============================================================================
# Installation (for external projects)
# ==============================================================================

install(TARGETS jcodecs_core
    ARCHIVE DESTINATION lib
    LIBRARY DESTINATION lib
)

install(FILES ${CORE_HEADERS}
    DESTINATION include/jcodecs
)
