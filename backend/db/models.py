from sqlalchemy import Column, Integer, String, Float, DateTime, create_engine
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


engine = create_engine(
    config.DATABASE_URL,
    echo=config.DB_ECHO,
    pool_pre_ping=True,
    pool_recycle=3600,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
