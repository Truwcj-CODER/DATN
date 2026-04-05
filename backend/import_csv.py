"""One-off script: import DATA.csv into sensor_records table."""
import csv, sys, os

# avoid circular import — build DB URL directly from env
DB_USER     = os.getenv('DB_USER',     'greenhouse_user')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'greenhouse_pass')
DB_HOST     = os.getenv('DB_HOST',     'mysql')
DB_PORT     = os.getenv('DB_PORT',     '3306')
DB_NAME     = os.getenv('DB_NAME',     'greenhouse_db')

from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker

DB_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DB_URL)
Base = declarative_base()

class SensorRecord(Base):
    __tablename__ = 'sensor_records'
    id               = Column(Integer, primary_key=True, autoincrement=True)
    device_id        = Column(String(100))
    time             = Column(String(50))
    humidity         = Column(Float, default=0.0)
    atmospheric_temp = Column(Float, default=0.0)
    soil_temp        = Column(Float, default=0.0)
    soil_moisture    = Column(Float, default=0.0)
    dew_point        = Column(Float, default=0.0)
    water_need       = Column(Float, default=0.0)
    water_flow       = Column(Float, default=0.0)
    prediction       = Column(String(100))
    confidence       = Column(Float, default=0.0)

Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
session = Session()

CSV_PATH = '/app/DATA.csv'

inserted = 0
with open(CSV_PATH, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    batch = []
    for row in reader:
        record = SensorRecord(
            device_id        = 'CSV_IMPORT',
            time             = row['Time'],
            humidity         = float(row['Humidity']),
            atmospheric_temp = float(row['Atmospheric_Temp']),
            soil_temp        = float(row['Soil_Temp']),
            soil_moisture    = float(row['Soil_Moisture']),
            dew_point        = float(row['Dew_Point']),
            water_need       = float(row['Water_Need']),
            water_flow       = float(row['Water_Flow']),
            prediction       = 'Cần tưới' if float(row['Water_Need']) > 0.5 else 'Không cần tưới',
            confidence       = 0.0,
        )
        batch.append(record)
        if len(batch) >= 500:
            session.bulk_save_objects(batch)
            session.commit()
            inserted += len(batch)
            print(f"  Inserted {inserted} rows...")
            batch = []
    if batch:
        session.bulk_save_objects(batch)
        session.commit()
        inserted += len(batch)

print(f"\nDone! Total inserted: {inserted} records.")
session.close()
