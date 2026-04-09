from __future__ import annotations

import logging
from dataclasses import dataclass
from threading import RLock
from typing import Optional

import joblib
import pandas as pd

from app.core.config import settings


logger = logging.getLogger(__name__)


@dataclass
class LoadedAssets:
    model: object
    data: pd.DataFrame


class ModelRegistry:
    _instance: Optional["ModelRegistry"] = None
    _instance_lock = RLock()

    def __init__(self) -> None:
        self._lock = RLock()
        self._assets: Optional[LoadedAssets] = None

    @classmethod
    def get_instance(cls) -> "ModelRegistry":
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def initialize(self) -> None:
        with self._lock:
            if self._assets is not None:
                return

            try:
                logger.info("loading_model", extra={"path": str(settings.model_path)})
                model = joblib.load(str(settings.model_path))

                logger.info("loading_data", extra={"path": str(settings.data_path)})
                df = pd.read_csv(settings.data_path)
            except FileNotFoundError as e:
                logger.exception(
                    "asset_file_missing",
                    extra={
                        "model_path": str(settings.model_path),
                        "data_path": str(settings.data_path),
                    },
                )
                raise e

            df["date"] = pd.to_datetime(df["date"], errors="coerce")
            df = df.dropna(subset=["date"]).copy()
            df["store"] = df["store"].astype(int)
            df["item"] = df["item"].astype(int)
            df["sales"] = pd.to_numeric(df["sales"], errors="coerce")
            df = df.dropna(subset=["sales"]).copy()
            df["sales"] = df["sales"].astype(float)
            df = df.sort_values(["store", "item", "date"]).reset_index(drop=True)

            self._assets = LoadedAssets(model=model, data=df)

    def get_assets(self) -> LoadedAssets:
        if self._assets is None:
            self.initialize()
        return self._assets
