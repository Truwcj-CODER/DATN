from sqlalchemy import Column, Integer, String, Float, DateTime, create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
from core import config

Base = declarative_base()


class SensorRecord(Base):
    __tablename__ = 'sensor_records'

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(100))
    time = Column(String(50), nullable=False)
    humidity = Column(Float, nullable=False, default=0.0)
    atmospheric_temp = Column(Float, nullable=False, default=0.0)
    soil_temp = Column(Float, nullable=False, default=0.0)
    soil_moisture = Column(Float, nullable=False, default=0.0)
    dew_point = Column(Float, nullable=False, default=0.0)
    water_need = Column(Float, nullable=False, default=0.0)
    water_flow = Column(Float, nullable=False, default=0.0)
    prediction = Column(String(100))
    confidence = Column(Float, nullable=False, default=0.0)
    crop_type = Column(String(20), nullable=False, default='tomato')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'deviceId': self.device_id,
            'time': self.time,
            'humidity': self.humidity,
            'atmospheric_Temp': self.atmospheric_temp,
            'soil_Temp': self.soil_temp,
            'soil_Moisture': self.soil_moisture,
            'dew_Point': self.dew_point,
            'water_Need': self.water_need,
            'water_Flow': self.water_flow,
            'prediction': self.prediction,
            'confidence': self.confidence,
            'crop_type': self.crop_type or 'tomato',
        }


class ModelMetrics(Base):
    __tablename__ = 'model_metrics'

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_name = Column(String(50), nullable=False)
    rmse = Column(Float, nullable=False)
    mae = Column(Float, nullable=False)
    r2 = Column(Float, nullable=False)
    trained_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    sample_count = Column(Integer, nullable=False)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'modelName': self.model_name,
            'rmse': round(self.rmse, 4),
            'mae': round(self.mae, 4),
            'r2': round(self.r2, 4),
            'trainedAt': self.trained_at.isoformat(),
            'sampleCount': self.sample_count,
        }


class ClassificationMetrics(Base):
    __tablename__ = 'classification_metrics'

    id           = Column(Integer, primary_key=True, autoincrement=True)
    model_name   = Column(String(50), nullable=False)
    accuracy     = Column(Float, nullable=False)
    precision    = Column(Float, nullable=False)
    recall       = Column(Float, nullable=False)
    f1           = Column(Float, nullable=False)
    auc          = Column(Float, nullable=False)
    trained_at   = Column(DateTime, nullable=False, default=datetime.utcnow)
    sample_count = Column(Integer, nullable=False)

    def to_dict(self) -> dict:
        return {
            'id':          self.id,
            'modelName':   self.model_name,
            'accuracy':    round(self.accuracy,  4),
            'precision':   round(self.precision, 4),
            'recall':      round(self.recall,    4),
            'f1':          round(self.f1,        4),
            'auc':         round(self.auc,       4),
            'trainedAt':   self.trained_at.isoformat(),
            'sampleCount': self.sample_count,
        }


class CropProfile(Base):
    __tablename__ = 'crop_profiles'

    id = Column(String(50), primary_key=True)  # e.g., 'tomato', 'melon'
    name = Column(String(100), nullable=False)
    emoji = Column(String(10))
    description = Column(String(500))

    # Optimal ranges
    opt_hum_min = Column(Float, default=60.0)
    opt_hum_max = Column(Float, default=80.0)
    opt_temp_min = Column(Float, default=20.0)
    opt_temp_max = Column(Float, default=30.0)
    opt_soil_temp_min = Column(Float, default=18.0)
    opt_soil_temp_max = Column(Float, default=25.0)
    opt_soil_moisture_min = Column(Float, default=60.0)
    opt_soil_moisture_max = Column(Float, default=80.0)
    opt_dew_point_min = Column(Float, default=10.0)
    opt_dew_point_max = Column(Float, default=22.0)

    # Warning ranges
    warn_hum_min = Column(Float, default=45.0)
    warn_hum_max = Column(Float, default=90.0)
    warn_temp_min = Column(Float, default=15.0)
    warn_temp_max = Column(Float, default=35.0)
    warn_soil_temp_min = Column(Float, default=12.0)
    warn_soil_temp_max = Column(Float, default=30.0)
    warn_soil_moisture_min = Column(Float, default=40.0)
    warn_soil_moisture_max = Column(Float, default=90.0)
    warn_dew_point_min = Column(Float, default=5.0)
    warn_dew_point_max = Column(Float, default=26.0)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'emoji': self.emoji,
            'description': self.description,
            'optimal': {
                'humidity': (self.opt_hum_min, self.opt_hum_max),
                'atmospheric_temp': (self.opt_temp_min, self.opt_temp_max),
                'soil_temp': (self.opt_soil_temp_min, self.opt_soil_temp_max),
                'soil_moisture': (self.opt_soil_moisture_min, self.opt_soil_moisture_max),
                'dew_point': (self.opt_dew_point_min, self.opt_dew_point_max),
            },
            'warning': {
                'humidity': (self.warn_hum_min, self.warn_hum_max),
                'atmospheric_temp': (self.warn_temp_min, self.warn_temp_max),
                'soil_temp': (self.warn_soil_temp_min, self.warn_soil_temp_max),
                'soil_moisture': (self.warn_soil_moisture_min, self.warn_soil_moisture_max),
                'dew_point': (self.warn_dew_point_min, self.warn_dew_point_max),
            }
        }


engine = create_engine(
    config.DATABASE_URL,
    echo=config.DB_ECHO,
    pool_pre_ping=True,
    pool_recycle=3600,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)

    # ── Auto-migration: add crop_type column if missing ──────────────────
    try:
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = 'sensor_records' "
                "AND COLUMN_NAME = 'crop_type'"
            ))
            exists = result.scalar()
            if not exists:
                conn.execute(text(
                    "ALTER TABLE sensor_records "
                    "ADD COLUMN crop_type VARCHAR(20) NOT NULL DEFAULT 'tomato'"
                ))
                conn.commit()
                print("[init_db] Migration: added crop_type column to sensor_records")
            else:
                print("[init_db] crop_type column already exists, skipping migration")
    except Exception as e:
        print(f"[init_db] Migration warning: {e}")

    # Seed initial crop profiles if empty
    db = SessionLocal()
    try:
        count = db.query(CropProfile).count()
        if count == 0:
            from core.crop_profiles import CROP_PROFILES
            for crop_id, data in CROP_PROFILES.items():
                opt = data['optimal']
                warn = data.get('warning', {})
                db.add(CropProfile(
                    id=crop_id,
                    name=data['name'],
                    emoji=data['emoji'],
                    description=data.get('description', ''),
                    opt_hum_min=opt['humidity'][0], opt_hum_max=opt['humidity'][1],
                    opt_temp_min=opt['atmospheric_temp'][0], opt_temp_max=opt['atmospheric_temp'][1],
                    opt_soil_temp_min=opt['soil_temp'][0], opt_soil_temp_max=opt['soil_temp'][1],
                    opt_soil_moisture_min=opt['soil_moisture'][0], opt_soil_moisture_max=opt['soil_moisture'][1],
                    opt_dew_point_min=opt['dew_point'][0], opt_dew_point_max=opt['dew_point'][1],
                    warn_hum_min=warn['humidity'][0], warn_hum_max=warn['humidity'][1],
                    warn_temp_min=warn['atmospheric_temp'][0], warn_temp_max=warn['atmospheric_temp'][1],
                    warn_soil_temp_min=warn['soil_temp'][0], warn_soil_temp_max=warn['soil_temp'][1],
                    warn_soil_moisture_min=warn['soil_moisture'][0], warn_soil_moisture_max=warn['soil_moisture'][1],
                    warn_dew_point_min=warn['dew_point'][0], warn_dew_point_max=warn['dew_point'][1],
                ))
            db.commit()
    except Exception as e:
        print(f"Error seeding DB: {e}")
    finally:
        db.close()

