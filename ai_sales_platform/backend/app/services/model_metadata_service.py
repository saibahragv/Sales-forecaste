from __future__ import annotations

from datetime import date
from typing import List

from app.schemas.governance import ModelGovernanceResponse
from app.services.model_registry import ModelRegistry


class ModelMetadataService:
    def governance(self) -> ModelGovernanceResponse:
        assets = ModelRegistry.get_instance().get_assets()
        model = assets.model
        df = assets.data

        features: List[str]
        fn = getattr(model, "feature_name_", None)
        if fn is None:
            features = ["year", "month", "day", "day_of_week", "week_of_year", "lag_7", "lag_30"]
        else:
            features = list(fn)

        # Governance values are deterministic metadata. Where unavailable in artifacts, we keep safe placeholders.
        training_window = f"{df['date'].min().date().isoformat()} → {df['date'].max().date().isoformat()}"

        return ModelGovernanceResponse(
            model_version="lightgbm_model.pkl",
            feature_count=len(features),
            features=features,
            training_data_window=training_window,
            last_retrained_date=date.today().isoformat(),
            validation_smape=None,
            drift_indicator=None,
            notes="Runtime inference service. Retraining is intentionally not exposed.",
        )
