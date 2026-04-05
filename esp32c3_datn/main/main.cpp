/*
 * main.cpp – Entry point cho DATN Greenhouse Sensor Node
 *
 * Hardware: ESP32-C3 Mini (custom PCB)
 * Sensors:
 *   • DHT22           – nhiệt độ & độ ẩm không khí   (GPIO4)
 *   • DS18B20         – nhiệt độ đất, OneWire/RMT      (GPIO3)
 *   • Capacitive v2.1D – độ ẩm đất, ADC1_CH2           (GPIO2)
 *   • DS3231          – RTC real-time clock, I2C        (SDA=8, SCL=9)
 *   • SD card         – offline logging, SPI2           (MISO=5,MOSI=6,CLK=7,CS=10)
 *
 * Luồng chính (sensor_task, 30 s/chu kỳ):
 *   đọc sensors → lấy timestamp DS3231
 *   → nếu WiFi OK: flush offline CSV (nếu có) → POST JSON lên backend
 *   → nếu WiFi mất: lưu CSV vào SD card → thử reconnect
 */

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_err.h"

#include "config.h"
#include "sensor_types.h"
#include "dht22.h"
#include "ds18b20_drv.h"
#include "ds3231.h"
#include "soil_adc.h"
#include "wifi_manager.h"
#include "http_poster.h"
#include "sdcard_logger.h"

#include <time.h>

static const char *TAG = "MAIN";

/* ------------------------------------------------------------------ */
/*  Sensor task                                                         */
/* ------------------------------------------------------------------ */

static void sensor_task(void *pv)
{
    ESP_LOGI(TAG, "Sensor task started – interval %d ms", SENSOR_INTERVAL_MS);

    TickType_t last_wake = xTaskGetTickCount();

    while (true) {
        sensor_data_t data = {};
        data.water_flow = 0.0f;    /* không có flow sensor trên PCB */
        data.valid      = false;

        /* ── 1. DHT22 (nhiệt độ & độ ẩm không khí) ─────────────── */
        esp_err_t ret = ESP_FAIL;
        for (int attempt = 1; attempt <= DHT22_RETRY_COUNT; attempt++) {
            ret = dht22_read(&data.atmospheric_temp, &data.humidity);
            if (ret == ESP_OK) break;
            ESP_LOGW(TAG, "DHT22 attempt %d/%d: %s",
                     attempt, DHT22_RETRY_COUNT, esp_err_to_name(ret));
            if (attempt < DHT22_RETRY_COUNT) {
                vTaskDelay(pdMS_TO_TICKS(DHT22_RETRY_DELAY_MS));
            }
        }
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "DHT22 all retries failed – ghi 0.0");
            data.humidity        = 0.0f;
            data.atmospheric_temp = 0.0f;
        }

        /* ── 2. DS18B20 (nhiệt độ đất) ───────────────────────────── */
        ret = ds18b20_drv_read_temp(&data.soil_temp);
        if (ret != ESP_OK) {
            ESP_LOGW(TAG, "DS18B20 failed (%s) – ghi 0.0", esp_err_to_name(ret));
            data.soil_temp = 0.0f;
        }

        /* ── 3. Soil ADC (độ ẩm đất) ─────────────────────────────── */
        ret = soil_adc_read_moisture(&data.soil_moisture);
        if (ret != ESP_OK) {
            ESP_LOGW(TAG, "Soil ADC failed (%s) – ghi 0.0", esp_err_to_name(ret));
            data.soil_moisture = 0.0f;
        }

        /* ── 4. Timestamp: DS3231 → SNTP system time → skip ─────── */
        struct tm dt = {};
        if (ds3231_get_datetime(&dt) == ESP_OK) {
            /* DS3231 valid → dùng trực tiếp */
            ds3231_format_iso8601(&dt, data.timestamp, sizeof(data.timestamp));
        } else {
            /* DS3231 chưa set hoặc lỗi → thử lấy từ system time (SNTP) */
            time_t now = time(NULL);
            /* Kiểm tra SNTP đã sync thành công chưa (API chính thức ESP-IDF) */
            if (esp_sntp_get_sync_status() == SNTP_SYNC_STATUS_COMPLETED) {
                localtime_r(&now, &dt);
                ds3231_format_iso8601(&dt, data.timestamp, sizeof(data.timestamp));
                /* Tranh thủ sync ngược lại vào DS3231 */
                ds3231_set_datetime(&dt);
                ESP_LOGI(TAG, "Timestamp từ SNTP: %s", data.timestamp);
            } else {
                /* Cả hai đều chưa sẵn sàng – bỏ qua chu kỳ này */
                ESP_LOGW(TAG, "Chưa có thời gian hợp lệ (SNTP chưa sync) – bỏ qua");
                /* Chờ thêm 5 s rồi lặp lại – không gửi data rác */
                vTaskDelay(pdMS_TO_TICKS(5000));
                last_wake = xTaskGetTickCount();
                continue;
            }
        }

        data.valid = true;

        ESP_LOGI(TAG,
                 "[%s] Hum=%.1f%%  AirT=%.1f°C  SoilT=%.1f°C  SoilM=%.1f%%",
                 data.timestamp,
                 (double)data.humidity,
                 (double)data.atmospheric_temp,
                 (double)data.soil_temp,
                 (double)data.soil_moisture);

        /* ── 5. Gửi hoặc lưu offline ─────────────────────────────── */
        if (wifi_manager_is_connected()) {
            /* Gửi offline records còn tồn đọng trước */
            if (sdcard_logger_has_pending()) {
                ESP_LOGI(TAG, "Flushing offline records ...");
                sdcard_logger_flush_to_server();
            }
            /* Gửi bản đọc hiện tại */
            if (http_post_sensor_data(&data) != ESP_OK) {
                ESP_LOGW(TAG, "POST failed – lưu offline");
                sdcard_logger_append(&data);
            }
        } else {
            ESP_LOGW(TAG, "WiFi offline – lưu vào SD card");
            sdcard_logger_append(&data);
            wifi_manager_reconnect();   /* thử kết nối lại (non-blocking) */
        }

        /* ── Chờ đến chu kỳ tiếp theo (bù trừ thời gian xử lý) ── */
        vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(SENSOR_INTERVAL_MS));
    }
}

/* ------------------------------------------------------------------ */
/*  app_main                                                            */
/* ------------------------------------------------------------------ */

extern "C" void app_main(void)
{
    ESP_LOGI(TAG, "========================================");
    ESP_LOGI(TAG, " DATN Greenhouse Sensor Node (ESP32-C3)");
    ESP_LOGI(TAG, "========================================");

    /* ── Khởi tạo DS3231 (cần sớm để có timestamp cho log offline) ── */
    if (ds3231_init() != ESP_OK) {
        ESP_LOGE(TAG, "DS3231 init FAILED – tiếp tục không có RTC");
    } else {
        ESP_LOGI(TAG, "[OK] DS3231 RTC");
    }

    /* ── Soil ADC ── */
    if (soil_adc_init() != ESP_OK) {
        ESP_LOGE(TAG, "Soil ADC init FAILED");
    } else {
        ESP_LOGI(TAG, "[OK] Soil ADC (GPIO%d)", (int)SOIL_ADC_CHANNEL);
    }

    /* ── DHT22 ── */
    if (dht22_init() != ESP_OK) {
        ESP_LOGE(TAG, "DHT22 GPIO init FAILED");
    } else {
        ESP_LOGI(TAG, "[OK] DHT22 (GPIO%d)", (int)DHT22_PIN);
    }

    /* ── DS18B20 – non-fatal ── */
    if (ds18b20_drv_init() != ESP_OK) {
        ESP_LOGW(TAG, "[WARN] DS18B20 not found – soil_temp = 0.0");
    } else {
        ESP_LOGI(TAG, "[OK] DS18B20 (GPIO%d)", (int)DS18B20_PIN);
    }

    /* ── SD card – non-fatal ── */
    if (sdcard_logger_init() != ESP_OK) {
        ESP_LOGW(TAG, "[WARN] SD card not available – offline logging disabled");
    } else {
        ESP_LOGI(TAG, "[OK] SD card mounted at " SD_MOUNT_POINT);
    }

    /* ── WiFi – non-fatal (graded offline mode) ── */
    if (wifi_manager_init() != ESP_OK) {
        ESP_LOGW(TAG, "[WARN] WiFi not connected – operating offline");
    } else {
        ESP_LOGI(TAG, "[OK] WiFi connected");
    }

    /* ── Khởi tạo sensor task ── */
    BaseType_t created = xTaskCreate(
        sensor_task,
        "sensor_task",
        8192,   /* stack bytes */
        NULL,
        5,      /* priority */
        NULL);

    if (created != pdPASS) {
        ESP_LOGE(TAG, "FATAL: Failed to create sensor_task");
    } else {
        ESP_LOGI(TAG, "Sensor task created – chu ky %d s",
                 SENSOR_INTERVAL_MS / 1000);
    }
}
