/*
 * soil_adc.cpp – Đọc cảm biến ẩm đất điện dung v2.1D
 *
 * Dùng ESP-IDF v5.x ADC Oneshot API + curve-fitting calibration.
 * ADC1_CH2 tương ứng GPIO2 trên ESP32-C3.
 *
 * Ánh xạ điện áp → độ ẩm (tuyến tính):
 *   SOIL_DRY_MV → 0 %   (sensor trong không khí khô)
 *   SOIL_WET_MV → 100 % (sensor nhúng vào nước)
 *
 * Hiệu chỉnh: đo sensor trong không khí và trong nước,
 * rồi cập nhật SOIL_DRY_MV / SOIL_WET_MV trong config.h.
 */

#include "soil_adc.h"
#include "config.h"

#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "esp_log.h"

static const char *TAG = "SoilADC";

static adc_oneshot_unit_handle_t s_unit  = NULL;
static adc_cali_handle_t         s_cali  = NULL;
static bool                      s_cali_ok = false;

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

esp_err_t soil_adc_init(void)
{
    /* Khởi tạo ADC1 unit */
    adc_oneshot_unit_init_cfg_t unit_cfg = {};
    unit_cfg.unit_id = ADC_UNIT_1;

    esp_err_t ret = adc_oneshot_new_unit(&unit_cfg, &s_unit);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "ADC unit init failed: %s", esp_err_to_name(ret));
        return ret;
    }

    /* Cấu hình channel – atten DB_12 cho dải 0 ~ 3.1 V */
    adc_oneshot_chan_cfg_t ch_cfg = {};
    ch_cfg.atten    = ADC_ATTEN_DB_12;
    ch_cfg.bitwidth = ADC_BITWIDTH_DEFAULT;

    ret = adc_oneshot_config_channel(s_unit, SOIL_ADC_CHANNEL, &ch_cfg);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "ADC channel config failed: %s", esp_err_to_name(ret));
        return ret;
    }

    /* Thử khởi tạo curve-fitting calibration (ESP32-C3 hỗ trợ) */
    adc_cali_curve_fitting_config_t cali_cfg = {};
    cali_cfg.unit_id  = ADC_UNIT_1;
    cali_cfg.chan     = SOIL_ADC_CHANNEL;
    cali_cfg.atten    = ADC_ATTEN_DB_12;
    cali_cfg.bitwidth = ADC_BITWIDTH_DEFAULT;

    s_cali_ok = (adc_cali_create_scheme_curve_fitting(&cali_cfg, &s_cali) == ESP_OK);
    if (s_cali_ok) {
        ESP_LOGI(TAG, "ADC curve-fitting calibration enabled");
    } else {
        ESP_LOGW(TAG, "Calibration unavailable – dùng linear approximation");
    }

    return ESP_OK;
}

esp_err_t soil_adc_read_moisture(float *moisture_pct)
{
    if (s_unit == NULL) return ESP_ERR_INVALID_STATE;

    /* Lấy trung bình 4 mẫu để giảm nhiễu */
    int sum = 0;
    for (int i = 0; i < 4; i++) {
        int raw = 0;
        esp_err_t ret = adc_oneshot_read(s_unit, SOIL_ADC_CHANNEL, &raw);
        if (ret != ESP_OK) return ret;
        sum += raw;
    }
    int raw_avg = sum / 4;

    /* Chuyển đổi sang mV */
    int mv = 0;
    if (s_cali_ok) {
        adc_cali_raw_to_voltage(s_cali, raw_avg, &mv);
    } else {
        /* Xấp xỉ tuyến tính: 3300 mV / 4095 LSB */
        mv = (raw_avg * 3300) / 4095;
    }

    /* Ánh xạ mV → phần trăm */
    float pct = (float)(SOIL_DRY_MV - mv) * 100.0f
                / (float)(SOIL_DRY_MV - SOIL_WET_MV);

    /* Giới hạn trong khoảng [0, 100] */
    if (pct < 0.0f)   pct = 0.0f;
    if (pct > 100.0f) pct = 100.0f;

    *moisture_pct = pct;
    ESP_LOGD(TAG, "ADC raw=%d  mv=%d  moisture=%.1f%%", raw_avg, mv, (double)pct);
    return ESP_OK;
}
