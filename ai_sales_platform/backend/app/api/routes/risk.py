from fastapi import APIRouter, HTTPException

from app.schemas.risk import RiskResponse
from app.services.metrics_engine import MetricsEngine


router = APIRouter(prefix="/risk")


@router.get("", response_model=RiskResponse)
async def get_risk(store: int, item: int, horizon_days: int = 30) -> RiskResponse:
    try:
        return MetricsEngine().risk(store=store, item=item, horizon_days=horizon_days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
