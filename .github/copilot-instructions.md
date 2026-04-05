# Greenhouse IoT — Copilot Instructions

## Architecture

```
backend/          FastAPI + python-socketio (port 5000)
  api/routes.py   REST: POST /api/sensor/push, GET /api/sensor/devices,
                        POST /api/sensor/predict, GET /api/sensor/history,
                        POST /api/sensor/logging, GET /api/models/metrics,
                        POST /api/training/retrain
  core/config.py  All constants & env vars — single source of truth
  db/models.py    SQLAlchemy ORM: SensorRecord, ModelMetrics (snake_case columns)
  services/
    greenhouse.py  handle_push() receives ESP32 data, device_registry for status
    ml_trainer.py  train_from_db() → _train() core, returns chart_data per model
frontend/         React 19 + Vite (port 3000 in dev)
  src/components/ Navbar, Dashboard, HistoryTable, Training, Settings, LoadingOverlay
  src/hooks/      useSensor.js — socket.io + trainResult state
  src/services/   api.js (axios), socket.js (socket.io-client)
```

FastAPI serves `frontend/dist` as SPA in production. DB is MySQL 8.0 via Docker.

## Build & Run

```powershell
# Full stack (Docker)
docker-compose up --build

# Frontend build (required before Docker backend serves it)
cd frontend ; npm install ; npm run build

# Backend dev only (needs MySQL running)
cd backend ; uvicorn main:socket_app --host 0.0.0.0 --port 5000 --reload

# Frontend dev
cd frontend ; npm run dev
```

URLs: App `http://localhost:5000` · phpMyAdmin `http://localhost:8080`

## Database Conventions

- ORM columns: **snake_case** (`device_id`, `atmospheric_temp`, `soil_moisture`)
- `to_dict()` keys: **camelCase** for frontend (`deviceId`, `atmospheric_Temp`)
- Never use PascalCase for column kwargs (e.g. `SensorRecord(humidity=...) ✓`, `Humidity=... ✗`)

## ML Pattern

Models defined in `config.MODEL_CONFIGS`. Features: `FEATURE_COLUMNS`. Target: `TARGET_COLUMN = 'Water_Need'`.
Trained models saved as `.pkl` in `backend/trained_models/`.
DataFrame columns must match `FEATURE_COLUMNS` exactly (PascalCase: `Humidity`, `Atmospheric_Temp`, ...).

## Socket.IO Events

| Direction | Event | Payload |
|-----------|-------|---------|
| Server→Client | `receive_sensor_data` | sensor record dict |
| Server→Client | `training_status` | `{status, message}` |
| Client→Server | `toggle_logging` | `bool` |
| Client→Server | `start_retrain` | — |

## Environment

All config via `.env` — see `backend/core/config.py`. In Docker, `DB_HOST=mysql` (service name, not localhost).
Never hardcode credentials; use `os.getenv('KEY') or 'default'` pattern.
