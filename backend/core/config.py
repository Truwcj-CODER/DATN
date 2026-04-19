import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = (
    f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)
DB_ECHO = os.getenv('DB_ECHO', 'false').lower() == 'true'

# Server
HOST: str = os.getenv('HOST') or '0.0.0.0'
PORT: int = int(os.getenv('PORT') or '5000')

# Polling
POLL_INTERVAL: int = 2
HTTP_TIMEOUT: int = 2

# API
HISTORY_LIMIT: int = 100

# ML
RANDOM_STATE: int = 42
TRAIN_TEST_SPLIT: float = 0.3
VAL_TEST_SPLIT: float = 0.333

FEATURE_COLUMNS = ['Humidity', 'Atmospheric_Temp', 'Soil_Temp', 'Soil_Moisture', 'Dew_Point']
TARGET_COLUMN = 'Water_Need'

MODEL_CONFIGS = {
    'linear':       {'name': 'Linear Regression'},
    'random_forest': {'name': 'Random Forest', 'n_estimators': 100, 'max_depth': 10, 'random_state': RANDOM_STATE},
    'xgboost':      {'name': 'XGBoost', 'n_estimators': 100, 'max_depth': 3, 'learning_rate': 0.1, 'random_state': RANDOM_STATE},
}


