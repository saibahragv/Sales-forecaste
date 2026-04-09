from fastapi import APIRouter, Query
from app.services.accuracy_engine import AccuracyEngine

router = APIRouter()
_engine = AccuracyEngine()


@router.get("/accuracy")
def get_accuracy(
    store: int = Query(...),
    item: int = Query(...),
    eval_window_days: int = Query(90, ge=14, le=365),
    forecast_horizon: int = Query(7, ge=1, le=30),
):
    return _engine.compute_accuracy(
        store=store,
        item=item,
        eval_window_days=eval_window_days,
        forecast_horizon=forecast_horizon,
    )
