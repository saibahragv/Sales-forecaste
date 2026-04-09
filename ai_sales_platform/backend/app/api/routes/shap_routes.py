from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.shap_schemas import ShapGlobalResponse, ShapLocalResponse
from app.services.shap_engine import ShapEngine


router = APIRouter(prefix="/shap")


@router.get("/global", response_model=ShapGlobalResponse)
async def shap_global(background_tasks: BackgroundTasks, store: int | None = None, item: int | None = None) -> ShapGlobalResponse:
    try:
        return ShapEngine().global_importance(background_tasks=background_tasks, store=store, item=item)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/local", response_model=ShapLocalResponse)
async def shap_local(store: int, item: int, target_date: str) -> ShapLocalResponse:
    try:
        return ShapEngine().local_explanation(store=store, item=item, target_date=target_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
