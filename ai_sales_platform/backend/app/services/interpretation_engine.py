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
                title="Recent Growth",
                definition="How much our sales have gone up or down in the last 30 days.",
                calculation_logic="We compare your sales from the last 30 days to the 30 days before that.",
                business_meaning="This tells us if people are buying more, less, or about the same amount of this item.",
                current_interpretation=f"You have {band} growth right now ({v:.2f}%).",
                reasoning=[
                    "Based on real recent sales data.",
                    "Quickly spots short-term trends."
                ],
                suggested_action=action,
            )

        if metric == "forecast_aggregation":
            agg = extras.get("aggregation") or ctx.aggregation or "daily"
            meaning = {
                "daily": "Daily numbers show every tiny detail and bump.",
                "weekly": "Weekly totals smooth things out and make it easier to see the main pattern.",
                "monthly": "Monthly sums are best for 'big picture' long-term planning.",
            }.get(str(agg), "How we group the data.")
            return MetricExplanation(
                title="Data Grouping",
                definition="How we bundle the data together (by day, week, or month).",
                calculation_logic="Adding up daily sales to make weekly or monthly totals.",
                business_meaning=meaning,
                current_interpretation=f"We are looking at it {agg}.",
                reasoning=["Grouping just changes how the chart looks, it doesn't change the underlying AI predictions."],
                suggested_action="Use weekly/monthly for planning decisions; use daily for anomaly monitoring." if agg != "daily" else "Use weekly to reduce noise when comparing stores/items.",
            )

        if metric == "forecast_normalization":
            norm = bool(extras.get("normalized", ctx.normalized or False))
            return MetricExplanation(
                title="Scale Matching (Normalization)",
                definition="Making different items easy to compare on the same graph.",
                calculation_logic="We shrink or stretch the numbers so everything fits on a percentage scale (0 to 100).",
                business_meaning="If one item sells 1,000 and another sells 10, scale matching lets you clearly see if they share the same seasonal patterns.",
                current_interpretation="Scale matching is ON." if norm else "Viewing raw sales numbers.",
                reasoning=["This only changes the chart so your eyes can compare shapes easier!"],
                suggested_action="Enable normalization when comparing multiple stores/items." if not norm else None,
            )

        if metric == "forecast_decomposition":
            return MetricExplanation(
                title="Pattern Breakdown",
                definition="Taking the messy sales line and breaking it into three simple parts: Trend, Season, and Random Noise.",
                calculation_logic="We find the main direction (Trend), find the repeating weekly humps (Season), and whatever is leftover is Random (Noise).",
                business_meaning="This helps you see if sales are actually growing, or if it's just typical weekend traffic.",
                current_interpretation="Look at the 'Noise' component—if the noise line is very bumpy, it means the item is hard to predict.",
                reasoning=["This helps humans understand the shape of the data before the AI tries to predict it."],
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
                title="Bumpiness (Volatility)", 
                definition="How crazy and unpredictable the sales jumps are from day to day.",
                calculation_logic="We measure how far individual days jump away from the average.",
                business_meaning="High bumpiness means sales are bouncing all over the place, making it harder for the AI to guess perfectly.",
                current_interpretation=f"The sales are showing {band} bumpiness.",
                reasoning=["Tells us if we need to be careful with our trust in the exact numbers."],
                suggested_action=action,
            )

        if metric == "stability_index":
            band = "stable" if v >= 0.6 else "watch" if v >= 0.4 else "at_risk"
            action = None
            if band == "at_risk":
                action = "Investigate anomalies and consider scenario stress tests; use conservative buffers."

            return MetricExplanation(
                title="Steadiness Score",
                definition="A score showing how steady, reliable, and boring the sales pattern is.",
                calculation_logic="We give a high score if there are very few random surprises.",
                business_meaning="High steadiness is great! It means we can easily and safely predict what will happen next.",
                current_interpretation=f"This looks {band}.",
                reasoning=["Steady items require less human supervision."],
                suggested_action=action,
            )

        if metric == "risk_score":
            band = "low" if v < 0.4 else "medium" if v < 0.6 else "high"
            action = "If risk is high, prioritize monitoring and avoid aggressive inventory commitments." if band == "high" else None
            return MetricExplanation(
                title="Danger Level",
                definition="The chance that we might run out of stock or have bad predictions.",
                calculation_logic="Higher danger happens when sales are wild and unsteady.",
                business_meaning="This helps you know when you need to keep extra items in the back room just in case.",
                current_interpretation=f"This is a {band} danger situation.",
                reasoning=["Helps humans know where to focus their attention today."],
                suggested_action=action,
            )

        if metric == "forecast_delta_pct":
            band = "increase" if v > 0 else "decrease" if v < 0 else "flat"
            return MetricExplanation(
                title="Future vs Past",
                definition="The difference between what we expect to happen tomorrow versus what happened yesterday.",
                calculation_logic="Future predictions minus recent real sales.",
                business_meaning="Tells us if we are expecting a big change from normal.",
                current_interpretation=f"We expect sales to {band} compared to the recent past.",
                reasoning=["Shows the direction the AI thinks things are going."],
                suggested_action="If delta is material, validate with scenario simulation and check drivers via SHAP." if abs(v) >= 5 else None,
            )

        if metric == "confidence_band_pct":
            band = "tight" if v <= 15 else "moderate" if v <= 30 else "wide"
            return MetricExplanation(
                title="Wiggle Room (Confidence)",
                definition="Our 'margin of error' for the prediction.",
                calculation_logic="We use past bumpiness to guess how bumpy the future will be, creating a safe range.",
                business_meaning="Wide bands mean we aren't completely sure. Tight bands mean we are very confident.",
                current_interpretation=f"We have a {band} range of confidence.",
                reasoning=["It's always smart to have a backup plan!"],
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
