import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging
from db.models import SensorRecord, SessionLocal
from core import config

logger = logging.getLogger(__name__)

DEVICE_OFFLINE_SECONDS = 30


class GreenhouseService:

    def __init__(self, sio):
        self.sio = sio
        self.models = None
        # device_id -> last_seen datetime
        self.device_registry: Dict[str, datetime] = {}

    # ------------------------------------------------------------------ #
    #  ESP32 Push Handler                                                  #
    # ------------------------------------------------------------------ #

    async def handle_push(self, payload: dict):
        """Called when an ESP32 POSTs sensor data."""
        device_id = payload.get('device_id', 'unknown')
        self.device_registry[device_id] = datetime.utcnow()

        record = self._build_record(device_id, payload)
        await self.sio.emit('receive_sensor_data', record)
        await self._save_to_db(record)

    # ------------------------------------------------------------------ #
    #  Device Status                                                       #
    # ------------------------------------------------------------------ #

    def get_device_status(self) -> list:
        threshold = datetime.utcnow() - timedelta(seconds=DEVICE_OFFLINE_SECONDS)
        return [
            {
                'deviceId': did,
                'online': last_seen >= threshold,
                'lastSeen': last_seen.strftime('%Y-%m-%dT%H:%M:%S'),
            }
            for did, last_seen in self.device_registry.items()
        ]

    # ------------------------------------------------------------------ #
    #  Logging & Retraining                                               #
    # ------------------------------------------------------------------ #

    def set_logging_enabled(self, enabled: bool):
        self.is_logging_enabled = enabled
        logger.info(f"Logging {'enabled' if enabled else 'disabled'}")

    async def run_retraining(self, models=None):
        try:
            await self.sio.emit('training_status', {"status": "started"})
            label = ', '.join(models) if models else 'all'
            logger.info(f"Starting training for: {label}")

            from services.ml_trainer import train_from_db
            results = await asyncio.to_thread(train_from_db, models)

            if results and results.get('success'):
                from services.ml_trainer import load_trained_models
                self.models = load_trained_models()
                logger.info(f"Models reloaded. Best: {results.get('best_model')}")
                await self.sio.emit('models_updated', results)

            await self.sio.emit('training_status', {"status": "finished"})
            logger.info("Training completed!")

        except Exception as e:
            logger.error(f"Training error: {e}")
            await self.sio.emit('training_status', {"status": "finished"})

    # ------------------------------------------------------------------ #
    #  Prediction (manual mode)                                           #
    # ------------------------------------------------------------------ #

    def predict_manual(self, humidity: float, atmospheric_temp: float,
                       soil_temp: float, soil_moisture: float) -> dict:
        dew_point = atmospheric_temp - (100 - humidity) / 5.0
        if not self.models:
            return {}
        features = [[humidity, atmospheric_temp, soil_temp, soil_moisture, dew_point]]
        try:
            return {
                'linear': round(float(self.models['linear'].predict(features)[0]), 4),
                'random_forest': round(float(self.models['random_forest'].predict(features)[0]), 4),
                'xgboost': round(float(self.models['xgboost'].predict(features)[0]), 4),
                'dew_point': round(dew_point, 3),
            }
        except Exception as e:
            logger.warning(f"Manual prediction error: {e}")
            return {}

    # ------------------------------------------------------------------ #
    #  Internals                                                           #
    # ------------------------------------------------------------------ #

    def _build_record(self, device_id: str, payload: dict) -> dict:
        h          = float(payload.get('Humidity', 0.0) or 0.0)
        t          = float(payload.get('Atmospheric_Temp', 0.0) or 0.0)
        soil_temp  = float(payload.get('Soil_Temp', 0.0) or 0.0)
        soil_moist = float(payload.get('Soil_Moisture', 0.0) or 0.0)
        water_flow = float(payload.get('Water_Flow', 0.0) or 0.0)

        dew_point  = t - (100 - h) / 5.0
        water_need = 1.0 if water_flow > 0.05 else 0.0

        predictions: dict = {}
        if self.models:
            features = [[h, t, soil_temp, soil_moist, dew_point]]
            try:
                predictions = {
                    'linear':        round(float(self.models['linear'].predict(features)[0]), 4),
                    'random_forest': round(float(self.models['random_forest'].predict(features)[0]), 4),
                    'xgboost':       round(float(self.models['xgboost'].predict(features)[0]), 4),
                }
            except Exception as e:
                logger.warning(f"Prediction error: {e}")

        return {
            'time':            datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
            'deviceId':        device_id,
            'humidity':        h,
            'atmospheric_Temp': t,
            'soil_Temp':       soil_temp,
            'soil_Moisture':   soil_moist,
            'dew_Point':       round(dew_point, 3),
            'water_Flow':      water_flow,
            'water_Need':      water_need,
            'predictions':     predictions,
        }

    async def _save_to_db(self, record: dict):
        try:
            db = SessionLocal()
            db.add(SensorRecord(
                time=record['time'],
                device_id=record['deviceId'],
                humidity=record['humidity'],
                atmospheric_temp=record['atmospheric_Temp'],
                soil_temp=record['soil_Temp'],
                soil_moisture=record['soil_Moisture'],
                dew_point=record['dew_Point'],
                water_flow=record['water_Flow'],
                water_need=record['water_Need'],
                prediction=None,
                confidence=0.0,
            ))
            db.commit()
            db.close()
        except Exception as e:
            logger.error(f"Database save error: {e}")

    def start(self):
        logger.info("GreenhouseService ready — waiting for ESP32 push data")
