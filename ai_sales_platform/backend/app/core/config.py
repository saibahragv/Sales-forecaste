from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_version: str = "1.0.0"

    # Resolve to the backend folder by default:
    # .../ai_sales_platform/backend/app/core/config.py -> parents[2] == .../backend
    base_dir: Path = Path(__file__).resolve().parents[2]
    data_path: Path = base_dir / "data" / "train.csv"
    model_path: Path = base_dir / "models" / "lightgbm_model.pkl"

    cors_allow_origins: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # In-memory cache TTLs (seconds)
    cache_ttl_forecast: int = 300
    cache_ttl_overview: int = 120
    cache_ttl_hierarchy: int = 600
    cache_ttl_shap_global: int = 1800


settings = Settings()
