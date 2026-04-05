import time
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from xgboost import XGBRegressor, XGBClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix,
)
import joblib
import logging
from datetime import datetime
from pathlib import Path
from core import config
from db.models import SessionLocal, SensorRecord, ModelMetrics, ClassificationMetrics

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent / "trained_models"
MODEL_DIR.mkdir(exist_ok=True)


def train_from_db(models=None):
    """Query all sensor records from DB and train regression + classification models."""
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

        reg_result = _train(data, sample_count=len(data), selected_models=models)
        if not reg_result.get('success'):
            return reg_result

        _REG_TO_CLF = {'linear': 'logistic', 'random_forest': 'random_forest_clf', 'xgboost': 'xgboost_clf'}
        selected_clf = [_REG_TO_CLF[k] for k in (models or _REG_TO_CLF) if k in _REG_TO_CLF]
        clf_output = _train_classification(data, sample_count=len(data), selected_clf_keys=selected_clf)
        if clf_output is not None:
            clf_results, best_clf_model = clf_output
            reg_result['clf_results']    = clf_results
            reg_result['best_clf_model'] = best_clf_model

        return reg_result

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


def _train_classification(data: pd.DataFrame, sample_count: int, selected_clf_keys=None):
    """Classification training — Logistic, Random Forest Classifier, XGBoost Classifier."""
    y_clf = data[config.TARGET_COLUMN].astype(int)
    X     = data[config.FEATURE_COLUMNS]

    if y_clf.nunique() < 2:
        logger.warning("Classification skipped: target has only one class (check water_flow values)")
        return None

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_clf,
        test_size=config.TRAIN_TEST_SPLIT,
        random_state=config.RANDOM_STATE,
        stratify=y_clf,
    )
    logger.info(f"Classification split — Train:{len(X_train)} Test:{len(X_test)}")

    scaler    = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    all_clf_defs = {
        'logistic': (
            LogisticRegression(**{k: v for k, v in config.CLF_MODEL_CONFIGS['logistic'].items() if k != 'name'}),
            X_train_s, X_test_s,
        ),
        'random_forest_clf': (
            RandomForestClassifier(**{k: v for k, v in config.CLF_MODEL_CONFIGS['random_forest_clf'].items() if k != 'name'}),
            X_train, X_test,
        ),
        'xgboost_clf': (
            XGBClassifier(**{k: v for k, v in config.CLF_MODEL_CONFIGS['xgboost_clf'].items() if k != 'name'}),
            X_train, X_test,
        ),
    }
    clf_defs = {k: v for k, v in all_clf_defs.items() if k in (selected_clf_keys or all_clf_defs)}

    clf_results        = {}
    predictions_store  = {}

    db = SessionLocal()
    try:
        for key, (model, Xtr, Xte) in clf_defs.items():
            logger.info(f"Training classifier {key}...")
            t0 = time.perf_counter()
            model.fit(Xtr, y_train)
            train_time = time.perf_counter() - t0

            y_pred = model.predict(Xte)
            y_prob = (
                model.predict_proba(Xte)[:, 1]
                if hasattr(model, 'predict_proba') else y_pred.astype(float)
            )

            cm = confusion_matrix(y_test, y_pred).tolist()

            acc  = round(float(accuracy_score(y_test, y_pred)), 4)
            prec = round(float(precision_score(y_test, y_pred, zero_division=0)), 4)
            rec  = round(float(recall_score(y_test, y_pred, zero_division=0)), 4)
            f1   = round(float(f1_score(y_test, y_pred, zero_division=0)), 4)
            try:
                auc = round(float(roc_auc_score(y_test, y_prob)), 4)
            except Exception:
                auc = None

            logger.info(f"{key} — Acc:{acc} Prec:{prec} Rec:{rec} F1:{f1} AUC:{auc}")

            clf_results[key] = {
                'name':             config.CLF_MODEL_CONFIGS[key]['name'],
                'accuracy':         acc,
                'precision':        prec,
                'recall':           rec,
                'f1':               f1,
                'auc':              auc,
                'train_time':       round(train_time, 4),
                'confusion_matrix': cm,
            }
            predictions_store[key] = y_pred

            joblib.dump(model, MODEL_DIR / f"{key}_model.pkl")
            db.add(ClassificationMetrics(
                model_name   = config.CLF_MODEL_CONFIGS[key]['name'],
                accuracy     = acc,
                precision    = prec,
                recall       = rec,
                f1           = f1,
                auc          = auc if auc is not None else 0.0,
                trained_at   = datetime.utcnow(),
                sample_count = sample_count,
            ))

        db.commit()
    finally:
        db.close()

    best_clf = max(clf_results, key=lambda k: clf_results[k]['f1'])
    logger.info(f"Classification complete! Best: {best_clf} (F1={clf_results[best_clf]['f1']})")
    return clf_results, best_clf


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
