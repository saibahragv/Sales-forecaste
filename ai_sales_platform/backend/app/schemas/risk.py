from pydantic import BaseModel

from app.schemas.explanations import MetricExplanation


class RiskResponse(BaseModel):
    store: int
    item: int
    horizon_days: int
    volatility_score: float
    stability_index: float
    anomaly_flag: bool
    confidence_band_pct: float

    explanations: dict[str, MetricExplanation]
