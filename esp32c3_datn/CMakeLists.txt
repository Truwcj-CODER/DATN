cmake_minimum_required(VERSION 3.16)

# ESP-IDF 6.0-dev dùng picolibc thay newlib. CMake test compiler chạy trước
# khi ESP-IDF thêm -specs=picolibc.specs nên linker báo "cannot find -lc".
# STATIC_LIBRARY bỏ qua bước link test, chỉ check compile – đủ để tiếp tục.
set(CMAKE_TRY_COMPILE_TARGET_TYPE "STATIC_LIBRARY")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)

project(esp32c3_datn)
