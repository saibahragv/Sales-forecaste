from pydantic import BaseModel, Field

from app.schemas.explanations import MetricExplanation


class ScenarioAdjustments(BaseModel):
    price_elasticity: float = Field(0.0, description="Coefficient applied to price change proxy")
    promotion_intensity: float = Field(0.0, ge=0.0, le=2.0, description="0..1 promotional intensity")
    macro_demand_shock_pct: float = Field(0.0, ge=-100.0, le=200.0, description="Percent shock applied to demand")
    growth_slope: float = Field(0.0, description="Slope applied across horizon")
    demand_cap: float | None = Field(None, ge=0.0, description="Optional cap on demand per day")
    competitive_pressure: float = Field(0.0, ge=0.0, le=1.0, description="0..1 competitive pressure reducing demand")
    marketing_spend: float = Field(0.0, ge=0.0, le=1.0, description="0..1 marketing spend intensity boosting demand")
    weather_impact: float = Field(0.0, ge=-1.0, le=1.0, description="-1..1 weather impact on demand")


class ScenarioRequest(BaseModel):
    store: int
    item: int
    horizon_days: int = Field(30, ge=1, le=365)
    anchor_date: str | None = None
    adjustments: ScenarioAdjustments


class ScenarioPoint(BaseModel):
    date: str
    baseline: float
    scenario: float
    delta: float
    delta_pct: float | None


class ScenarioResponse(BaseModel):
    store: int
    item: int
    anchor_date: str
    horizon_days: int
    series: list[ScenarioPoint]
    baseline_total: float
    scenario_total: float
    delta_total: float
    delta_total_pct: float | None

    explanations: dict[str, MetricExplanation] = {}
