from __future__ import annotations

import math
from typing import Optional

import numpy as np
import pandas as pd

from pydantic import BaseModel

from app.schemas.overview import DemandHealth, OverviewKpi, OverviewResponse, TrendStrength
from app.schemas.forecast import ForecastRequest
from app.services.forecast_engine import ForecastEngine
from app.services.metrics_engine import MetricsEngine
from app.services.model_registry import ModelRegistry
from app.services.interpretation_engine import InterpretationContext, InterpretationEngine
from app.utils.cache import TTLCache
from app.core.config import settings


_cache = TTLCache()


def _linear_fit_metrics(y: np.ndarray) -> tuple[float, float]:
    if len(y) < 3:
        return 0.0, 0.0
    x = np.arange(len(y), dtype=float)
    x_mean = x.mean()
    y_mean = y.mean()
    denom = float(((x - x_mean) ** 2).sum()) + 1e-12
    slope = float(((x - x_mean) * (y - y_mean)).sum() / denom)

    # R^2
    y_hat = y_mean + slope * (x - x_mean)
    ss_res = float(((y - y_hat) ** 2).sum())
    ss_tot = float(((y - y_mean) ** 2).sum()) + 1e-12
    r2 = float(1.0 - ss_res / ss_tot)
    return slope, max(0.0, min(1.0, r2))


class OverviewEngine:
    def overview(
        self,
        store: Optional[int] = None,
        item: Optional[int] = None,
        horizon_days: int = 30,
        anchor_date: str | None = None,
    ) -> OverviewResponse:
        cache_key = f"overview:{store}:{item}:{horizon_days}:{anchor_date or ''}"
        cached = _cache.get(cache_key)
        if cached is not None:
            return cached

        assets = ModelRegistry.get_instance().get_assets()
        df = assets.data

        scope_parts = []
        scoped = df
        if store is not None:
            scoped = scoped[scoped["store"] == store]
            scope_parts.append(f"store={store}")
        if item is not None:
            scoped = scoped[scoped["item"] == item]
            scope_parts.append(f"item={item}")
        scope = "global" if not scope_parts else ",".join(scope_parts)

        if scoped.empty:
            raise ValueError("No data for requested scope")

        scoped = scoped.sort_values("date")
        anchor = pd.to_datetime(anchor_date) if anchor_date else scoped["date"].max()
        scoped = scoped[scoped["date"] <= anchor].copy()
        if scoped.empty:
            raise ValueError("No history on or before anchor_date")

        anchor_iso = pd.to_datetime(anchor).date().isoformat()

        # Baseline/forecast computed only for specific store+item (forecast model is per series)
        if store is not None and item is not None:
            forecast = ForecastEngine().forecast(
                ForecastRequest(store=store, item=item, horizon_days=horizon_days, anchor_date=anchor_iso)
            )
            forecast_total = float(forecast.predicted_total)
        else:
            forecast_total = 0.0

        # Baseline comparison window: last horizon_days of actuals
        tail = scoped.tail(max(horizon_days, 30))
        y = tail["sales"].astype(float).values
        baseline_total = float(tail.tail(horizon_days)["sales"].sum()) if len(tail) else 0.0

        # Volatility/stability/risk use existing metrics for a specific series; otherwise aggregate heuristic
        if store is not None and item is not None:
            risk = MetricsEngine().risk(store=store, item=item, horizon_days=horizon_days)
            volatility = float(risk.volatility_score)
            stability = float(risk.stability_index)
            anomaly = bool(risk.anomaly_flag)
        else:
            diffs = np.diff(y) if len(y) > 1 else np.array([0.0])
            volatility = float(np.std(diffs) / (np.mean(y) + 1e-9)) if len(y) else 0.0
            stability = float(1.0 / (1.0 + 10.0 * max(volatility, 0.0)))
            anomaly = False

        slope30, r2_30 = _linear_fit_metrics(y[-30:] if len(y) >= 30 else y)
        direction = "up" if slope30 > 0 else "down" if slope30 < 0 else "flat"

        # Growth KPI: compare last 30d vs previous 30d
        if len(y) >= 60:
            last30 = float(np.mean(y[-30:]))
            prev30 = float(np.mean(y[-60:-30]))
            growth = last30 - prev30
            growth_pct = (growth / (prev30 + 1e-9)) * 100.0
        else:
            growth = 0.0
            growth_pct = 0.0

        forecast_delta = float(forecast_total - baseline_total)
        forecast_delta_pct = (forecast_delta / (baseline_total + 1e-9) * 100.0) if baseline_total > 0 else None

        # Demand health score: deterministic composite
        vol_penalty = min(1.0, max(0.0, volatility * 2.5))
        trend_boost = max(0.0, min(1.0, abs(slope30) / (np.mean(y[-30:]) + 1e-9))) if len(y) else 0.0
        health = 0.55 * stability + 0.25 * (1.0 - vol_penalty) + 0.20 * min(1.0, r2_30 + trend_boost)
        health = float(max(0.0, min(1.0, health)))

        if health >= 0.75:
            band = "strong"
        elif health >= 0.55:
            band = "stable"
        elif health >= 0.35:
            band = "watch"
        else:
            band = "at_risk"

        drivers = [
            f"stability_index={stability:.3f}",
            f"volatility={volatility:.3f}",
            f"trend_r2_30d={r2_30:.2f}",
        ]
        if anomaly:
            drivers.append("anomaly_flag=true")

        kpis = [
            OverviewKpi(label="Growth (30d)", value=float(growth), unit="units", delta_pct=float(growth_pct)),
            OverviewKpi(label="Volatility", value=float(volatility), unit="score"),
            OverviewKpi(label="Stability", value=float(stability), unit="index"),
            OverviewKpi(label="Risk", value=float(1.0 - stability), unit="index"),
            OverviewKpi(label="Forecast Delta", value=float(forecast_delta), unit="units", delta_pct=forecast_delta_pct),
        ]

        export_payload = {
            "scope": scope,
            "anchor_date": anchor_iso,
            "horizon_days": horizon_days,
            "kpis": [k.model_dump() if isinstance(k, BaseModel) else k for k in kpis],
            "trend": {"slope_30d": slope30, "r2_30d": r2_30, "direction": direction},
            "demand_health": {"score": health, "band": band, "drivers": drivers},
            "forecast_total": forecast_total,
            "baseline_total": baseline_total,
            "forecast_delta": forecast_delta,
            "forecast_delta_pct": forecast_delta_pct,
        }

        ie = InterpretationEngine()
        ctx = InterpretationContext(scope=scope, horizon_days=horizon_days)
        explanations = {
            "growth_30d_pct": ie.explain("growth_30d_pct", float(growth_pct), ctx),
            "volatility_score": ie.explain("volatility_score", float(volatility), ctx),
            "stability_index": ie.explain("stability_index", float(stability), ctx),
            "risk_score": ie.explain("risk_score", float(1.0 - stability), ctx),
            "forecast_delta_pct": ie.explain("forecast_delta_pct", float(forecast_delta_pct or 0.0), ctx),
        }

        resp = OverviewResponse(
            scope=scope,
            anchor_date=anchor_iso,
            horizon_days=horizon_days,
            kpis=kpis,
            trend=TrendStrength(slope_30d=float(slope30), r2_30d=float(r2_30), direction=direction),
            demand_health=DemandHealth(score=health, band=band, drivers=drivers),
            forecast_total=forecast_total,
            baseline_total=baseline_total,
            forecast_delta=forecast_delta,
            forecast_delta_pct=forecast_delta_pct,
            explanations=explanations,
            export_payload=export_payload,
        )

        _cache.set(cache_key, resp, ttl_seconds=settings.cache_ttl_overview)
        return resp
