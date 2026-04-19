import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import joblib
import logging
from datetime import datetime
from pathlib import Path
from core import config
from db.models import SessionLocal, SensorRecord, ModelMetrics

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent / "trained_models"
MODEL_DIR.mkdir(exist_ok=True)


def train_from_db(models=None):
    """Query all sensor records from DB and train regression models."""
    try:
        logger.info("Loading data from database...")
        db = SessionLocal()
        records = db.query(SensorRecord).all()
        db.close()

        if len(records) < 10:
            logger.warning(f"Insufficient data: {len(records)} records (need ≥10)")
            return {'success': False, 'error': f'Need at least 10 records, have {len(records)}'}

        data = pd.DataFrame([{
            'Humidity':         r.humidity,
            'Atmospheric_Temp': r.atmospheric_temp,
            'Soil_Temp':        r.soil_temp,
            'Soil_Moisture':    r.soil_moisture,
            'Dew_Point':        r.dew_point,
            'Water_Need':       r.water_need,
        } for r in records])

        data = data.dropna()
        if len(data) < 10:
            return {'success': False, 'error': 'Not enough valid (non-null) records after cleaning'}

        return _train(data, sample_count=len(data), selected_models=models)

    except Exception as e:
        logger.error(f"Training failed: {e}")
        import traceback; traceback.print_exc()
        return {'success': False, 'error': str(e)}


def _train(data: pd.DataFrame, sample_count: int, selected_models=None) -> dict:
    """Regression training — Linear, Random Forest, XGBoost."""
    valid_keys = {'linear', 'random_forest', 'xgboost'}
    keys_to_train = [k for k in (selected_models or valid_keys) if k in valid_keys] or list(valid_keys)

    X = data[config.FEATURE_COLUMNS]
    y = data[config.TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=config.TRAIN_TEST_SPLIT, random_state=config.RANDOM_STATE
    )
    logger.info(f"Regression split — Train:{len(X_train)} Test:{len(X_test)}")

    all_model_defs = {
        'linear':        LinearRegression(),
        'random_forest': RandomForestRegressor(**{
            k: v for k, v in config.MODEL_CONFIGS['random_forest'].items() if k != 'name'
        }),
        'xgboost':       XGBRegressor(**{
            k: v for k, v in config.MODEL_CONFIGS['xgboost'].items() if k != 'name'
        }),
    }
    model_defs = {k: v for k, v in all_model_defs.items() if k in keys_to_train}

    results          = {}
    chart_data       = {}
    feature_importance = {}
    best_model       = None
    best_r2          = -float('inf')

    # Train & evaluate
    trained_models = {}
    db = SessionLocal()
    try:
        for model_key, model in model_defs.items():
            logger.info(f"Training regression {model_key}...")
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)

            rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
            mae  = float(mean_absolute_error(y_test, y_pred))
            r2   = float(r2_score(y_test, y_pred))

            logger.info(f"{model_key} — RMSE:{rmse:.4f} MAE:{mae:.4f} R²:{r2:.4f}")
            joblib.dump(model, MODEL_DIR / f"{model_key}_model.pkl")
            trained_models[model_key] = model

            db.add(ModelMetrics(
                model_name=config.MODEL_CONFIGS[model_key]['name'],
                rmse=rmse, mae=mae, r2=r2,
                trained_at=datetime.utcnow(),
                sample_count=sample_count,
            ))

            results[model_key] = {
                'name': config.MODEL_CONFIGS[model_key]['name'],
                'rmse': round(rmse, 4),
                'mae':  round(mae, 4),
                'r2':   round(r2, 4),
            }
            chart_data[model_key] = {
                'actual':    [round(float(v), 4) for v in y_test.tolist()],
                'predicted': [round(float(v), 4) for v in y_pred.tolist()],
            }

            if hasattr(model, 'feature_importances_'):
                importances = model.feature_importances_
            elif hasattr(model, 'coef_'):
                importances = np.abs(model.coef_)
                importances = importances / importances.sum() if importances.sum() > 0 else importances
            else:
                importances = np.zeros(len(config.FEATURE_COLUMNS))

            feature_importance[model_key] = [
                {'feature': feat, 'importance': round(float(imp), 4)}
                for feat, imp in sorted(
                    zip(config.FEATURE_COLUMNS, importances),
                    key=lambda x: x[1], reverse=True
                )
            ]

            if r2 > best_r2:
                best_r2    = r2
                best_model = model_key

        db.commit()
    finally:
        db.close()

    logger.info(f"Regression complete! Best: {best_model} (R²={best_r2:.4f})")
    return {
        'success':            True,
        'results':            results,
        'chart_data':         chart_data,
        'feature_importance': feature_importance,
        'best_model':         best_model,
        'sample_count':       sample_count,
    }


# Keep alias for backward compat
train_all_models = train_from_db


def load_trained_models():
    models = {}
    for model_key in ['linear', 'random_forest', 'xgboost']:
        model_path = MODEL_DIR / f"{model_key}_model.pkl"
        if model_path.exists():
            models[model_key] = joblib.load(model_path)
            logger.info(f"Loaded {model_key} model")
        else:
            logger.warning(f"Model not found: {model_path}")
    return models if models else None
