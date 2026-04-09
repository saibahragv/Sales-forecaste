from pydantic import BaseModel, Field

from app.schemas.explanations import MetricExplanation


class ForecastRequest(BaseModel):
    store: int
    item: int
    horizon_days: int = Field(30, ge=1, le=365)
    anchor_date: str | None = None
    history_days: int = Field(180, ge=7, le=730)
    aggregation: str = Field("daily", description="daily|weekly|monthly")
    include_history: bool = True
    include_confidence: bool = False
    normalize: bool = False


class ForecastPoint(BaseModel):
    date: str
    predicted_sales: float


class HistoryPoint(BaseModel):
    date: str
    actual_sales: float


class ConfidencePoint(BaseModel):
    date: str
    lower: float
    upper: float


class DecompositionPoint(BaseModel):
    date: str
    trend: float
    seasonal: float
    residual: float


class ForecastResponse(BaseModel):
    store: int
    item: int
    anchor_date: str
    horizon_days: int
    forecast: list[ForecastPoint]
    predicted_total: float

    aggregation: str = "daily"
    normalized: bool = False
    history: list[HistoryPoint] = []
    confidence: list[ConfidencePoint] = []
    decomposition: list[DecompositionPoint] = []

    explanations: dict[str, MetricExplanation] = {}
