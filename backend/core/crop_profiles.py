"""
Crop profiles: optimal environmental thresholds for each plant type.
Used to generate crop-specific advisory alongside ML predictions.
"""
from typing import TypedDict

class OptimalRange(TypedDict):
    humidity: tuple[float, float]           # % air humidity
    atmospheric_temp: tuple[float, float]   # °C
    soil_temp: tuple[float, float]          # °C
    soil_moisture: tuple[float, float]      # %
    dew_point: tuple[float, float]          # °C


CROP_PROFILES: dict[str, dict] = {
    "tomato": {
        "name": "Cà Chua",
        "name_en": "Tomato",
        "emoji": "🍅",
        "description": "Cây cà chua ưa khí hậu ấm áp, đủ ánh sáng và độ ẩm vừa phải.",
        "optimal": {
            "humidity":          (60.0, 80.0),
            "atmospheric_temp":  (20.0, 30.0),
            "soil_temp":         (18.0, 25.0),
            "soil_moisture":     (60.0, 80.0),
            "dew_point":         (10.0, 22.0),
        },
        # Hard warning limits (beyond optimal but still survivable)
        "warning": {
            "humidity":          (45.0, 90.0),
            "atmospheric_temp":  (15.0, 35.0),
            "soil_temp":         (12.0, 30.0),
            "soil_moisture":     (40.0, 90.0),
            "dew_point":         (5.0,  26.0),
        },
        "water_need_threshold": 0.05,
        "growth_stages": [
            "Nảy mầm", "Cây con", "Sinh trưởng",
            "Ra hoa", "Đậu quả", "Thu hoạch"
        ],
        "tips": {
            "humidity_low":         "Tăng độ ẩm không khí — phun sương hoặc tưới phun mưa.",
            "humidity_high":        "Giảm độ ẩm không khí — mở cửa thông gió nhà kính.",
            "atmospheric_temp_low": "Nhiệt độ quá thấp — bật hệ thống sưởi hoặc che phủ cây.",
            "atmospheric_temp_high":"Nhiệt độ quá cao — tăng cường thông gió, che lưới làm mát.",
            "soil_temp_low":        "Nhiệt độ đất thấp — dùng tấm phủ đất hoặc hệ thống sưởi đất.",
            "soil_temp_high":       "Nhiệt độ đất cao — tưới nước để làm mát đất.",
            "soil_moisture_low":    "Đất khô — cần tưới nước ngay, cà chua dễ héo và rụng hoa.",
            "soil_moisture_high":   "Đất quá ướt — giảm tưới, kiểm tra thoát nước để tránh thối rễ.",
            "dew_point_low":        "Điểm sương thấp — không khí quá khô, kiểm tra độ ẩm.",
            "dew_point_high":       "Điểm sương cao — nguy cơ nấm bệnh, tăng thông gió.",
        },
    },
    "melon": {
        "name": "Dưa Lưới",
        "name_en": "Melon",
        "emoji": "🍈",
        "description": "Dưa lưới ưa nóng, cần nhiều ánh sáng và kiểm soát độ ẩm chặt chẽ.",
        "optimal": {
            "humidity":          (50.0, 70.0),
            "atmospheric_temp":  (25.0, 35.0),
            "soil_temp":         (20.0, 30.0),
            "soil_moisture":     (50.0, 70.0),
            "dew_point":         (10.0, 20.0),
        },
        "warning": {
            "humidity":          (35.0, 80.0),
            "atmospheric_temp":  (18.0, 40.0),
            "soil_temp":         (15.0, 35.0),
            "soil_moisture":     (35.0, 85.0),
            "dew_point":         (5.0,  24.0),
        },
        "water_need_threshold": 0.05,
        "growth_stages": [
            "Nảy mầm", "Cây con", "Sinh trưởng",
            "Ra hoa", "Phát triển quả", "Chín", "Thu hoạch"
        ],
        "tips": {
            "humidity_low":         "Tăng độ ẩm không khí — phun sương nhẹ.",
            "humidity_high":        "Độ ẩm cao — tăng thông gió, giảm nguy cơ nấm mốc dưa lưới.",
            "atmospheric_temp_low": "Nhiệt độ thấp — bật sưởi, dưa lưới cần ấm để phát triển quả.",
            "atmospheric_temp_high":"Kích hoạt làm mát — thông gió hoặc điều chỉnh mái che.",
            "soil_temp_low":        "Đất lạnh — dùng tấm phủ đen để hút nhiệt mặt trời.",
            "soil_temp_high":       "Đất quá nóng — che phủ đất, tưới mát.",
            "soil_moisture_low":    "Đất khô — tưới nước ngay, giai đoạn phát triển quả cần nước đều đặn.",
            "soil_moisture_high":   "Đất quá ẩm — giảm tưới, kiểm tra thoát nước, chú ý thối gốc.",
            "dew_point_low":        "Điểm sương thấp — tăng độ ẩm không khí.",
            "dew_point_high":       "Điểm sương cao — giảm độ ẩm để tránh nấm bệnh trên quả.",
        },
    },
}


def get_crop_advisory(
    profile: dict,
    humidity: float,
    atmospheric_temp: float,
    soil_temp: float,
    soil_moisture: float,
    dew_point: float,
) -> dict:
    """
    Compare current sensor values against crop optimal/warning thresholds.
    Returns a dict with per-metric status and actionable tips.
    """
    if not profile:
        return {"error": "No crop profile provided"}

    crop_type = profile["id"]

    sensor_values: dict[str, float] = {
        "humidity":         humidity,
        "atmospheric_temp": atmospheric_temp,
        "soil_temp":        soil_temp,
        "soil_moisture":    soil_moisture,
        "dew_point":        dew_point,
    }

    optimal = profile["optimal"]
    warning = profile["warning"]
    tips    = profile["tips"]

    metrics: dict[str, dict] = {}
    overall_status = "ok"

    for key, value in sensor_values.items():
        opt_lo, opt_hi  = optimal[key]
        warn_lo, warn_hi = warning[key]

        if opt_lo <= value <= opt_hi:
            status = "ok"
            tip    = None
        elif warn_lo <= value <= warn_hi:
            status = "warning"
            # pick low/high tip
            tip = tips.get(f"{key}_low") if value < opt_lo else tips.get(f"{key}_high")
        else:
            status = "critical"
            tip = tips.get(f"{key}_low") if value < warn_lo else tips.get(f"{key}_high")

        metrics[key] = {
            "value":     round(value, 2),
            "status":    status,
            "optimal":   {"min": opt_lo,  "max": opt_hi},
            "warning":   {"min": warn_lo, "max": warn_hi},
            "tip":       tip,
        }

        # Overall is the worst status seen
        if status == "critical":
            overall_status = "critical"
        elif status == "warning" and overall_status == "ok":
            overall_status = "warning"

    # Count issues
    n_critical = sum(1 for m in metrics.values() if m["status"] == "critical")
    n_warning  = sum(1 for m in metrics.values() if m["status"] == "warning")

    return {
        "crop_type":      crop_type,
        "crop_name":      profile["name"],
        "crop_emoji":     profile["emoji"],
        "overall_status": overall_status,
        "n_critical":     n_critical,
        "n_warning":      n_warning,
        "metrics":        metrics,
    }
