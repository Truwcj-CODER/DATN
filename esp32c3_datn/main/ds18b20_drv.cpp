/*
 * ds18b20_drv.cpp – Wrapper cho managed component espressif/ds18b20
 *
 * OneWire bus dùng RMT peripheral (ESP-IDF v5.x).
 * Scan bus để tìm DS18B20 đầu tiên, sau đó trigger & đọc nhiệt độ.
 */

#include "ds18b20_drv.h"
#include "config.h"

#include "onewire_bus.h"
#include "ds18b20.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

static const char *TAG = "DS18B20";

static onewire_bus_handle_t  s_bus    = NULL;
static ds18b20_device_handle_t s_dev = NULL;

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

esp_err_t ds18b20_drv_init(void)
{
    /* Tạo OneWire bus sử dụng RMT */
    onewire_bus_config_t bus_cfg = {};
    bus_cfg.bus_gpio_num = DS18B20_PIN;

    onewire_bus_rmt_config_t rmt_cfg = {};
    rmt_cfg.max_rx_bytes = 10;  /* đủ cho ROM code 8 byte + scratch 9 byte */

    esp_err_t ret = onewire_new_bus_rmt(&bus_cfg, &rmt_cfg, &s_bus);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "OneWire bus init failed: %s", esp_err_to_name(ret));
        return ret;
    }

    /* Duyệt thiết bị trên bus, lấy DS18B20 đầu tiên */
    onewire_device_iter_handle_t iter = NULL;
    ret = onewire_new_device_iter(s_bus, &iter);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Device iter init failed: %s", esp_err_to_name(ret));
        return ret;
    }

    onewire_device_t found;
    esp_err_t search_ret;
    do {
        search_ret = onewire_device_iter_get_next(iter, &found);
        if (search_ret == ESP_OK) {
            ds18b20_config_t ds_cfg = {};
            if (ds18b20_new_device_from_enumeration(&found, &ds_cfg, &s_dev) == ESP_OK) {
                ESP_LOGI(TAG, "DS18B20 found – ROM: %016llX",
                         (unsigned long long)found.address);
                break;
            }
        }
    } while (search_ret == ESP_OK);

    onewire_del_device_iter(iter);

    if (s_dev == NULL) {
        ESP_LOGW(TAG, "No DS18B20 found on GPIO%d", (int)DS18B20_PIN);
        return ESP_ERR_NOT_FOUND;
    }
    return ESP_OK;
}

esp_err_t ds18b20_drv_read_temp(float *temperature_c)
{
    if (s_dev == NULL) {
        ESP_LOGE(TAG, "Driver not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    /* Trigger chuyển đổi nhiệt độ (12-bit: tối đa 750 ms) */
    esp_err_t ret = ds18b20_trigger_temperature_conversion(s_dev);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Trigger conversion failed: %s", esp_err_to_name(ret));
        return ret;
    }

    /* Chờ conversion xong */
    vTaskDelay(pdMS_TO_TICKS(DS18B20_CONV_MS));

    ret = ds18b20_get_temperature(s_dev, temperature_c);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Get temperature failed: %s", esp_err_to_name(ret));
        return ret;
    }

    ESP_LOGD(TAG, "Soil temp: %.2f °C", (double)*temperature_c);
    return ESP_OK;
}
