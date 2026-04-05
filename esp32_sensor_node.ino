#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <DFRobot_SHT20.h>
#include <Wire.h>

// --- CẤU HÌNH WIFI ---
const char* ssid = "TÊN_WIFI_CỦA_BẠN";
const char* password = "MẬT_KHẨU_WIFI";

// --- CẤU HÌNH PIN ---
#define DHTPIN 4          // Chân dữ liệu DHT22
#define DHTTYPE DHT22
#define FLOW_SENSOR_PIN 25 // Chân đọc xung cảm biến lưu lượng
// I2C cho SHT20 mặc định sử dụng SDA: 21, SCL: 22 trên ESP32

DHT dht(DHTPIN, DHTTYPE);
DFRobot_SHT20 sht20(&Wire, SHT20_I2C_ADDR);
WebServer server(80);

// Biến lưu lượng nước
volatile long pulseCount = 0;
float flowRate = 0.0;

void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  // Khởi tạo I2C cho SHT20
  sht20.initSHT20();
  delay(100);
  sht20.checkSHT20();

  // Cấu hình Flow Sensor
  pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);

  // Kết nối WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Cấu hình endpoint lấy dữ liệu
  server.on("/data", HTTP_GET, handleData);
  server.begin();
}

void loop() {
  server.handleClient();
  
  // Tính toán lưu lượng nước
  static unsigned long lastMillis = 0;
  if (millis() - lastMillis > 1000) {
    detachInterrupt(FLOW_SENSOR_PIN);
    flowRate = (pulseCount / 7.5); 
    pulseCount = 0;
    lastMillis = millis();
    attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);
  }
}

void handleData() {
  // Đọc DHT22 (Không khí)
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  // Đọc SHT20 (Đất 2 trong 1)
  float soilTemp = sht20.readTemperature();
  float soilMoist = sht20.readHumidity();

  StaticJsonDocument<256> doc;
  doc["Humidity"] = isnan(h) ? 0 : h;
  doc["Atmospheric_Temp"] = isnan(t) ? 0 : t;
  doc["Soil_Temp"] = isnan(soilTemp) ? 0 : soilTemp;
  doc["Soil_Moisture"] = isnan(soilMoist) ? 0 : soilMoist;
  doc["Water_Flow"] = flowRate / 60.0; 

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
  
  Serial.print("Data sent: ");
  Serial.println(response);
}
