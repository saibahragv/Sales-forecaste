from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_version: str = "1.0.0"

    # Resolve to the backend folder by default:
    base_dir: Path = Path(__file__).resolve().parents[2]
    data_path: Path = base_dir / "data" / "train.csv"
    model_path: Path = base_dir / "models" / "lightgbm_model.pkl"

    cors_allow_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ]

    # In-memory cache TTLs (seconds)
    cache_ttl_forecast: int = 300
    cache_ttl_overview: int = 120
    cache_ttl_hierarchy: int = 600
    cache_ttl_shap_global: int = 1800
    cache_ttl_inventory: int = 600
    cache_ttl_accuracy: int = 1800
    cache_ttl_briefing: int = 21600  # 6 hours

    # NVIDIA NIM API
    nvidia_api_key: str = "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"
    nvidia_agent_model: str = "deepseek-ai/deepseek-v3_2"
    nvidia_guard_model: str = "meta/llama-guard-4-12b"
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"

    # Inventory / supply chain
    lead_time_default_days: int = 7
    service_level: float = 0.95  # 95% → Z=1.645

    class Config:
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
