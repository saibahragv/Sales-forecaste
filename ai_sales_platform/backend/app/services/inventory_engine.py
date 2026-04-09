"""
Inventory Intelligence Engine
Provides safety stock, reorder points, stockout risk, and ABC-XYZ classification.
"""
from __future__ import annotations

import math
from typing import Optional

import numpy as np
import pandas as pd

from app.core.config import settings
from app.services.forecast_engine import ForecastEngine
from app.services.metrics_engine import MetricsEngine
from app.services.model_registry import ModelRegistry
from app.schemas.forecast import ForecastRequest
from app.utils.cache import TTLCache


_cache = TTLCache()

# Z-scores for common service levels
_Z_TABLE = {0.90: 1.282, 0.95: 1.645, 0.99: 2.326}


def _z_score(service_level: float) -> float:
    return _Z_TABLE.get(round(service_level, 2), 1.645)


class InventoryResult:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

    def dict(self):
        return self.__dict__


class InventoryEngine:
    def _get_series_stats(self, store: int, item: int) -> dict:
        assets = ModelRegistry.get_instance().get_assets()
        df = assets.data
        series = df[(df["store"] == store) & (df["item"] == item)].sort_values("date")
        if series.empty:
            raise ValueError(f"No data for store={store}, item={item}")
        y = series["sales"].astype(float).values
        y_30 = y[-30:] if len(y) >= 30 else y
        y_90 = y[-90:] if len(y) >= 90 else y
        return {
            "avg_daily_30": float(np.mean(y_30)),
            "std_daily_30": float(np.std(y_30)),
            "avg_daily_90": float(np.mean(y_90)),
            "std_daily_90": float(np.std(y_90)),
            "cv_30": float(np.std(y_30) / (np.mean(y_30) + 1e-9)),
            "cv_90": float(np.std(y_90) / (np.mean(y_90) + 1e-9)),
            "total_annual": float(np.sum(y[-365:]) if len(y) >= 365 else np.sum(y)),
            "max_date": series["date"].max(),
        }

    def _abc_class(self, store: int, item: int) -> str:
        """Classify item by volume relative to all items in the store."""
        assets = ModelRegistry.get_instance().get_assets()
        df = assets.data
        store_df = df[df["store"] == store]
        item_totals = store_df.groupby("item")["sales"].sum().sort_values(ascending=False)
        cumulative = item_totals.cumsum() / item_totals.sum()
        rank = item_totals.index.get_loc(item) if item in item_totals.index else len(item_totals) - 1
        pct_rank = rank / max(len(item_totals) - 1, 1)
        if pct_rank < 0.20:
            return "A"
        elif pct_rank < 0.50:
            return "B"
        return "C"

    def _xyz_class(self, cv: float) -> str:
        if cv < 0.10:
            return "X"
        elif cv < 0.25:
            return "Y"
        return "Z"

    def get_inventory(
        self,
        store: int,
        item: int,
        lead_time_days: Optional[int] = None,
        service_level: Optional[float] = None,
    ) -> dict:
        lead_time = lead_time_days or settings.lead_time_default_days
        sl = service_level or settings.service_level
        z = _z_score(sl)

        cache_key = f"inventory:{store}:{item}:{lead_time}:{sl}"
        cached = _cache.get(cache_key)
        if cached:
            return cached

        stats = self._get_series_stats(store, item)
        avg_d = stats["avg_daily_30"]
        std_d = stats["std_daily_30"]

        # Safety stock: covers demand uncertainty during lead time
        safety_stock = z * std_d * math.sqrt(lead_time)

        # Reorder point: expected demand during lead time + safety buffer
        reorder_point = (avg_d * lead_time) + safety_stock

        # Get 30-day forecast total
        anchor_date = str(stats["max_date"].date())
        try:
            forecast = ForecastEngine().forecast(
                ForecastRequest(store=store, item=item, horizon_days=30, anchor_date=anchor_date)
            )
            forecast_30d_total = float(forecast.predicted_total)
            avg_daily_forecast = forecast_30d_total / 30.0
        except Exception:
            forecast_30d_total = avg_d * 30
            avg_daily_forecast = avg_d

        # Stockout risk: negative means we'll run out before reorder point is triggered
        stockout_risk_score = float((forecast_30d_total - reorder_point) / (reorder_point + 1e-9))

        if stockout_risk_score < -0.20:
            risk_band = "CRITICAL"
            days_to_reorder = 0
        elif stockout_risk_score < 0.0:
            risk_band = "HIGH"
            days_to_reorder = max(0, int((reorder_point - safety_stock) / (avg_daily_forecast + 1e-9)))
        elif stockout_risk_score < 0.30:
            risk_band = "MEDIUM"
            days_to_reorder = max(0, int(safety_stock / (avg_daily_forecast + 1e-9)))
        else:
            risk_band = "LOW"
            days_to_reorder = lead_time + 7

        abc = self._abc_class(store, item)
        xyz = self._xyz_class(stats["cv_30"])

        if risk_band == "CRITICAL":
            recommendation = f"⚠️ CRITICAL: Reorder NOW. Forecast demand {forecast_30d_total:.0f} units in 30 days. Safety buffer is insufficient."
        elif risk_band == "HIGH":
            recommendation = f"🟠 HIGH RISK: Reorder within {days_to_reorder}d. Forecasted demand {forecast_30d_total:.0f} exceeds available buffer zones."
        elif risk_band == "MEDIUM":
            recommendation = f"🟡 MONITOR: Consider reorder in ~{days_to_reorder}d. Demand forecast: {forecast_30d_total:.0f} units."
        else:
            recommendation = f"✅ STABLE: No action needed for {days_to_reorder}d. Demand forecast: {forecast_30d_total:.0f} units."

        result = {
            "store": store,
            "item": item,
            "anchor_date": anchor_date,
            "lead_time_days": lead_time,
            "service_level": sl,
            "avg_daily_actual_30d": round(avg_d, 2),
            "avg_daily_forecast_30d": round(avg_daily_forecast, 2),
            "std_daily_30d": round(std_d, 2),
            "cv_30d": round(stats["cv_30"], 3),
            "safety_stock": round(safety_stock, 1),
            "reorder_point": round(reorder_point, 1),
            "forecast_30d_total": round(forecast_30d_total, 1),
            "stockout_risk_score": round(stockout_risk_score, 3),
            "stockout_risk_band": risk_band,
            "days_to_reorder": days_to_reorder,
            "abc_class": abc,
            "xyz_class": xyz,
            "class_combined": f"{abc}{xyz}",
            "recommendation": recommendation,
        }
        _cache.set(cache_key, result, ttl_seconds=settings.cache_ttl_inventory)
        return result

    def get_alerts(self, top_n: int = 10) -> list[dict]:
        """Scan all store-item pairs and return top-N at highest stockout risk."""
        cache_key = f"inventory_alerts:{top_n}"
        cached = _cache.get(cache_key)
        if cached:
            return cached

        assets = ModelRegistry.get_instance().get_assets()
        df = assets.data
        pairs = df[["store", "item"]].drop_duplicates().values.tolist()

        results = []
        for store, item in pairs:
            try:
                r = self.get_inventory(store=int(store), item=int(item))
                results.append(r)
            except Exception:
                continue

        # Sort by risk: CRITICAL first, then HIGH, then by risk score
        band_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        results.sort(key=lambda x: (band_order.get(x["stockout_risk_band"], 4), x["stockout_risk_score"]))
        top = results[:top_n]
        _cache.set(cache_key, top, ttl_seconds=settings.cache_ttl_inventory)
        return top

    def get_abc_xyz_matrix(self, store: Optional[int] = None) -> dict:
        """Return ABC-XYZ classification counts for all items."""
        cache_key = f"abc_xyz:{store}"
        cached = _cache.get(cache_key)
        if cached:
            return cached

        assets = ModelRegistry.get_instance().get_assets()
        df = assets.data
        if store:
            df = df[df["store"] == store]

        pairs = df[["store", "item"]].drop_duplicates().values.tolist()
        matrix: dict[str, list] = {}

        for s, i in pairs:
            try:
                r = self.get_inventory(store=int(s), item=int(i))
                key = r["class_combined"]
                if key not in matrix:
                    matrix[key] = []
                matrix[key].append({"store": s, "item": i, "risk_band": r["stockout_risk_band"]})
            except Exception:
                continue

        counts = {k: len(v) for k, v in matrix.items()}
        result = {"matrix": matrix, "counts": counts}
        _cache.set(cache_key, result, ttl_seconds=settings.cache_ttl_inventory)
        return result
