#pragma once

#include "esp_err.h"

/**
 * @brief Khởi tạo GPIO cho DHT22 (input, pull-up).
 */
esp_err_t dht22_init(void);

/**
 * @brief Đọc nhiệt độ và độ ẩm từ DHT22.
 *
 * Dùng bit-bang với critical section để đảm bảo timing chính xác
 * trên ESP32-C3 (single-core RISC-V).
 *
 * @param[out] temperature  Nhiệt độ (°C)
 * @param[out] humidity     Độ ẩm (%RH)
 * @return ESP_OK | ESP_ERR_TIMEOUT | ESP_ERR_INVALID_CRC
 */
esp_err_t dht22_read(float *temperature, float *humidity);
