#pragma once

#include "esp_err.h"
#include "sensor_types.h"

/**
 * @brief Gửi dữ liệu sensor lên backend qua HTTP POST.
 *
 * POST http://SERVER_HOST:SERVER_PORT/api/sensor/push
 * Body: JSON với các trường Humidity, Atmospheric_Temp, Soil_Temp,
 *       Soil_Moisture, Water_Flow, device_id.
 *
 * @param[in] data  Con trỏ đến sensor_data_t hợp lệ
 * @return ESP_OK nếu server phản hồi HTTP 200
 */
esp_err_t http_post_sensor_data(const sensor_data_t *data);
