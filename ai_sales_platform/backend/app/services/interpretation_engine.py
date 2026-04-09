from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from app.schemas.explanations import MetricExplanation


@dataclass(frozen=True)
class InterpretationContext:
    scope: str | None = None
    horizon_days: int | None = None
    aggregation: str | None = None
    normalized: bool | None = None


class InterpretationEngine:
    def explain(self, metric: str, value: float | None, ctx: InterpretationContext, extras: Optional[Dict[str, Any]] = None) -> MetricExplanation:
        extras = extras or {}
        v = float(value) if value is not None else 0.0

        if metric == "growth_30d_pct":
            band = "moderate"
            if v >= 10:
                band = "strong"
            elif v <= -10:
                band = "contraction"
            elif abs(v) < 2:
                band = "flat"

            action = None
            if band == "strong":
                action = "Review replenishment parameters and consider increasing safety stock for top movers."
            elif band == "contraction":
                action = "Investigate demand drivers and consider reducing replenishment to avoid overstock."

            return MetricExplanation(
                title="Growth (30d)",
                definition="Change in recent demand level versus the prior comparable window.",
                calculation_logic="mean(sales last 30d) - mean(sales prior 30d), reported as % of prior mean.",
                business_meaning="Indicates whether demand is expanding, stable, or contracting for the selected scope.",
                current_interpretation=f"{band} growth ({v:.2f}%).",
                reasoning=[
                    f"window=30d",
                    f"aggregation={ctx.aggregation or 'daily'}",
                    "computed from observed history only (no retraining).",
                ],
                suggested_action=action,
            )

        if metric == "forecast_aggregation":
            agg = extras.get("aggregation") or ctx.aggregation or "daily"
            meaning = {
                "daily": "Daily totals preserve short-term volatility and are useful for operational monitoring.",
                "weekly": "Weekly totals reduce noise and align to replenishment cadences.",
                "monthly": "Monthly totals are best for long-range planning and budgeting; they smooth short-term effects.",
            }.get(str(agg), "Aggregation level.")
            return MetricExplanation(
                title="Aggregation",
                definition="Resampling level used for displayed history and forecast time series.",
                calculation_logic="Aggregate sales totals by day, week (week-ending), or month (month-ending).",
                business_meaning=meaning,
                current_interpretation=f"Current view: {agg}.",
                reasoning=["Aggregation changes visualization granularity only; model forecasts are generated daily then resampled."],
                suggested_action="Use weekly/monthly for planning decisions; use daily for anomaly monitoring." if agg != "daily" else "Use weekly to reduce noise when comparing stores/items.",
            )

        if metric == "forecast_normalization":
            norm = bool(extras.get("normalized", ctx.normalized or False))
            return MetricExplanation(
                title="Normalization",
                definition="Indexing of series to a common baseline for comparability.",
                calculation_logic="Divide values by mean(history window) and scale to 100.",
                business_meaning="Enables cross-store and cross-item comparisons without scale dominating the chart.",
                current_interpretation="Normalized to index=100." if norm else "Raw units (not normalized).",
                reasoning=["Normalization changes chart scale only; it does not alter model predictions."],
                suggested_action="Enable normalization when comparing multiple stores/items." if not norm else None,
            )

        if metric == "forecast_decomposition":
            return MetricExplanation(
                title="Forecast Decomposition",
                definition="Deterministic decomposition of observed history into trend, seasonal, and residual components.",
                calculation_logic="Trend = EMA(30). Seasonal = average weekday effect on detrended series. Residual = remainder.",
                business_meaning="Separates structural demand movement (trend) from repeatable patterns (seasonality) and noise (residual).",
                current_interpretation="Use the residual component to spot instability or regime shifts; stable series have low residual dispersion.",
                reasoning=["Decomposition is deterministic and derived from history; it is not an additional model."],
                suggested_action="If residuals are large, consult Risk & Stability and consider weekly aggregation for planning.",
            )

        if metric == "volatility_score":
            band = "low"
            if v > 0.35:
                band = "high"
            elif v > 0.20:
                band = "medium"

            action = None
            if band in ("medium", "high"):
                action = "Use weekly/monthly aggregation for planning and keep wider inventory buffers or shorter review cycles."

            return MetricExplanation(
                title="Volatility", 
                definition="Normalized variability of recent demand changes.",
                calculation_logic="std(diff(sales)) / mean(sales) computed on trailing window.",
                business_meaning="Higher volatility implies less predictable demand and higher forecast uncertainty.",
                current_interpretation=f"{band} volatility (score={v:.3f}).",
                reasoning=["volatility is scale-normalized to compare across items/stores"],
                suggested_action=action,
            )

        if metric == "stability_index":
            band = "stable" if v >= 0.6 else "watch" if v >= 0.4 else "at_risk"
            action = None
            if band == "at_risk":
                action = "Investigate anomalies and consider scenario stress tests; use conservative buffers."

            return MetricExplanation(
                title="Stability Index",
                definition="Bounded inverse-volatility score summarizing predictability.",
                calculation_logic="1 / (1 + 10 * volatility_score).",
                business_meaning="Higher stability indicates demand is easier to forecast operationally.",
                current_interpretation=f"{band} stability (index={v:.3f}).",
                reasoning=["bounded to [0,1] for consistent operational thresholds"],
                suggested_action=action,
            )

        if metric == "risk_score":
            band = "low" if v < 0.4 else "medium" if v < 0.6 else "high"
            action = "If risk is high, prioritize monitoring and avoid aggressive inventory commitments." if band == "high" else None
            return MetricExplanation(
                title="Risk Score",
                definition="Operational risk proxy derived from stability and anomaly signals.",
                calculation_logic="risk_score = 1 - stability_index (bounded).",
                business_meaning="Higher risk suggests larger uncertainty envelope and higher chance of forecast error.",
                current_interpretation=f"{band} risk (score={v:.3f}).",
                reasoning=["deterministic transformation of stability; no probabilistic claims"],
                suggested_action=action,
            )

        if metric == "forecast_delta_pct":
            band = "increase" if v > 0 else "decrease" if v < 0 else "flat"
            return MetricExplanation(
                title="Forecast Delta",
                definition="Change between forecast total and recent baseline total.",
                calculation_logic="(forecast_total - baseline_total) / baseline_total.",
                business_meaning="Quantifies expected near-term deviation from recent realized demand.",
                current_interpretation=f"Projected {band} versus baseline ({v:.2f}%).",
                reasoning=[f"horizon_days={ctx.horizon_days}", "baseline uses last horizon window of actuals"],
                suggested_action="If delta is material, validate with scenario simulation and check drivers via SHAP." if abs(v) >= 5 else None,
            )

        if metric == "confidence_band_pct":
            band = "tight" if v <= 15 else "moderate" if v <= 30 else "wide"
            return MetricExplanation(
                title="Forecast Uncertainty Band",
                definition="Deterministic uncertainty envelope derived from trailing volatility.",
                calculation_logic="band_pct = min(60%, 10% + 2.5 * volatility_score).",
                business_meaning="Wider bands imply forecasts should be treated as higher-risk for commitments.",
                current_interpretation=f"{band} uncertainty (±{v:.1f}%).",
                reasoning=["This is a heuristic risk envelope, not a statistical confidence interval."],
                suggested_action="Use aggregation and scenario stress tests; avoid tight commitments at wide uncertainty." if band == "wide" else None,
            )

        return MetricExplanation(
            title=metric,
            definition="Metric.",
            calculation_logic="Deterministic calculation.",
            business_meaning="Operational metric.",
            current_interpretation=f"value={v:.4f}",
            reasoning=["no interpretation rule registered"],
            suggested_action=None,
        )
