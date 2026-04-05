/*
 * wifi_manager.cpp – WiFi STA + NTP sync, ESP-IDF v5.x
 *
 * Luồng:
 *  1. Khởi tạo NVS, netif, event loop, WiFi STA.
 *  2. Kết nối WPA2, chờ IP tối đa 10 s.
 *  3. Khi có IP: khởi động SNTP (pool.ntp.org).
 *  4. Khi SNTP sync xong: cập nhật DS3231 RTC.
 *  5. Hàm là non-blocking với wifi_manager_reconnect().
 */

#include "wifi_manager.h"
#include "config.h"
#include "ds3231.h"

#include "nvs_flash.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_sntp.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

#include <string.h>
#include <time.h>

static const char *TAG = "WiFi";

#define WIFI_CONNECTED_BIT  BIT0
#define WIFI_FAIL_BIT       BIT1

static EventGroupHandle_t s_event_group = NULL;
static int  s_retry = 0;
static bool s_sntp_started = false;

/* ------------------------------------------------------------------ */
/*  SNTP callback                                                       */
/* ------------------------------------------------------------------ */

static void sntp_sync_cb(struct timeval *tv)
{
    time_t now = time(NULL);
    struct tm dt;
    localtime_r(&now, &dt);

    esp_err_t ret = ds3231_set_datetime(&dt);
    ESP_LOGI(TAG, "NTP synced → DS3231 updated: %s",
             ret == ESP_OK ? "OK" : esp_err_to_name(ret));
}

/* ------------------------------------------------------------------ */
/*  Event handler                                                       */
/* ------------------------------------------------------------------ */

static void event_handler(void *arg, esp_event_base_t base,
                          int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();

    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        xEventGroupClearBits(s_event_group, WIFI_CONNECTED_BIT);
        if (s_retry < WIFI_MAX_RETRY) {
            esp_wifi_connect();
            s_retry++;
            ESP_LOGI(TAG, "Retry %d/%d ...", s_retry, WIFI_MAX_RETRY);
        } else {
            xEventGroupSetBits(s_event_group, WIFI_FAIL_BIT);
            ESP_LOGW(TAG, "WiFi connect failed – chạy offline");
        }

    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *evt = (ip_event_got_ip_t *)data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&evt->ip_info.ip));
        s_retry = 0;
        xEventGroupClearBits(s_event_group, WIFI_FAIL_BIT);
        xEventGroupSetBits(s_event_group, WIFI_CONNECTED_BIT);

        /* Khởi SNTP lần đầu sau khi có mạng */
        if (!s_sntp_started) {
            esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
            esp_sntp_setservername(0, NTP_SERVER);
            esp_sntp_set_sync_notify_cb(sntp_sync_cb);
            esp_sntp_init();
            s_sntp_started = true;
            ESP_LOGI(TAG, "SNTP started → %s", NTP_SERVER);
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

esp_err_t wifi_manager_init(void)
{
    /* ── NVS ── */
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES ||
        ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "NVS erase & reinit");
        nvs_flash_erase();
        ret = nvs_flash_init();
    }
    if (ret != ESP_OK) return ret;

    /* ── Timezone (dùng cho localtime_r) ── */
    setenv("TZ", NTP_TZ_INFO, 1);
    tzset();

    s_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t wifi_init_cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&wifi_init_cfg));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        WIFI_EVENT, ESP_EVENT_ANY_ID, event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        IP_EVENT, IP_EVENT_STA_GOT_IP, event_handler, NULL, NULL));

    /* ── Cấu hình WiFi STA ── */
    wifi_config_t wifi_cfg = {};
    strncpy((char *)wifi_cfg.sta.ssid,     WIFI_SSID,
            sizeof(wifi_cfg.sta.ssid) - 1);
    strncpy((char *)wifi_cfg.sta.password, WIFI_PASS,
            sizeof(wifi_cfg.sta.password) - 1);
    wifi_cfg.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_cfg));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "Kết nối đến SSID: %s ...", WIFI_SSID);

    /* Chờ kết nối hoặc thất bại (tối đa 10 giây) */
    EventBits_t bits = xEventGroupWaitBits(
        s_event_group,
        WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
        pdFALSE, pdFALSE,
        pdMS_TO_TICKS(10000));

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "WiFi OK");
        return ESP_OK;
    }

    /* Thất bại – trả lỗi nhưng hệ thống vẫn tiếp tục (offline mode) */
    ESP_LOGW(TAG, "WiFi connect failed – operating offline");
    return ESP_ERR_WIFI_NOT_CONNECT;
}

bool wifi_manager_is_connected(void)
{
    if (!s_event_group) return false;
    return (xEventGroupGetBits(s_event_group) & WIFI_CONNECTED_BIT) != 0;
}

void wifi_manager_reconnect(void)
{
    if (wifi_manager_is_connected()) return;
    s_retry = 0;
    xEventGroupClearBits(s_event_group, WIFI_FAIL_BIT);
    esp_wifi_connect();
    ESP_LOGI(TAG, "Reconnecting ...");
}
