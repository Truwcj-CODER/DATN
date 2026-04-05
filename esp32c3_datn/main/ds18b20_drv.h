#pragma once

#include "esp_err.h"

/**
 * @brief Khởi tạo OneWire bus (RMT) và tìm thiết bị DS18B20 đầu tiên.
 *
 * @return ESP_OK          – tìm thấy sensor
 * @return ESP_ERR_NOT_FOUND – không phát hiện DS18B20 trên bus
 */
esp_err_t ds18b20_drv_init(void);

/**
 * @brief Trigger chuyển đổi nhiệt độ (12-bit) rồi đọc kết quả.
 *        Hàm sẽ block ~800 ms trong khi chờ chuyển đổi.
 *
 * @param[out] temperature_c  Nhiệt độ (°C)
 * @return ESP_OK | ESP_ERR_INVALID_STATE | lỗi OneWire
 */
esp_err_t ds18b20_drv_read_temp(float *temperature_c);
