# Hướng Dẫn Linh Kiện & Đấu Nối Nhà Kính ESP32

Tài liệu này cung cấp chi tiết về chi phí ước tính và cách đấu nối các linh kiện cho hệ thống giám sát.

## 1. Bảng Chi Phí Linh Kiện Ước Tính (Tham khảo)

| Linh kiện | Tên mã hiệu | Giá tham khảo (VND) | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Vi điều khiển** | **ESP32 DevKit V1** | 80.000 - 110.000 | Trình điều khiển trung tâm WiFi/Bluetooth |
| **Cảm biến Không khí**| **DHT22 (AM2302)** | 85.000 - 100.000 | Đo Nhiệt độ & Độ ẩm không khí |
| **Cảm biến Đất (2in1)**| **SHT20 Soil Probe** | 250.000 - 350.000| Cảm biến công nghiệp, đo cả Nhiệt & Ẩm đất |
| **Cảm biến Lưu lượng**| **YF-S201 (G1/2")** | 65.000 - 85.000 | Đo nước tưới |
| **Phụ kiện** | Dây bus, Breadboard | 30.000 - 50.000 | Để kết nối các linh kiện |
| **TỔNG CỘNG** | | **~510.000 - 700.000** | Cho 1 bộ trạm cảm biến đầy đủ |

---

## 2. Hướng Dẫn Đấu Nối Chi Tiết

### A. Cảm biến Đất 2 trong 1 (SHT20 - Quan trọng nhất)
Đây là loại đầu dò kim loại tích hợp, sử dụng giao tiếp **I2C**.
- **Dây Đỏ**: Kết nối vào chân **3V3** của ESP32.
- **Dây Đen / Xanh dương**: Kết nối vào chân **GND**.
- **Dây Trắng (SDA)**: Kết nối vào chân **GPIO 21**.
- **Dây Xanh lá (SCL)**: Kết nối vào chân **GPIO 22**.

### B. Cảm biến Không khí (DHT22)
Sử dụng giao tiếp kỹ thuật số Single-bus.
- **Chân 1 (VCC)**: Kết nối vào chân **3V3** hoặc **5V**.
- **Chân 2 (DATA)**: Kết nối vào chân **GPIO 4**.
- **Chân 4 (GND)**: Kết nối vào chân **GND**.
- *(Chân 3 bỏ trống. Nếu mua module sẵn thường chỉ có 3 chân).*

### C. Cảm biến Lưu lượng nước (YF-S201)
- **Dây Đỏ (VCC)**: Kết nối vào chân **5V (VIN)** của ESP32 (Để cảm biến hoạt động ổn định nhất).
- **Dây Đen (GND)**: Kết nối vào chân **GND**.
- **Dây Vàng (Signal)**: Kết nối vào chân **GPIO 25**.

---

## 3. Các bước triển khai
1. **Lắp ráp**: Đấu nối theo sơ đồ trên (nên dùng Breadboard để thử nghiệm trước).
2. **Cài đặt IDE**: Mở Arduino IDE, cài các thư viện `DHT sensor`, `ArduinoJson`, và `DFRobot_SHT20`.
3. **Nạp code**: Mở file `esp32_sensor_node.ino`, điền thông tin WiFi và nhấn **Upload**.
4. **Cấu hình Web**: Sau khi ESP32 có IP, truy cập trang Cài đặt trên Web và thêm IP vào để bắt đầu nhận dữ liệu.

---
*Lưu ý: Giá linh kiện có thể thay đổi tùy cửa hàng (vừa nêu là giá tham khảo tại Việt Nam).*
