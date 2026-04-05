from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core import config, dependencies
from db.models import SensorRecord, ModelMetrics, ClassificationMetrics

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

@router.post("/sensor/predict")
async def predict_manual(req: PredictRequest):
    result = dependencies.greenhouse_service.predict_manual(
        req.Humidity, req.Atmospheric_Temp, req.Soil_Temp, req.Soil_Moisture
    )
    return result


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
