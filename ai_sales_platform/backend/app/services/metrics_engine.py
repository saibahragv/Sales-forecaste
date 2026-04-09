from __future__ import annotations

import numpy as np

from app.schemas.risk import RiskResponse
from app.services.model_registry import ModelRegistry
from app.services.interpretation_engine import InterpretationContext, InterpretationEngine


class MetricsEngine:
    def risk(self, store: int, item: int, horizon_days: int = 30) -> RiskResponse:
        assets = ModelRegistry.get_instance().get_assets()
        df = assets.data

        series = df[(df["store"] == store) & (df["item"] == item)].copy().sort_values("date")
        if series.empty:
            raise ValueError("No history found for selected store/item")

        # Volatility based on trailing 90-day returns
        y = series["sales"].astype(float).values
        y_tail = y[-90:] if len(y) >= 90 else y
        if len(y_tail) < 2:
            vol = 0.0
        else:
            diffs = np.diff(y_tail)
            vol = float(np.std(diffs) / (np.mean(y_tail) + 1e-9))

        # Stability index: inverse of volatility (bounded)
        stability = float(1.0 / (1.0 + 10.0 * vol))

        # Anomaly: last value deviates strongly from trailing mean
        mu = float(np.mean(y_tail))
        sigma = float(np.std(y_tail) + 1e-9)
        last = float(y_tail[-1])
        anomaly = abs(last - mu) > 3.0 * sigma

        # Confidence band: heuristic from volatility
        band_pct = float(min(0.60, 0.10 + 2.5 * vol))

        ie = InterpretationEngine()
        ctx = InterpretationContext(scope=f"store={store},item={item}", horizon_days=horizon_days)
        explanations = {
            "volatility_score": ie.explain("volatility_score", float(vol), ctx),
            "stability_index": ie.explain("stability_index", float(stability), ctx),
            "risk_score": ie.explain("risk_score", float(1.0 - stability), ctx),
            "confidence_band_pct": ie.explain("confidence_band_pct", float(band_pct * 100.0), ctx),
        }

        return RiskResponse(
            store=store,
            item=item,
            horizon_days=horizon_days,
            volatility_score=float(vol),
            stability_index=float(stability),
            anomaly_flag=bool(anomaly),
            confidence_band_pct=band_pct * 100.0,
            explanations=explanations,
        )
