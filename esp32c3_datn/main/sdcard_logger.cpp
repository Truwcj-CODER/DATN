/*
 * sdcard_logger.cpp – Offline CSV logging lên SD card qua SPI
 *
 * File CSV: SD_OFFLINE_FILE ("/sdcard/offline.csv")
 * Format:
 *   timestamp,Humidity,Atmospheric_Temp,Soil_Temp,Soil_Moisture,Water_Flow
 *   2026-04-05T14:30:00+07:00,65.50,28.30,22.10,45.20,0.00
 *
 * Khi WiFi bị mất: append dòng vào CSV.
 * Khi WiFi khôi phục: flush_to_server() đọc từng dòng → POST → xóa file.
 */

#include "sdcard_logger.h"
#include "config.h"
#include "http_poster.h"

#include "esp_vfs_fat.h"
#include "driver/sdspi_host.h"
#include "driver/spi_common.h"
#include "sdmmc_cmd.h"
#include "esp_log.h"

#include <stdio.h>
#include <string.h>

static const char *TAG   = "SDCard";
static sdmmc_card_t *s_card  = NULL;
static bool          s_ready = false;

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

esp_err_t sdcard_logger_init(void)
{
    /* ── SPI bus ── */
    spi_bus_config_t bus_cfg = {};
    bus_cfg.mosi_io_num     = SD_PIN_MOSI;
    bus_cfg.miso_io_num     = SD_PIN_MISO;
    bus_cfg.sclk_io_num     = SD_PIN_CLK;
    bus_cfg.quadwp_io_num   = -1;
    bus_cfg.quadhd_io_num   = -1;
    bus_cfg.max_transfer_sz = 4096;

    esp_err_t ret = spi_bus_initialize(SD_SPI_HOST, &bus_cfg, SDSPI_DEFAULT_DMA);
    /* ESP_ERR_INVALID_STATE có nghĩa bus đã được init – chấp nhận */
    if (ret != ESP_OK && ret != ESP_ERR_INVALID_STATE) {
        ESP_LOGE(TAG, "SPI bus init failed: %s", esp_err_to_name(ret));
        return ret;
    }

    /* ── SD card device ── */
    sdspi_device_config_t slot_cfg = SDSPI_DEVICE_CONFIG_DEFAULT();
    slot_cfg.gpio_cs = SD_PIN_CS;
    slot_cfg.host_id = SD_SPI_HOST;

    sdmmc_host_t host = SDSPI_HOST_DEFAULT();
    host.slot = SD_SPI_HOST;

    esp_vfs_fat_sdmmc_mount_config_t mount_cfg = {};
    mount_cfg.format_if_mount_failed = false;
    mount_cfg.max_files              = 5;
    mount_cfg.allocation_unit_size  = 16 * 1024;

    ret = esp_vfs_fat_sdspi_mount(SD_MOUNT_POINT, &host, &slot_cfg,
                                  &mount_cfg, &s_card);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "SD mount failed (%s) – offline log disabled",
                 esp_err_to_name(ret));
        return ret;
    }

    s_ready = true;
    ESP_LOGI(TAG, "SD mounted at %s  (%.0f MB)", SD_MOUNT_POINT,
             (double)((uint64_t)s_card->csd.capacity * s_card->csd.sector_size)
             / (1024.0 * 1024.0));
    return ESP_OK;
}

esp_err_t sdcard_logger_append(const sensor_data_t *data)
{
    if (!s_ready) return ESP_ERR_INVALID_STATE;

    /* Kiểm tra file đã tồn tại chưa (để quyết định có ghi header không) */
    bool write_header = false;
    {
        FILE *check = fopen(SD_OFFLINE_FILE, "r");
        if (!check) {
            write_header = true;   /* file chưa tồn tại */
        } else {
            fseek(check, 0, SEEK_END);
            write_header = (ftell(check) == 0);
            fclose(check);
        }
    }

    FILE *f = fopen(SD_OFFLINE_FILE, "a");
    if (!f) {
        ESP_LOGE(TAG, "Cannot open %s for append", SD_OFFLINE_FILE);
        return ESP_FAIL;
    }

    if (write_header) {
        fprintf(f, "timestamp,Humidity,Atmospheric_Temp,"
                   "Soil_Temp,Soil_Moisture,Water_Flow\n");
    }

    fprintf(f, "%s,%.2f,%.2f,%.2f,%.2f,%.2f\n",
            data->timestamp,
            (double)data->humidity,
            (double)data->atmospheric_temp,
            (double)data->soil_temp,
            (double)data->soil_moisture,
            (double)data->water_flow);

    fclose(f);
    ESP_LOGI(TAG, "Offline record saved: %s", data->timestamp);
    return ESP_OK;
}

esp_err_t sdcard_logger_flush_to_server(void)
{
    if (!s_ready) return ESP_ERR_INVALID_STATE;

    FILE *f = fopen(SD_OFFLINE_FILE, "r");
    if (!f) return ESP_OK;  /* Không có file = không có gì cần flush */

    char line[256];

    /* Bỏ qua header */
    if (!fgets(line, sizeof(line), f)) {
        fclose(f);
        return ESP_OK;
    }

    int sent = 0, failed = 0;
    while (fgets(line, sizeof(line), f)) {
        /* Parse CSV: timestamp,Hum,AirT,SoilT,SoilM,Flow */
        sensor_data_t rec = {};
        int parsed = sscanf(line,
                            "%31[^,],%f,%f,%f,%f,%f",
                            rec.timestamp,
                            &rec.humidity,
                            &rec.atmospheric_temp,
                            &rec.soil_temp,
                            &rec.soil_moisture,
                            &rec.water_flow);

        if (parsed == 6) {
            rec.valid = true;
            if (http_post_sensor_data(&rec) == ESP_OK) {
                sent++;
            } else {
                failed++;
                break;  /* Dừng lại để bảo toàn thứ tự khi server lỗi */
            }
        }
    }

    fclose(f);
    ESP_LOGI(TAG, "Flush done: %d sent, %d failed", sent, failed);

    /* Chỉ xóa file khi tất cả đã gửi thành công */
    if (failed == 0 && sent > 0) {
        remove(SD_OFFLINE_FILE);
        ESP_LOGI(TAG, "Offline log cleared");
        return ESP_OK;
    }

    return (failed == 0) ? ESP_OK : ESP_FAIL;
}

bool sdcard_logger_has_pending(void)
{
    if (!s_ready) return false;
    FILE *f = fopen(SD_OFFLINE_FILE, "r");
    if (!f) return false;
    fclose(f);
    return true;
}
