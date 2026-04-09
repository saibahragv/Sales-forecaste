from fastapi import APIRouter, HTTPException

from app.schemas.overview import OverviewResponse
from app.services.overview_engine import OverviewEngine


router = APIRouter(prefix="/overview")


@router.get("", response_model=OverviewResponse)
async def get_overview(store: int | None = None, item: int | None = None, horizon_days: int = 30, anchor_date: str | None = None) -> OverviewResponse:
    try:
        return OverviewEngine().overview(store=store, item=item, horizon_days=horizon_days, anchor_date=anchor_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
