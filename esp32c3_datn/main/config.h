#pragma once

#include "driver/gpio.h"
#include "esp_adc/adc_oneshot.h"

// ============================================================
//  WiFi – chỉnh thông tin mạng của bạn
// ============================================================
#define WIFI_SSID        "TEN_WIFI_CUA_BAN"
#define WIFI_PASS        "MAT_KHAU_WIFI"
#define WIFI_MAX_RETRY   10              // số lần thử kết nối lại

// ============================================================
//  Backend Server (Raspberry Pi / PC chạy docker-compose)
// ============================================================
#define SERVER_HOST      "192.168.1.100"  // <-- đổi thành IP thực
#define SERVER_PORT      5000
#define PUSH_ENDPOINT    "/api/sensor/push"

// ============================================================
//  Device ID
// ============================================================
#define DEVICE_ID        "ESP32C3_01"

// ============================================================
//  GPIO Pin Assignments – ESP32-C3 Mini
//
//  KHÔNG dùng GPIO11-17 (internal SPI flash)
//  KHÔNG dùng GPIO18-19 trên board có USB (D-, D+)
// ============================================================

// DHT22 (nhiệt độ & độ ẩm không khí) – single-wire bit-bang
#define DHT22_PIN            GPIO_NUM_4

// DS18B20 (nhiệt độ đất) – OneWire via RMT
#define DS18B20_PIN          GPIO_NUM_3

// Cảm biến ẩm đất điện dung v2.1D – analog  →  ADC1_CH2
#define SOIL_ADC_CHANNEL     ADC_CHANNEL_2   // GPIO2

// DS3231 RTC – I2C
#define I2C_PORT_NUM         I2C_NUM_0
#define I2C_SDA_PIN          GPIO_NUM_8
#define I2C_SCL_PIN          GPIO_NUM_9
#define I2C_CLK_HZ           100000

// SD Card – SPI2 (FSPI)
#define SD_SPI_HOST          SPI2_HOST
#define SD_PIN_MISO          GPIO_NUM_5
#define SD_PIN_MOSI          GPIO_NUM_6
#define SD_PIN_CLK           GPIO_NUM_7
#define SD_PIN_CS            GPIO_NUM_10
#define SD_MOUNT_POINT       "/sdcard"
#define SD_OFFLINE_FILE      "/sdcard/offline.csv"

// ============================================================
//  Calibration – Cảm biến ẩm đất điện dung v2.1D
//
//  Đo sensor trong không khí khô → gán SOIL_DRY_MV
//  Đo sensor nhúng vào nước     → gán SOIL_WET_MV
// ============================================================
#define SOIL_DRY_MV      2800   // mV khi sensor ở trong không khí → 0 %
#define SOIL_WET_MV      1200   // mV khi sensor ngập nước          → 100 %

// ============================================================
//  NTP / Timezone
// ============================================================
#define NTP_SERVER       "pool.ntp.org"
#define NTP_TZ_INFO      "ICT-7"          // Indochina Time UTC+7

// ============================================================
//  Sensor task timing
// ============================================================
#define SENSOR_INTERVAL_MS   30000   // chu kỳ đọc sensor (ms)
#define DS18B20_CONV_MS      800     // thời gian chuyển đổi 12-bit (ms)
#define DHT22_RETRY_COUNT    3       // số lần thử lại khi đọc thất bại
#define DHT22_RETRY_DELAY_MS 2000   // khoảng cách giữa các lần thử (ms)
