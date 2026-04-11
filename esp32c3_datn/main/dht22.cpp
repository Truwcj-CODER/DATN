/*
 * dht22.cpp – DHT22 bit-bang driver cho ESP32-C3 (ESP-IDF v5.x)
 *
 * Cách hoạt động:
 *  1. Host kéo DATA xuống LOW ≥ 1 ms để bắt đầu.
 *  2. Host nhả (HIGH), DHT22 phản hồi LOW ~80 µs → HIGH ~80 µs.
 *  3. 40 bit dữ liệu: mỗi bit bắt đầu bằng LOW ~50 µs,
 *     sau đó HIGH ~26 µs (bit 0) hoặc ~70 µs (bit 1).
 *  4. Kiểm tra checksum byte thứ 5.
 *
 * Timing-sensitive part được bảo vệ bằng taskENTER_CRITICAL /
 * taskEXIT_CRITICAL. esp_rom_delay_us() không bị preempt.
 * gpio_get_level() an toàn trong critical section (register read thuần).
 */

#include "dht22.h"
#include "config.h"

#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_rom_sys.h"
#include "esp_log.h"

static const char *TAG = "DHT22";

/* Spinlock riêng cho driver – không dùng chung với module khác */
static portMUX_TYPE s_mux = portMUX_INITIALIZER_UNLOCKED;

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Chờ đến khi GPIO đạt mức `level`, tối đa `timeout_us` micro-giây.
 * Trả về số µs đã chờ, hoặc -1 nếu timeout.
 * CHỈ gọi bên trong critical section.
 */
static inline int wait_for_level(int level, int timeout_us)
{
    int elapsed = 0;
    while (gpio_get_level(DHT22_PIN) != level) {
        if (elapsed >= timeout_us) return -1;
        esp_rom_delay_us(1);
        elapsed++;
    }
    return elapsed;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

esp_err_t dht22_init(void)
{
    gpio_config_t io_conf = {};
    io_conf.pin_bit_mask   = (1ULL << DHT22_PIN);
    io_conf.mode           = GPIO_MODE_INPUT;
    io_conf.pull_up_en     = GPIO_PULLUP_ENABLE;
    io_conf.pull_down_en   = GPIO_PULLDOWN_DISABLE;
    io_conf.intr_type      = GPIO_INTR_DISABLE;
    return gpio_config(&io_conf);
}

esp_err_t dht22_read(float *temperature, float *humidity)
{
    uint8_t data[5] = {0, 0, 0, 0, 0};
    uint8_t expected = 0;
    int16_t raw = 0;

    /* ── Gửi tín hiệu start (ngoài critical section) ─────────────── */
    gpio_set_direction(DHT22_PIN, GPIO_MODE_OUTPUT_OD);
    gpio_set_level(DHT22_PIN, 0);
    vTaskDelay(pdMS_TO_TICKS(2));          /* kéo LOW ≥ 1 ms          */
    gpio_set_level(DHT22_PIN, 1);
    gpio_set_direction(DHT22_PIN, GPIO_MODE_INPUT);
    esp_rom_delay_us(40);                  /* chờ DHT22 chuẩn bị      */

    /* ── Phần nhạy cảm timing ────────────────────────────────────── */
    taskENTER_CRITICAL(&s_mux);

    /* DHT22 kéo LOW ~80 µs rồi HIGH ~80 µs để báo sẵn sàng */
    if (wait_for_level(0, 100) < 0) goto timeout;
    if (wait_for_level(1, 100) < 0) goto timeout;
    if (wait_for_level(0, 100) < 0) goto timeout;

    /* Đọc 40 bit */
    for (int i = 0; i < 40; i++) {
        /* Mỗi bit: LOW ~50 µs → HIGH (26 µs = bit 0, 70 µs = bit 1) */
        if (wait_for_level(1, 80) < 0) goto timeout;
        int high_us = wait_for_level(0, 90);
        if (high_us < 0) goto timeout;
        data[i / 8] <<= 1;
        if (high_us > 40) data[i / 8] |= 1; /* high > 40 µs → bit 1  */
    }

    taskEXIT_CRITICAL(&s_mux);

    /* ── Kiểm tra checksum ───────────────────────────────────────── */
    expected = (uint8_t)((data[0] + data[1] + data[2] + data[3]) & 0xFF);
    if (data[4] != expected) {
        ESP_LOGW(TAG, "Checksum fail: got 0x%02X expected 0x%02X", data[4], expected);
        return ESP_ERR_INVALID_CRC;
    }

    /* ── Giải mã ─────────────────────────────────────────────────── */
    *humidity    = (float)((uint16_t)(data[0] << 8) | data[1]) * 0.1f;
    raw          = (int16_t)(((uint16_t)(data[2] & 0x7F) << 8) | data[3]);
    *temperature = raw * 0.1f;
    if (data[2] & 0x80) *temperature = -(*temperature); /* bit âm */

    ESP_LOGD(TAG, "Temp=%.1f°C  Hum=%.1f%%", (double)*temperature, (double)*humidity);
    return ESP_OK;

timeout:
    taskEXIT_CRITICAL(&s_mux);
    ESP_LOGW(TAG, "Timeout reading DHT22");
    return ESP_ERR_TIMEOUT;
}
