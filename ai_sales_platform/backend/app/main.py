from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.services.model_registry import ModelRegistry
import logging


configure_logging()

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Sales Intelligence Platform API",
    version=settings.api_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
def _startup() -> None:
    # Load model + data once at startup (no retraining at runtime).
    try:
        ModelRegistry.get_instance().initialize()
    except Exception:
        logger.exception("startup_asset_init_failed")
