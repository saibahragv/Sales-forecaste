from fastapi import APIRouter, HTTPException

from app.schemas.features import FeaturesResponse
from app.services.features_service import FeaturesService


router = APIRouter(prefix="/features")


@router.get("", response_model=FeaturesResponse)
async def get_features(store: int | None = None, item: int | None = None, anchor_date: str | None = None, lookback_days: int = 180) -> FeaturesResponse:
    try:
        return FeaturesService().get_features(store=store, item=item, anchor_date=anchor_date, lookback_days=lookback_days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
