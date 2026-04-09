from __future__ import annotations

from pydantic import BaseModel

from app.schemas.explanations import MetricExplanation


class OverviewKpi(BaseModel):
    label: str
    value: float
    unit: str | None = None
    delta: float | None = None
    delta_pct: float | None = None


class TrendStrength(BaseModel):
    slope_30d: float
    r2_30d: float
    direction: str


class DemandHealth(BaseModel):
    score: float
    band: str
    drivers: list[str]


class OverviewResponse(BaseModel):
    scope: str
    anchor_date: str
    horizon_days: int

    kpis: list[OverviewKpi]
    trend: TrendStrength
    demand_health: DemandHealth

    forecast_total: float
    baseline_total: float
    forecast_delta: float
    forecast_delta_pct: float | None

    explanations: dict[str, MetricExplanation]

    export_payload: dict
