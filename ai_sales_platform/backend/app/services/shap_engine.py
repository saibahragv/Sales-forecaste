from __future__ import annotations

import hashlib
import logging
from typing import List, Optional

import numpy as np
import pandas as pd
import shap
from fastapi import BackgroundTasks

from app.core.config import settings
from app.schemas.shap_schemas import (
    ShapContribution,
    ShapFeatureImportance,
    ShapGlobalResponse,
    ShapLocalResponse,
)
from app.services.model_registry import ModelRegistry
from app.utils.cache import TTLCache
from app.utils.feature_engineering import build_feature_frame, prepare_X


logger = logging.getLogger(__name__)
_cache = TTLCache()


def _global_key(store: Optional[int], item: Optional[int]) -> str:
    raw = f"store={store}|item={item}"
    return "shap_global:v1:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ShapEngine:
    def _compute_global(self, store: Optional[int], item: Optional[int]) -> ShapGlobalResponse:
        assets = ModelRegistry.get_instance().get_assets()
        model = assets.model
        df = assets.data

        if store is not None:
            df = df[df["store"] == store]
        if item is not None:
            df = df[df["item"] == item]

        if df.empty:
            raise ValueError("No data for requested scope")

        fe = build_feature_frame(df[["date", "store", "item", "sales"]].copy())
        X = prepare_X(fe, model)
        if len(X) > 2000:
            X = X.sample(2000, random_state=42)

        explainer = shap.TreeExplainer(model)
        sv = explainer.shap_values(X)
        shap_arr = np.array(sv[0] if isinstance(sv, list) else sv)

        mean_abs = np.mean(np.abs(shap_arr), axis=0)
        fi = list(X.columns)
        pairs = sorted(zip(fi, mean_abs), key=lambda x: x[1], reverse=True)[:20]

        scope = "global"
        if store is not None and item is not None:
            scope = "store_item"
        elif store is not None:
            scope = "store"
        elif item is not None:
            scope = "item"

        return ShapGlobalResponse(
            status="ready",
            scope=scope,
            top_features=[ShapFeatureImportance(feature=f, mean_abs_shap=float(v)) for f, v in pairs],
        )

    def global_importance(
        self,
        background_tasks: BackgroundTasks,
        store: Optional[int] = None,
        item: Optional[int] = None,
    ) -> ShapGlobalResponse:
        key = _global_key(store, item)
        cached = _cache.get(key)
        if cached is not None:
            return cached

        computing_flag = _cache.get(key + ":computing")
        if computing_flag is None:
            _cache.set(key + ":computing", True, ttl_seconds=600)
            background_tasks.add_task(self._compute_and_cache_global, store, item)

        scope = "global" if store is None and item is None else "scoped"
        return ShapGlobalResponse(status="computing", scope=scope, top_features=[])

    def _compute_and_cache_global(self, store: Optional[int], item: Optional[int]) -> None:
        try:
            resp = self._compute_global(store, item)
            _cache.set(_global_key(store, item), resp, ttl_seconds=settings.cache_ttl_shap_global)
        except Exception:
            logger.exception("shap_global_failed")
            scope = "global" if store is None and item is None else "scoped"
            _cache.set(
                _global_key(store, item),
                ShapGlobalResponse(status="failed", scope=scope, top_features=[]),
                ttl_seconds=300,
            )

    def local_explanation(self, store: int, item: int, target_date: str) -> ShapLocalResponse:
        assets = ModelRegistry.get_instance().get_assets()
        model = assets.model
        df = assets.data

        series = df[(df["store"] == store) & (df["item"] == item)].copy().sort_values("date")
        if series.empty:
            raise ValueError("No history found for selected store/item")

        target_ts = pd.to_datetime(target_date)
        # Find nearest on/after target date; if missing, use last date
        row_df = series[series["date"] <= target_ts].copy()
        if row_df.empty:
            row_df = series.copy()

        fe = build_feature_frame(row_df[["date", "store", "item", "sales"]].copy())
        X = prepare_X(fe, model)
        X_last = X.tail(1)

        explainer = shap.TreeExplainer(model)
        sv = explainer.shap_values(X_last)
        shap_arr = np.array(sv[0] if isinstance(sv, list) else sv)[0]

        base_value = float(explainer.expected_value[0] if isinstance(explainer.expected_value, (list, np.ndarray)) else explainer.expected_value)
        pred = float(model.predict(X_last)[0])

        contributions: List[ShapContribution] = []
        for i, f in enumerate(X_last.columns):
            contributions.append(
                ShapContribution(feature=str(f), value=float(X_last.iloc[0][f]), shap=float(shap_arr[i]))
            )

        contributions_sorted = sorted(contributions, key=lambda c: abs(c.shap), reverse=True)

        # Deterministic summary with emphasis on lag features
        lag7 = next((c for c in contributions_sorted if c.feature == "lag_7"), None)
        lag30 = next((c for c in contributions_sorted if c.feature == "lag_30"), None)
        parts = []
        if lag7 is not None:
            parts.append(f"lag_7 contributes {lag7.shap:+.2f} to the prediction")
        if lag30 is not None:
            parts.append(f"lag_30 contributes {lag30.shap:+.2f} to the prediction")
        if not parts:
            top = contributions_sorted[0] if contributions_sorted else None
            if top is not None:
                parts.append(f"{top.feature} contributes {top.shap:+.2f} to the prediction")

        summary = "; ".join(parts) + "."

        return ShapLocalResponse(
            store=store,
            item=item,
            target_date=pd.to_datetime(target_ts).date().isoformat(),
            prediction=float(max(0.0, pred)),
            base_value=base_value,
            contributions=contributions_sorted[:30],
            summary=summary,
        )
