#pragma once

#include <stdbool.h>

/**
 * @brief Snapshot dữ liệu từ tất cả sensor trong một chu kỳ đọc.
 */
typedef struct {
    float humidity;           ///< Độ ẩm không khí (%) – DHT22
    float atmospheric_temp;   ///< Nhiệt độ không khí (°C) – DHT22
    float soil_temp;          ///< Nhiệt độ đất (°C) – DS18B20
    float soil_moisture;      ///< Độ ẩm đất (%) – Cảm biến điện dung v2.1D
    float water_flow;         ///< Lưu lượng nước (L/min) – không có sensor: 0.0
    char  timestamp[32];      ///< ISO-8601 "2026-04-05T14:30:00+07:00" từ DS3231
    bool  valid;              ///< true nếu ít nhất một sensor đọc thành công
} sensor_data_t;
