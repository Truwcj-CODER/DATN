/*
 * ds3231.cpp – Driver DS3231 RTC qua I2C Master API mới (ESP-IDF v5.1+)
 *
 * Register map DS3231 (I2C addr 0x68):
 *   0x00 – Seconds  (BCD)
 *   0x01 – Minutes  (BCD)
 *   0x02 – Hours    (BCD, 24h mode)
 *   0x03 – Day-of-week (không dùng)
 *   0x04 – Date     (BCD)
 *   0x05 – Month    (BCD, bit7 = century)
 *   0x06 – Year     (BCD, 2 digit, offset từ 2000)
 */

#include "ds3231.h"
#include "config.h"

#include "driver/i2c_master.h"
#include "esp_log.h"
#include <stdio.h>
#include <string.h>

static const char *TAG = "DS3231";

#define DS3231_I2C_ADDR   0x68
#define I2C_TIMEOUT_MS    50

static i2c_master_bus_handle_t s_bus = NULL;
static i2c_master_dev_handle_t s_dev = NULL;

/* ------------------------------------------------------------------ */
/*  BCD helpers                                                         */
/* ------------------------------------------------------------------ */

static inline uint8_t bcd2bin(uint8_t v) { return (uint8_t)((v >> 4) * 10u + (v & 0x0Fu)); }
static inline uint8_t bin2bcd(uint8_t v) { return (uint8_t)(((v / 10u) << 4) | (v % 10u)); }

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

esp_err_t ds3231_init(void)
{
    /* Cấu hình I2C master bus */
    i2c_master_bus_config_t bus_cfg = {};
    bus_cfg.i2c_port             = I2C_PORT_NUM;
    bus_cfg.sda_io_num           = I2C_SDA_PIN;
    bus_cfg.scl_io_num           = I2C_SCL_PIN;
    bus_cfg.clk_source           = I2C_CLK_SRC_DEFAULT;
    bus_cfg.glitch_ignore_cnt    = 7;
    bus_cfg.flags.enable_internal_pullup = true;

    esp_err_t ret = i2c_new_master_bus(&bus_cfg, &s_bus);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "I2C bus init failed: %s", esp_err_to_name(ret));
        return ret;
    }

    /* Thêm device DS3231 */
    i2c_device_config_t dev_cfg = {};
    dev_cfg.dev_addr_length = I2C_ADDR_BIT_LEN_7;
    dev_cfg.device_address  = DS3231_I2C_ADDR;
    dev_cfg.scl_speed_hz    = I2C_CLK_HZ;

    ret = i2c_master_bus_add_device(s_bus, &dev_cfg, &s_dev);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "DS3231 device add failed: %s", esp_err_to_name(ret));
        return ret;
    }

    /* Kiểm tra kết nối bằng cách đọc 1 byte */
    uint8_t reg = 0x00, dummy = 0;
    ret = i2c_master_transmit_receive(s_dev, &reg, 1, &dummy, 1, I2C_TIMEOUT_MS);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "DS3231 not responding: %s", esp_err_to_name(ret));
    } else {
        ESP_LOGI(TAG, "DS3231 OK on I2C bus (SDA=GPIO%d, SCL=GPIO%d)",
                 (int)I2C_SDA_PIN, (int)I2C_SCL_PIN);
    }
    return ret;
}

esp_err_t ds3231_get_datetime(struct tm *dt)
{
    if (s_dev == NULL) return ESP_ERR_INVALID_STATE;

    uint8_t reg = 0x00;
    uint8_t buf[7] = {0};

    esp_err_t ret = i2c_master_transmit_receive(s_dev, &reg, 1, buf, 7, I2C_TIMEOUT_MS);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "get_datetime failed: %s", esp_err_to_name(ret));
        return ret;
    }

    memset(dt, 0, sizeof(*dt));
    dt->tm_sec  = bcd2bin(buf[0] & 0x7F);
    dt->tm_min  = bcd2bin(buf[1] & 0x7F);
    dt->tm_hour = bcd2bin(buf[2] & 0x3F);   /* bit6-7 ignored (24h mode) */
    /* buf[3] = day-of-week, skip */
    dt->tm_mday = bcd2bin(buf[4]);
    dt->tm_mon  = bcd2bin(buf[5] & 0x1F) - 1;  /* 0-based */
    dt->tm_year = bcd2bin(buf[6]) + 100;         /* years since 1900 */
    dt->tm_isdst = -1;

    /* Phát hiện DS3231 chưa được cài giờ (all-zero registers → năm 2000
       hoặc bất kỳ năm < 2024 đều coi là chưa hợp lệ) */
    if ((dt->tm_year + 1900) < 2024) {
        ESP_LOGW(TAG, "DS3231 time invalid (year=%d) – chưa được sync NTP",
                 dt->tm_year + 1900);
        return ESP_ERR_INVALID_RESPONSE;
    }

    return ESP_OK;
}

esp_err_t ds3231_set_datetime(const struct tm *dt)
{
    if (s_dev == NULL) return ESP_ERR_INVALID_STATE;

    /* Ghi 7 thanh ghi bắt đầu từ 0x00 */
    uint8_t buf[8] = {
        0x00,                                     /* start register          */
        bin2bcd((uint8_t)dt->tm_sec),
        bin2bcd((uint8_t)dt->tm_min),
        bin2bcd((uint8_t)dt->tm_hour),
        0x01,                                     /* day-of-week (placeholder) */
        bin2bcd((uint8_t)dt->tm_mday),
        bin2bcd((uint8_t)(dt->tm_mon + 1)),
        bin2bcd((uint8_t)(dt->tm_year - 100)),    /* year offset from 2000   */
    };

    esp_err_t ret = i2c_master_transmit(s_dev, buf, sizeof(buf), I2C_TIMEOUT_MS);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "set_datetime failed: %s", esp_err_to_name(ret));
    }
    return ret;
}

void ds3231_format_iso8601(const struct tm *dt, char *buf, size_t len)
{
    snprintf(buf, len,
             "%04d-%02d-%02dT%02d:%02d:%02d+07:00",
             dt->tm_year + 1900,
             dt->tm_mon  + 1,
             dt->tm_mday,
             dt->tm_hour,
             dt->tm_min,
             dt->tm_sec);
}
