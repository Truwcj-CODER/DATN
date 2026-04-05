#pragma once

#include "esp_err.h"
#include "sensor_types.h"
#include <stdbool.h>

/**
 * @brief Mount SD card qua SPI và khởi tạo FATFS.
 *        Nếu thất bại, các hàm còn lại trả ESP_ERR_INVALID_STATE
 *        và log offline bị tắt (graceful degradation).
 */
esp_err_t sdcard_logger_init(void);

/**
 * @brief Append một dòng CSV vào SD_OFFLINE_FILE.
 *        Ghi header tự động nếu file chưa tồn tại.
 */
esp_err_t sdcard_logger_append(const sensor_data_t *data);

/**
 * @brief Đọc SD_OFFLINE_FILE, POST từng dòng lên server.
 *        Xóa file nếu tất cả dòng gửi thành công.
 *        Dừng giữa chừng và giữ lại file nếu gặp lỗi HTTP.
 */
esp_err_t sdcard_logger_flush_to_server(void);

/**
 * @brief Kiểm tra xem có file offline đang chờ không.
 */
bool sdcard_logger_has_pending(void);
