#pragma once

#include "esp_err.h"

/**
 * @brief Khởi tạo ADC1 channel cho cảm biến ẩm đất điện dung v2.1D.
 *        Dùng ADC Oneshot API + curve-fitting calibration (ESP-IDF v5.x).
 */
esp_err_t soil_adc_init(void);

/**
 * @brief Đọc độ ẩm đất và quy đổi sang phần trăm (0–100%).
 *
 * Ánh xạ tuyến tính:
 *   SOIL_DRY_MV → 0 %   (sensor trong không khí)
 *   SOIL_WET_MV → 100 % (sensor ngập nước)
 *
 * @param[out] moisture_pct  Độ ẩm đất (%)
 * @return ESP_OK hoặc mã lỗi ADC
 */
esp_err_t soil_adc_read_moisture(float *moisture_pct);
