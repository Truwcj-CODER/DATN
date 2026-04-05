from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import socketio, logging, asyncio
from pathlib import Path
from core import config, dependencies
from db.models import init_db
from services.greenhouse import GreenhouseService
from api.routes import router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

async def init_db_with_retry(retries=10, delay=3):
    for i in range(retries):
        try:
            init_db()
            return
        except Exception as e:
            logger.warning(f"DB not ready ({i+1}/{retries}): {e}")
            if i < retries - 1:
                await asyncio.sleep(delay)
    raise RuntimeError("Could not connect to database after retries")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_with_retry()
    dependencies.greenhouse_service = GreenhouseService(sio)
    dependencies.greenhouse_service.start()
    try:
        from services.ml_trainer import load_trained_models
        dependencies.greenhouse_service.models = load_trained_models()
    except:
        logger.warning("No pre-trained models found")
    logger.info(f"Server ready on {config.HOST}:{config.PORT}")
    yield

app = FastAPI(title="Greenhouse IoT API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)

@sio.on("connect")
async def on_connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.on("disconnect")
async def on_disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.on("toggle_logging")
async def on_toggle_logging(sid, enabled):
    dependencies.greenhouse_service.set_logging_enabled(enabled)

@sio.on("start_retrain")
async def on_start_retrain(sid):
    await dependencies.greenhouse_service.run_retraining()

dist_path = Path(__file__).parent.parent / "frontend" / "out"
if dist_path.exists():
    app.mount("/static", StaticFiles(directory=str(dist_path)), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Next.js export tạo file .html cho mỗi route
        candidates = [
            dist_path / full_path,
            dist_path / full_path / "index.html",
            dist_path / (full_path + ".html"),
            dist_path / "index.html",
        ]
        for f in candidates:
            if f.exists() and f.is_file():
                return FileResponse(f)
        return FileResponse(dist_path / "index.html")

socket_app = socketio.ASGIApp(sio, app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host=config.HOST, port=config.PORT)
