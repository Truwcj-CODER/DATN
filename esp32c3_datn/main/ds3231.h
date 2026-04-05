#pragma once

#include "esp_err.h"
#include <time.h>

/**
 * @brief Khởi tạo I2C master bus và thêm device DS3231 (0x68).
 *        Dùng driver I2C master mới (ESP-IDF v5.1+).
 */
esp_err_t ds3231_init(void);

/**
 * @brief Đọc ngày giờ hiện tại từ DS3231.
 *
 * @param[out] dt  Kết quả dạng struct tm (tm_year tính từ 1900)
 */
esp_err_t ds3231_get_datetime(struct tm *dt);

/**
 * @brief Ghi ngày giờ vào DS3231 (thường dùng sau khi sync NTP).
 *
 * @param[in] dt  Thời gian cần ghi (struct tm)
 */
esp_err_t ds3231_set_datetime(const struct tm *dt);

/**
 * @brief Định dạng struct tm thành chuỗi ISO-8601 với offset +07:00.
 *        Ví dụ: "2026-04-05T14:30:00+07:00"
 *
 * @param[in]  dt   Thời gian nguồn
 * @param[out] buf  Buffer đầu ra
 * @param[in]  len  Kích thước buffer (khuyến nghị >= 32)
 */
void ds3231_format_iso8601(const struct tm *dt, char *buf, size_t len);
