# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IoT greenhouse monitoring system with real-time sensor data, machine learning predictions, and an AI-powered analysis dashboard. ESP32 hardware sensors push data to a FastAPI backend; a React frontend visualizes it via Socket.io.

## Commands

### Full Stack (Docker)
```bash
docker-compose up --build
# App: http://localhost:5000 | phpMyAdmin: http://localhost:8080
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Dev server on http://localhost:3000 (proxies /api/* and /socket.io/* to port 5000)
npm run build    # Production build → frontend/dist/
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Backend (requires MySQL running)
```bash
cd backend
uvicorn main:socket_app --host 0.0.0.0 --port 5000 --reload
```

## Architecture

### Data Flow
```
ESP32 → POST /api/sensor/push → GreenhouseService.handle_push()
                                      ↓ emit Socket.io event
                                 Frontend (live chart/values)
                                      ↓ persist to DB
                                 MySQL sensor_records table

Frontend [Retrain] → POST /api/training/retrain
                          ↓ async, emits training_status events
                     ml_trainer.train_from_db() → 3 .pkl files
                          ↓ emits models_updated
                     Frontend Training component (charts)
```

### Backend (`backend/`)
- **main.py** — App entry point: FastAPI + Socket.io setup, lifespan (DB connect → load models → start service), serves SPA from `frontend/dist`
- **api/routes.py** — All REST endpoints
- **services/greenhouse.py** — `GreenhouseService`: device registry (30s timeout), `handle_push()` (dew point calc, prediction, Socket emit), `predict_manual()`
- **services/ml_trainer.py** — `train_from_db()`: queries DB → DataFrame → trains 3 models → saves `.pkl` → stores metrics in DB. Split: 70% train / 30% test (test further split 66%/33%)
- **db/models.py** — SQLAlchemy ORM: `SensorRecord`, `ModelMetrics` (auto-created on startup)
- **core/config.py** — Single source of truth: `FEATURE_COLUMNS`, `TARGET_COLUMN`, `MODEL_CONFIGS`, `HISTORY_LIMIT`
- **core/dependencies.py** — Global `GreenhouseService` instance and DB session provider

### Frontend (`frontend/src/`)
- **App.jsx** — Root: tab-based navigation, dark mode toggle (localStorage)
- **hooks/useSensor.js** — Socket.io connection, listens for `receive_sensor_data` / `training_status` / `models_updated`, maintains history (max 100 records FIFO)
- **services/socket.js** — Socket.io client (polling + WebSocket transports)
- **services/api.js** — Axios instance for REST calls
- **components/** — `Dashboard` (live chart, current values, predictions), `HistoryTable` (sortable/filterable), `Training` (metrics charts, AI analysis), `Settings` (logging toggle, device status), `Navbar`, `LoadingOverlay`

### ML Models
Three models trained in parallel:
1. **Linear Regression** — baseline
2. **Random Forest** — 100 trees, `max_depth=10`
3. **XGBoost** — 100 trees, `max_depth=3`, `lr=0.1`

Features (PascalCase in DataFrame): `Humidity`, `Atmospheric_Temp`, `Soil_Temp`, `Soil_Moisture`, `Dew_Point`
Target: `Water_Need` (continuous; `>0.5` → needs watering)
Serialized to: `backend/trained_models/*.pkl`

## Key Conventions

### Database
- ORM column names: **snake_case** (`device_id`, `atmospheric_temp`, `soil_moisture`)
- `to_dict()` output for frontend: **camelCase** (`deviceId`, `atmospheric_Temp`)
- Never use PascalCase in ORM kwargs: `SensorRecord(humidity=...)` ✓, `SensorRecord(Humidity=...)` ✗

### ML DataFrames
- Column names must match `FEATURE_COLUMNS` in `config.py` **exactly** (PascalCase)
- Do not add new models without adding them to `MODEL_CONFIGS` in `config.py`

### Socket.IO Events

| Direction      | Event                | Payload                   |
|---------------|----------------------|---------------------------|
| Server→Client | `receive_sensor_data`| sensor record dict        |
| Server→Client | `training_status`    | `{status, message}`       |
| Server→Client | `models_updated`     | —                         |
| Client→Server | `toggle_logging`     | `bool`                    |
| Client→Server | `start_retrain`      | —                         |

### Environment
All config via `.env` → `backend/core/config.py`. In Docker, `DB_HOST=mysql` (Docker service name). In local dev, `DB_HOST=localhost`.

### AI Analysis
`POST /api/ai/analyze` calls Groq API (Llama-3-8b). Requires `GROQ_API_KEY` in `.env`. Responses are in Vietnamese.
