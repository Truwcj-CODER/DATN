/*
 * http_poster.cpp – Gửi dữ liệu sensor lên backend qua HTTP POST
 *
 * Payload JSON:
 * {
 *   "device_id":       "ESP32C3_01",
 *   "Humidity":        65.50,
 *   "Atmospheric_Temp":28.30,
 *   "Soil_Temp":       22.10,
 *   "Soil_Moisture":   45.20,
 *   "Water_Flow":      0.00
 * }
 *
 * Endpoint: POST http://SERVER_HOST:SERVER_PORT/api/sensor/push
 * Timeout:  5 giây
 */

#include "http_poster.h"
#include "config.h"

#include "esp_http_client.h"
#include "esp_log.h"

#include <stdio.h>
#include <string.h>

static const char *TAG = "HTTP";

#define JSON_BUF_SIZE  300
#define URL_BUF_SIZE   128

/* Minimal event handler – chỉ cần để esp_http_client_perform() hoạt động */
static esp_err_t http_event_cb(esp_http_client_event_t *evt)
{
    (void)evt;
    return ESP_OK;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

esp_err_t http_post_sensor_data(const sensor_data_t *data)
{
    /* ── Build URL ── */
    char url[URL_BUF_SIZE];
    snprintf(url, sizeof(url), "http://%s:%d%s",
             SERVER_HOST, SERVER_PORT, PUSH_ENDPOINT);

    /* ── Serialize JSON ── */
    char json[JSON_BUF_SIZE];
    int json_len = snprintf(json, sizeof(json),
        "{"
        "\"device_id\":\"%s\","
        "\"Humidity\":%.2f,"
        "\"Atmospheric_Temp\":%.2f,"
        "\"Soil_Temp\":%.2f,"
        "\"Soil_Moisture\":%.2f,"
        "\"Water_Flow\":%.2f"
        "}",
        DEVICE_ID,
        (double)data->humidity,
        (double)data->atmospheric_temp,
        (double)data->soil_temp,
        (double)data->soil_moisture,
        (double)data->water_flow);

    if (json_len < 0 || json_len >= JSON_BUF_SIZE) {
        ESP_LOGE(TAG, "JSON buffer overflow (%d bytes)", json_len);
        return ESP_ERR_NO_MEM;
    }

    /* ── HTTP client ── */
    esp_http_client_config_t cfg = {};
    cfg.url           = url;
    cfg.method        = HTTP_METHOD_POST;
    cfg.timeout_ms    = 5000;
    cfg.event_handler = http_event_cb;

    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    if (!client) {
        ESP_LOGE(TAG, "HTTP client init failed");
        return ESP_FAIL;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json, json_len);

    /* ── Perform request ── */
    esp_err_t ret = esp_http_client_perform(client);
    if (ret == ESP_OK) {
        int status = esp_http_client_get_status_code(client);
        if (status == 200) {
            ESP_LOGI(TAG, "POST OK [%d] – %s", status, data->timestamp);
        } else {
            ESP_LOGW(TAG, "POST HTTP %d", status);
            ret = ESP_FAIL;
        }
    } else {
        ESP_LOGE(TAG, "POST failed: %s", esp_err_to_name(ret));
    }

    esp_http_client_cleanup(client);
    return ret;
}
