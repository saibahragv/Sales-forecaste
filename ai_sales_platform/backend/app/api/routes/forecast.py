from fastapi import APIRouter, HTTPException

from app.schemas.forecast import ForecastRequest, ForecastResponse
from app.services.forecast_engine import ForecastEngine


router = APIRouter(prefix="/forecast")


@router.get("", response_model=ForecastResponse)
async def get_forecast(
    store: int,
    item: int,
    horizon_days: int = 30,
    anchor_date: str | None = None,
    history_days: int = 180,
    aggregation: str = "daily",
    include_history: bool = True,
    include_confidence: bool = False,
    normalize: bool = False,
) -> ForecastResponse:
    try:
        req = ForecastRequest(
            store=store,
            item=item,
            horizon_days=horizon_days,
            anchor_date=anchor_date,
            history_days=history_days,
            aggregation=aggregation,
            include_history=include_history,
            include_confidence=include_confidence,
            normalize=normalize,
        )
        return ForecastEngine().forecast(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
