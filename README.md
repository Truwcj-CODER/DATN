# 🌱 Hệ Thống Giám Sát Nhà Kính Thông Minh (DATN)

Hệ thống IoT giám sát môi trường nhà kính theo thời gian thực, bao gồm node cảm biến ESP32-C3, backend FastAPI + MySQL, và dashboard Next.js.

---

## 📐 Kiến Trúc Hệ Thống

```
[ESP32-C3 Node]
  DHT22 (nhiệt độ/ẩm không khí)
  DS18B20 (nhiệt độ đất)
  Cảm biến ẩm đất v2.1D
  DS3231 RTC
  SD Card (offline log)
        │
        │ HTTP POST /api/sensor/push
        ▼
[Backend - FastAPI :5000]
  MySQL (lưu trữ)
  ML Models (dự đoán tưới nước)
  Socket.IO (realtime)
        │
        │ WebSocket
        ▼
[Frontend - Next.js :3000]
  Dashboard realtime
  Lịch sử dữ liệu
  Huấn luyện mô hình
  Cài đặt thiết bị
```

---

## 🔧 Phần Cứng (ESP32-C3)

| Cảm biến | Giao tiếp | GPIO |
|---|---|---|
| DHT22 (ẩm/nhiệt không khí) | Single-wire | GPIO4 |
| DS18B20 (nhiệt độ đất) | OneWire/RMT | GPIO3 |
| Cảm biến ẩm đất v2.1D | ADC1_CH2 | GPIO2 |
| DS3231 RTC – SDA | I2C | GPIO8 |
| DS3231 RTC – SCL | I2C | GPIO9 |
| SD Card – MISO | SPI2 | GPIO5 |
| SD Card – MOSI | SPI2 | GPIO6 |
| SD Card – CLK | SPI2 | GPIO7 |
| SD Card – CS | SPI2 | GPIO10 |

> ⚠️ GPIO11–17 trên ESP32-C3 dành riêng cho SPI flash nội — **không dùng được**.

---

## 🚀 Hướng Dẫn Triển Khai

### 1. Clone repo

```bash
git clone https://github.com/Truwcj-CODER/DATN.git
cd DATN
```

### 2. Cấu hình môi trường

Tạo file `.env` từ mẫu sau (không commit file này):

```env
DB_USER=greenhouse_user
DB_PASSWORD=your_password
DB_HOST=mysql
DB_PORT=3306
DB_NAME=greenhouse_db

HOST=0.0.0.0
PORT=5000

MYSQL_ROOT_PASSWORD=root_password
MYSQL_USER=greenhouse_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=greenhouse_db

GROQ_API_KEY=your_groq_api_key
```

### 3. Chạy bằng Docker (khuyến nghị)

```bash
docker-compose up -d
```

- Backend: http://localhost:5000
- Frontend: http://localhost:3000
- API docs: http://localhost:5000/docs

### 4. Chạy thủ công (development)

**Backend:**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:socket_app --host 0.0.0.0 --port 5000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 📡 Nạp Code ESP32-C3

### Yêu cầu
- [ESP-IDF v5.x](https://docs.espressif.com/projects/esp-idf/en/latest/esp32c3/get-started/)
- ESP32-C3 Mini (custom PCB)

### Cấu hình

Sửa file [`esp32c3_datn/main/config.h`](esp32c3_datn/main/config.h):

```c
#define WIFI_SSID    "TEN_WIFI_CUA_BAN"
#define WIFI_PASS    "MAT_KHAU_WIFI"
#define SERVER_HOST  "192.168.1.100"   // IP máy chạy backend
#define SERVER_PORT  5000
```

Hiệu chỉnh cảm biến ẩm đất (đo thực tế):
```c
#define SOIL_DRY_MV  2800   // mV khi sensor trong không khí → 0%
#define SOIL_WET_MV  1200   // mV khi sensor trong nước      → 100%
```

### Build & Flash

```bash
cd esp32c3_datn
idf.py set-target esp32c3
idf.py reconfigure          # tải managed components lần đầu
idf.py build
idf.py -p COM? flash monitor
```

### Luồng hoạt động của node

```
Boot → init DS3231, ADC, DHT22, DS18B20, SD, WiFi
  └── sensor_task (mỗi 30 giây):
        Đọc DHT22 + DS18B20 + Soil ADC + DS3231 timestamp
          ├── WiFi OK → flush offline CSV (nếu có) → POST lên server
          └── WiFi mất → lưu CSV vào SD card → reconnect
```

---

## 🗂️ Cấu Trúc Thư Mục

```
DATN/
├── backend/                  # FastAPI backend
│   ├── api/routes.py         # REST endpoints
│   ├── db/models.py          # SQLAlchemy models
│   ├── services/
│   │   ├── greenhouse.py     # Business logic, Socket.IO
│   │   └── ml_trainer.py     # Huấn luyện ML
│   └── trained_models/       # Model đã train (.pkl)
├── frontend/                 # Next.js frontend
│   └── src/
│       ├── app/              # Pages (dashboard, history, settings, training)
│       ├── components/       # React components
│       ├── context/          # SensorContext (realtime state)
│       └── services/         # api.ts, socket.ts
├── esp32c3_datn/             # ESP-IDF C++ firmware
│   └── main/
│       ├── config.h          # ← Cấu hình tất cả GPIO & WiFi & server
│       ├── main.cpp          # app_main + FreeRTOS task
│       ├── dht22.cpp         # Bit-bang DHT22 driver
│       ├── ds18b20_drv.cpp   # OneWire DS18B20 (managed component)
│       ├── ds3231.cpp        # I2C RTC driver
│       ├── soil_adc.cpp      # ADC oneshot + calibration
│       ├── wifi_manager.cpp  # WPA2 STA + NTP sync
│       ├── http_poster.cpp   # HTTP POST to backend
│       └── sdcard_logger.cpp # Offline CSV logging
├── DATA.csv                  # Dataset mẫu
├── docker-compose.yml
└── Dockerfile
```

---

## 📊 API Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/sensor/push` | ESP32 gửi dữ liệu |
| `GET` | `/api/sensor/history` | Lịch sử đo (có phân trang) |
| `GET` | `/api/sensor/devices` | Trạng thái thiết bị online/offline |
| `POST` | `/api/sensor/predict` | Dự đoán nhu cầu tưới nước |
| `GET` | `/api/sensor/forecast/7-days` | Dự báo nhu cầu tưới 7 ngày theo tọa độ |
| `GET` | `/api/geocode/search` | Tìm tọa độ từ địa chỉ |
| `GET` | `/api/models/metrics` | Chỉ số độ chính xác các mô hình |
| `POST` | `/api/models/retrain` | Huấn luyện lại mô hình |

**Payload gửi từ ESP32:**
```json
{
  "device_id": "ESP32C3_01",
  "Humidity": 65.5,
  "Atmospheric_Temp": 28.3,
  "Soil_Temp": 22.1,
  "Soil_Moisture": 45.2,
  "Water_Flow": 0.0
}
```

---

## 🤖 Mô Hình ML

Hệ thống sử dụng **3 thuật toán**, mỗi thuật toán có 2 biến thể (Regression + Classification):

| Thuật toán | Regression (dự đoán `Water_Flow`) | Classification (dự đoán `Water_Need`) |
|---|---|---|
| Linear / Logistic | `linear_model.pkl` | `logistic_model.pkl` |
| Random Forest | `random_forest_model.pkl` | `random_forest_clf_model.pkl` |
| XGBoost | `xgboost_model.pkl` | `xgboost_clf_model.pkl` |

Huấn luyện lại từ dashboard tại trang **Training** hoặc qua `POST /api/models/retrain`.
