from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core import config, dependencies
from core.crop_profiles import get_crop_advisory
from db.models import SensorRecord, ModelMetrics, ClassificationMetrics, CropProfile
import csv
import io

router = APIRouter(prefix="/api")


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


@router.get("/models/classification-metrics")
async def get_classification_metrics(db: Session = Depends(dependencies.get_db)):
    metrics = (
        db.query(ClassificationMetrics)
          .order_by(ClassificationMetrics.trained_at.desc())
          .limit(3)
          .all()
    )
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
    clf_results: dict | None = None
    best_clf_model: str | None = None

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

    clf_section = ""
    if req.clf_results:
        clf_lines = "\n".join(
            f"- {v['name']}: Accuracy={v.get('accuracy')}, F1={v.get('f1')}, AUC={v.get('auc')}"
            for v in req.clf_results.values()
        )
        best_clf = req.clf_results.get(req.best_clf_model or "", {})
        clf_section = (
            f"\n\nKet qua phan loai (phan loai can tuoi / khong can tuoi):\n{clf_lines}\n"
            f"Mo hinh phan loai tot nhat: {best_clf.get('name')} "
            f"(F1={best_clf.get('f1')}, AUC={best_clf.get('auc')})"
        )

    prompt = (
        "Ban la chuyen gia Machine Learning. Hay phan tich ket qua huan luyen he thong "
        "du doan nhu cau tuoi nuoc cho nha kinh thong minh bang tieng Viet, ngan gon (6-8 cau).\n\n"
        f"Du lieu: {req.sample_count} ban ghi cam bien (nhiet do, do am khong khi, do am dat, diem suong).\n\n"
        f"Ket qua hoi quy (du doan luong nuoc can - lien tuc):\n{reg_lines}\n"
        f"Mo hinh hoi quy tot nhat: {best.get('name')} (R\u00b2={best.get('r2')}, RMSE={best.get('rmse')})"
        f"{clf_section}\n\n"
        "Hay nhan xet tong the: chat luong ca hai nhom mo hinh, mo hinh nao dang tin cay nhat, "
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
