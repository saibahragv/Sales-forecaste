from __future__ import annotations

from typing import List

import numpy as np

from app.schemas.explanations import MetricExplanation
from app.schemas.scenario import ScenarioPoint, ScenarioRequest, ScenarioResponse
from app.schemas.forecast import ForecastRequest
from app.services.forecast_engine import ForecastEngine
from app.services.interpretation_engine import InterpretationContext, InterpretationEngine


class ScenarioEngine:
    def simulate(self, req: ScenarioRequest) -> ScenarioResponse:
        baseline = ForecastEngine().forecast(
            ForecastRequest(
                store=req.store,
                item=req.item,
                horizon_days=req.horizon_days,
                anchor_date=req.anchor_date,
            )
        )

        adj = req.adjustments
        series: List[ScenarioPoint] = []

        baseline_vals = np.array([p.predicted_sales for p in baseline.forecast], dtype=float)

        # Deterministic adjustment model (no LLM):
        # - macro shock applies multiplicatively to all points
        # - promotion intensity lifts demand (simple linear)
        # - price elasticity is a penalty on promotion proxy (kept deterministic)
        # - growth_slope applies a linear ramp across horizon
        macro = 1.0 + (adj.macro_demand_shock_pct / 100.0)
        promo_lift = 1.0 + 0.15 * float(adj.promotion_intensity)
        price_penalty = 1.0 - 0.05 * float(adj.price_elasticity) * float(adj.promotion_intensity)
        competitive = 1.0 - 0.10 * float(getattr(adj, "competitive_pressure", 0.0))
        ramp = np.linspace(0.0, 1.0, num=len(baseline_vals), dtype=float)
        growth = 1.0 + float(adj.growth_slope) * ramp

        scenario_vals = baseline_vals * macro * promo_lift * price_penalty * competitive * growth
        scenario_vals = np.maximum(scenario_vals, 0.0)

        demand_cap = getattr(adj, "demand_cap", None)
        if demand_cap is not None:
            scenario_vals = np.minimum(scenario_vals, float(demand_cap))

        for i, p in enumerate(baseline.forecast):
            b = float(baseline_vals[i])
            s = float(scenario_vals[i])
            d = s - b
            d_pct = (d / b * 100.0) if b > 0 else None
            series.append(
                ScenarioPoint(
                    date=p.date,
                    baseline=b,
                    scenario=s,
                    delta=d,
                    delta_pct=d_pct,
                )
            )

        baseline_total = float(baseline_vals.sum())
        scenario_total = float(scenario_vals.sum())
        delta_total = scenario_total - baseline_total
        delta_total_pct = (delta_total / baseline_total * 100.0) if baseline_total > 0 else None

        ie = InterpretationEngine()
        ctx = InterpretationContext(scope=f"store={req.store},item={req.item}", horizon_days=req.horizon_days)
        explanations = {
            "delta_total_pct": ie.explain("forecast_delta_pct", float(delta_total_pct or 0.0), ctx),
            "price_elasticity": MetricExplanation(
                title="Price Elasticity",
                definition="Scenario control representing demand sensitivity to price change proxy.",
                calculation_logic="Applied as a deterministic penalty interacting with promotion intensity.",
                business_meaning="Higher elasticity reduces uplift under promotion assumptions.",
                current_interpretation=f"elasticity={req.adjustments.price_elasticity:.2f}",
                reasoning=["Used only for scenario simulation; does not retrain the model."],
                suggested_action="Validate elasticity assumptions against historical pricing experiments if available.",
            ),
        }

        return ScenarioResponse(
            store=req.store,
            item=req.item,
            anchor_date=baseline.anchor_date,
            horizon_days=req.horizon_days,
            series=series,
            baseline_total=baseline_total,
            scenario_total=scenario_total,
            delta_total=delta_total,
            delta_total_pct=delta_total_pct,
            explanations=explanations,
        )
