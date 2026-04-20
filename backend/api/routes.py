from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core import config, dependencies
from core.crop_profiles import get_crop_advisory
from db.models import SensorRecord, ModelMetrics, CropProfile
import csv
import io
import httpx
import re
import unicodedata

router = APIRouter(prefix="/api")


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _normalize_address_query(query: str) -> list[str]:
    cleaned = " ".join(query.strip().split())
    expanded = re.sub(r"\bđh\b", "Đại học", cleaned, flags=re.IGNORECASE)
    expanded = re.sub(r"\btp\.?\s*hcm\b", "Thành phố Hồ Chí Minh", expanded, flags=re.IGNORECASE)
    expanded = re.sub(r"\bhcm\b", "Hồ Chí Minh", expanded, flags=re.IGNORECASE)

    variants = [cleaned, expanded, f"{expanded}, Việt Nam"]
    no_accent = _strip_accents(expanded)
    if no_accent != expanded:
        variants.extend([no_accent, f"{no_accent}, Vietnam"])

    lowered = _strip_accents(expanded).lower()
    if "nong lam" in lowered and ("tphcm" in lowered or "ho chi minh" in lowered):
        variants.insert(0, "Trường Đại học Nông Lâm Thành phố Hồ Chí Minh")
        variants.insert(1, "Nong Lam University Ho Chi Minh City")

    unique = []
    seen = set()
    for item in variants:
        key = item.lower()
        if item and key not in seen:
            unique.append(item)
            seen.add(key)
    return unique


@router.get("/geocode/search")
async def geocode_search(q: str = Query(..., min_length=2), limit: int = Query(5, ge=1, le=10)):
    headers = {
        "User-Agent": "DATN-Greenhouse-Dashboard/1.0",
        "Accept-Language": "vi,en",
    }
    async with httpx.AsyncClient(timeout=10, headers=headers) as client:
        for query in _normalize_address_query(q):
            params = {
                "q": query,
                "format": "jsonv2",
                "limit": limit,
                "countrycodes": "vn",
                "addressdetails": 1,
                "accept-language": "vi",
            }
            try:
                res = await client.get("https://nominatim.openstreetmap.org/search", params=params)
                res.raise_for_status()
            except httpx.HTTPError:
                continue

            results = res.json()
            if results:
                return [
                    {
                        "display_name": item.get("display_name", ""),
                        "lat": item.get("lat"),
                        "lon": item.get("lon"),
                    }
                    for item in results
                    if item.get("lat") and item.get("lon")
                ]

    return []


# ------------------------------------------------------------------ #
#  ESP32 Push                                                          #
# ------------------------------------------------------------------ #

class SensorPushPayload(BaseModel):
    device_id: str = 'unknown'
    Humidity: float = 0.0
    Atmospheric_Temp: float = 0.0
    Soil_Temp: float = 0.0
    Soil_Moisture: float = 0.0
    Water_Flow: float = 0.0

@router.post("/sensor/push")
async def esp32_push(payload: SensorPushPayload):
    await dependencies.greenhouse_service.handle_push(payload.model_dump())
    return {"status": "ok"}


# ------------------------------------------------------------------ #
#  Device Status                                                       #
# ------------------------------------------------------------------ #

@router.get("/sensor/devices")
async def get_devices():
    return dependencies.greenhouse_service.get_device_status()


# ------------------------------------------------------------------ #
#  Sensor History                                                      #
# ------------------------------------------------------------------ #

@router.get("/sensor/history")
async def get_history(limit: int = config.HISTORY_LIMIT, db: Session = Depends(dependencies.get_db)):
    records = db.query(SensorRecord).order_by(SensorRecord.id.desc()).limit(limit).all()
    return [r.to_dict() for r in records]


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _forecast_dew_point(temp: float, humidity: float) -> float:
    return temp - (100 - humidity) / 5.0


def _predict_for_forecast(humidity: float, atmospheric_temp: float, soil_temp: float,
                          soil_moisture: float, dew_point: float) -> dict:
    service = dependencies.greenhouse_service
    if not service or not service.models:
        return {}

    features = [[humidity, atmospheric_temp, soil_temp, soil_moisture, dew_point]]
    predictions = {}
    for key in ("linear", "random_forest", "xgboost"):
        model = service.models.get(key)
        if model is None:
            continue
        predictions[key] = round(float(model.predict(features)[0]), 4)
    return predictions


async def _fetch_open_meteo_forecast(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "forecast_days": 7,
        "timezone": "auto",
        "daily": ",".join([
            "temperature_2m_mean",
            "relative_humidity_2m_mean",
            "precipitation_sum",
        ]),
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
            res.raise_for_status()
            return res.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Weather forecast unavailable: {exc}") from exc


def _daily_recommendation(water_need: bool, soil_moisture: float, rain_mm: float,
                          crop_profile: dict | None) -> str:
    if not crop_profile:
        if water_need:
            return "Cần tưới"
        return "Không cần tưới"

    opt_min = crop_profile["optimal"]["soil_moisture"][0]
    warn_min = crop_profile["warning"]["soil_moisture"][0]
    if soil_moisture <= warn_min:
        return "Cần tưới ngay"
    if water_need and rain_mm >= 5:
        return "Theo dõi sau mưa"
    if water_need or soil_moisture < opt_min:
        return "Cần tưới"
    return "Không cần tưới"


@router.get("/sensor/forecast/7-days")
async def get_seven_day_forecast(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    crop_type: str = "tomato",
    db: Session = Depends(dependencies.get_db),
):
    latest = db.query(SensorRecord).order_by(SensorRecord.id.desc()).first()
    if not latest:
        raise HTTPException(status_code=404, detail="No sensor data available for forecast")

    profile_db = db.query(CropProfile).filter(CropProfile.id == crop_type).first()
    profile = profile_db.to_dict() if profile_db else None

    weather = await _fetch_open_meteo_forecast(lat, lon)
    daily = weather.get("daily") or {}
    dates = daily.get("time") or []
    temps = daily.get("temperature_2m_mean") or []
    humidities = daily.get("relative_humidity_2m_mean") or []
    rains = daily.get("precipitation_sum") or []
    if not dates or len(dates) < 7:
        raise HTTPException(status_code=502, detail="Weather forecast response is incomplete")

    soil_moisture = float(latest.soil_moisture)
    soil_temp_base = float(latest.soil_temp)
    opt_soil_min = profile["optimal"]["soil_moisture"][0] if profile else 55.0
    warn_soil_min = profile["warning"]["soil_moisture"][0] if profile else 35.0

    days = []
    for index, date in enumerate(dates[:7]):
        temp = float(temps[index] if index < len(temps) and temps[index] is not None else latest.atmospheric_temp)
        humidity = float(humidities[index] if index < len(humidities) and humidities[index] is not None else latest.humidity)
        rain_mm = float(rains[index] if index < len(rains) and rains[index] is not None else 0.0)

        evap_loss = 2.0 + max(temp - 24.0, 0.0) * 0.25 + max(60.0 - humidity, 0.0) * 0.08
        rain_gain = min(rain_mm * 1.8, 18.0)
        estimated_soil_moisture = _clamp(soil_moisture - evap_loss + rain_gain, 0.0, 100.0)
        estimated_soil_temp = round(soil_temp_base * 0.65 + temp * 0.35, 2)
        dew_point = _forecast_dew_point(temp, humidity)
        predictions = _predict_for_forecast(
            humidity, temp, estimated_soil_temp, estimated_soil_moisture, dew_point
        )

        model_values = [float(v) for v in predictions.values()]
        model_score = sum(model_values) / len(model_values) if model_values else 0.0
        rule_need = estimated_soil_moisture < opt_soil_min or estimated_soil_moisture <= warn_soil_min
        water_need = model_score >= 0.5 or rule_need
        recommendation = _daily_recommendation(water_need, estimated_soil_moisture, rain_mm, profile)

        days.append({
            "date": date,
            "temperature": round(temp, 2),
            "humidity": round(humidity, 2),
            "precipitation": round(rain_mm, 2),
            "estimated_soil_temp": estimated_soil_temp,
            "estimated_soil_moisture": round(estimated_soil_moisture, 2),
            "dew_point": round(dew_point, 2),
            "predictions": predictions,
            "model_score": round(_clamp(model_score, 0.0, 1.0), 4),
            "water_need": water_need,
            "recommendation": recommendation,
        })

        soil_moisture = max(estimated_soil_moisture, opt_soil_min + 5.0) if water_need else estimated_soil_moisture

    return {
        "source": "Open-Meteo",
        "latitude": lat,
        "longitude": lon,
        "crop_type": crop_type,
        "baseline": latest.to_dict(),
        "days": days,
    }

@router.post("/sensor/import")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(dependencies.get_db)):
    if not file.filename.endswith(".csv"):
        return {"error": "Only CSV files are allowed"}, 400
    
    try:
        contents = await file.read()
        decoded = contents.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(decoded))
        
        batch = []
        inserted = 0
        from datetime import datetime
        for row in reader:
            try:
                record = SensorRecord(
                    device_id        = 'CSV_IMPORT',
                    time             = row.get('Time', datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                    humidity         = float(row.get('Humidity', 0)),
                    atmospheric_temp = float(row.get('Atmospheric_Temp', 0)),
                    soil_temp        = float(row.get('Soil_Temp', 0)),
                    soil_moisture    = float(row.get('Soil_Moisture', 0)),
                    dew_point        = float(row.get('Dew_Point', 0)),
                    water_need       = float(row.get('Water_Need', 0)),
                    water_flow       = float(row.get('Water_Flow', 0)),
                    prediction       = 'Cần tưới' if float(row.get('Water_Need', 0)) > 0.5 else 'Không cần tưới',
                    confidence       = 0.0,
                )
                batch.append(record)
                if len(batch) >= 500:
                    db.bulk_save_objects(batch)
                    db.commit()
                    inserted += len(batch)
                    batch = []
            except Exception:
                continue
        
        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            inserted += len(batch)
            
        total = db.query(SensorRecord).count()
        return {"status": "ok", "inserted": inserted, "total_records": total}
    except Exception as e:
        return {"error": str(e)}, 500


# ------------------------------------------------------------------ #
#  Logging toggle                                                      #
# ------------------------------------------------------------------ #

@router.post("/sensor/logging")
async def set_logging(enabled: bool):
    dependencies.greenhouse_service.set_logging_enabled(enabled)
    return {"status": "ok"}


# ------------------------------------------------------------------ #
#  Manual Prediction (Live-off mode)                                  #
# ------------------------------------------------------------------ #

class PredictRequest(BaseModel):
    Humidity: float
    Atmospheric_Temp: float
    Soil_Temp: float
    Soil_Moisture: float
    crop_type: str = "tomato"

@router.post("/sensor/predict")
async def predict_manual(req: PredictRequest, db: Session = Depends(dependencies.get_db)):
    result = dependencies.greenhouse_service.predict_manual(
        req.Humidity, req.Atmospheric_Temp, req.Soil_Temp, req.Soil_Moisture
    )
    # Fetch crop profile from DB
    profile_db = db.query(CropProfile).filter(CropProfile.id == req.crop_type).first()
    profile = profile_db.to_dict() if profile_db else None

    # Attach crop advisory
    dew_point = result.get("dew_point", req.Atmospheric_Temp - (100 - req.Humidity) / 5.0)
    advisory = get_crop_advisory(
        profile=profile,
        humidity=req.Humidity,
        atmospheric_temp=req.Atmospheric_Temp,
        soil_temp=req.Soil_Temp,
        soil_moisture=req.Soil_Moisture,
        dew_point=dew_point,
    )
    result["crop_advisory"] = advisory
    return result


# ------------------------------------------------------------------ #
#  Crop Profiles                                                       #
# ------------------------------------------------------------------ #

@router.get("/crops")
async def get_crops(db: Session = Depends(dependencies.get_db)):
    """Return available crop profiles from database."""
    crops = db.query(CropProfile).all()
    return [c.to_dict() for c in crops]


class CropProfileUpdate(BaseModel):
    name: str | None = None
    emoji: str | None = None
    description: str | None = None
    optimal: dict | None = None  # JSON structure matching to_dict
    warning: dict | None = None

@router.put("/crops/{crop_id}")
async def update_crop(crop_id: str, req: CropProfileUpdate, db: Session = Depends(dependencies.get_db)):
    crop = db.query(CropProfile).filter(CropProfile.id == crop_id).first()
    if not crop:
        return {"error": "Crop not found"}, 404

    if req.name: crop.name = req.name
    if req.emoji: crop.emoji = req.emoji
    if req.description: crop.description = req.description

    # Map nested dicts back to columns
    if req.optimal:
        opt = req.optimal
        if 'humidity' in opt:
            crop.opt_hum_min, crop.opt_hum_max = opt['humidity']
        if 'atmospheric_temp' in opt:
            crop.opt_temp_min, crop.opt_temp_max = opt['atmospheric_temp']
        if 'soil_temp' in opt:
            crop.opt_soil_temp_min, crop.opt_soil_temp_max = opt['soil_temp']
        if 'soil_moisture' in opt:
            crop.opt_soil_moisture_min, crop.opt_soil_moisture_max = opt['soil_moisture']
        if 'dew_point' in opt:
            crop.opt_dew_point_min, crop.opt_dew_point_max = opt['dew_point']

    if req.warning:
        warn = req.warning
        if 'humidity' in warn:
            crop.warn_hum_min, crop.warn_hum_max = warn['humidity']
        if 'atmospheric_temp' in warn:
            crop.warn_temp_min, crop.warn_temp_max = warn['atmospheric_temp']
        if 'soil_temp' in warn:
            crop.warn_soil_temp_min, crop.warn_soil_temp_max = warn['soil_temp']
        if 'soil_moisture' in warn:
            crop.warn_soil_moisture_min, crop.warn_soil_moisture_max = warn['soil_moisture']
        if 'dew_point' in warn:
            crop.warn_dew_point_min, crop.warn_dew_point_max = warn['dew_point']

    db.commit()
    return crop.to_dict()


@router.post("/crops/advisory")
async def get_crop_advisory_endpoint(
    payload: PredictRequest,
    db: Session = Depends(dependencies.get_db)
):
    """Return per-metric crop advisory without running ML prediction."""
    profile_db = db.query(CropProfile).filter(CropProfile.id == payload.crop_type).first()
    profile = profile_db.to_dict() if profile_db else None

    dew_point = payload.Atmospheric_Temp - (100 - payload.Humidity) / 5.0
    return get_crop_advisory(
        profile=profile,
        humidity=payload.Humidity,
        atmospheric_temp=payload.Atmospheric_Temp,
        soil_temp=payload.Soil_Temp,
        soil_moisture=payload.Soil_Moisture,
        dew_point=dew_point,
    )


# ------------------------------------------------------------------ #
#  Model Metrics                                                       #
# ------------------------------------------------------------------ #

@router.get("/models/metrics")
async def get_model_metrics(db: Session = Depends(dependencies.get_db)):
    metrics = db.query(ModelMetrics).order_by(ModelMetrics.trained_at.desc()).limit(3).all()
    return [m.to_dict() for m in metrics]





# ------------------------------------------------------------------ #
#  Training                                                            #
# ------------------------------------------------------------------ #

class RetrainRequest(BaseModel):
    models: list[str] | None = None

@router.post("/training/retrain")
async def manual_retrain(req: RetrainRequest = None):
    models = req.models if req else None
    await dependencies.greenhouse_service.run_retraining(models=models)
    return {"message": "Retraining started"}


# ------------------------------------------------------------------ #
#  AI Analysis (Groq / Llama-3)                                        #
# ------------------------------------------------------------------ #

class AnalyzeRequest(BaseModel):
    results: dict
    best_model: str
    sample_count: int

@router.post("/ai/analyze")
async def ai_analyze(req: AnalyzeRequest):
    import os
    from groq import Groq
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        return {"error": "GROQ_API_KEY chua duoc cau hinh. Vao console.groq.com lay key mien phi."}

    best = req.results.get(req.best_model, {})
    reg_lines = "\n".join(
        f"- {v['name']}: R\u00b2={v['r2']}, RMSE={v['rmse']}, MAE={v['mae']}"
        for v in req.results.values()
    )

    prompt = (
        "Ban la chuyen gia Machine Learning. Hay phan tich ket qua huan luyen he thong "
        "du doan nhu cau tuoi nuoc cho nha kinh thong minh bang tieng Viet, ngan gon (6-8 cau).\n\n"
        f"Du lieu: {req.sample_count} ban ghi cam bien (nhiet do, do am khong khi, do am dat, diem suong).\n\n"
        f"Ket qua hoi quy:\n{reg_lines}\n"
        f"Mo hinh tot nhat: {best.get('name')} (R\u00b2={best.get('r2')}, RMSE={best.get('rmse')})\n\n"
        "Hay nhan xet tong the: chat luong cac mo hinh, mo hinh nao dang tin cay nhat, "
        "co nen ap dung vao thuc te khong va can luu y dieu gi?"
    )

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=900,
            temperature=0.6,
        )
        return {"analysis": completion.choices[0].message.content}
    except Exception as e:
        return {"error": str(e)}
