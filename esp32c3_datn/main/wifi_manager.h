#pragma once

#include "esp_err.h"
#include <stdbool.h>

/**
 * @brief Khởi tạo WiFi STA, kết nối WPA2, chờ IP (tối đa ~10 s).
 *        Sau khi có IP, tự động sync NTP và cập nhật DS3231.
 *        Hàm trả về ESP_OK ngay cả khi WiFi thất bại (offline mode).
 */
esp_err_t wifi_manager_init(void);

/**
 * @brief Kiểm tra trạng thái kết nối hiện tại.
 */
bool wifi_manager_is_connected(void);

/**
 * @brief Thử kết nối lại WiFi (reset retry counter).
 *        Không block – kết quả sẽ phản ánh qua wifi_manager_is_connected().
 */
void wifi_manager_reconnect(void);
