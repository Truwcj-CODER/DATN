# Hướng Dẫn Chạy SQLite & Web Nhà Kính Trên Raspberry Pi

SQLite là một cơ sở dữ liệu dạng tệp (file-based), vì vậy nó cực kỳ nhẹ và hoàn hảo cho Raspberry Pi. Bạn không cần cài đặt "Server" như MySQL hay SQL Server.

## 1. Yêu Cầu Hệ Thống trên Pi
Đảm bảo Pi của bạn đã cài đặt .NET 9 Runtime.
```bash
# Cài đặt công cụ hỗ trợ xem database (tùy chọn)
sudo apt update
sudo apt install sqlite3 -y
```

## 2. Triển Khai (Deploy) Ứng Dụng
Từ máy tính Windows, bạn chạy lệnh export dự án cho chip ARM của Pi:
```bash
# Đối với Pi 4 hoặc Pi 3 (64-bit OS)
dotnet publish -c Release -r linux-arm64 --self-contained

# Đối với Pi 3 (32-bit OS)
dotnet publish -c Release -r linux-arm --self-contained
```
Sau đó, hãy sao chép toàn bộ thư mục `publish` sang Raspberry Pi.

## 3. Cấu Hình Quyền Ghi (Permissions)
Đây là bước quan trọng để SQLite có thể tạo tệp dữ liệu trên Pi:
```bash
# Di chuyển vào thư mục ứng dụng trên Pi
cd /path/to/your/app

# Cấp quyền ghi cho ứng dụng
chmod +x WEB_MACHINE_LEARNING_GREENHOUSE_V1
chmod 777 .  # Cho phép tạo file database mới (greenhouse.db)
```

## 4. Chạy Ứng Dụng
```bash
./WEB_MACHINE_LEARNING_GREENHOUSE_V1 --urls "http://0.0.0.0:5000"
```

## 5. Lưu Ý Về Việc "Tự Học" Trên Pi
- Khi bạn bật/tắt chế độ tự học, Pi sẽ tự động gọi lệnh `python retrain_model.py`.
- Hãy đảm bảo trên Pi đã cài đặt Python và các thư viện Machine Learning:
```bash
pip install pandas xgboost scikit-learn onnxmltools
```

---
**Kết quả:** File `greenhouse.db` sẽ tự động xuất hiện trong thư mục ứng dụng trên Pi và lưu trữ mọi dữ liệu cảm biến của bạn vĩnh viễn.
