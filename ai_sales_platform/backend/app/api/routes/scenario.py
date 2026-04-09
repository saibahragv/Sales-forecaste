from fastapi import APIRouter, HTTPException

from app.schemas.scenario import ScenarioRequest, ScenarioResponse
from app.services.scenario_engine import ScenarioEngine


router = APIRouter(prefix="/scenario")


@router.post("", response_model=ScenarioResponse)
async def run_scenario(req: ScenarioRequest) -> ScenarioResponse:
    try:
        return ScenarioEngine().simulate(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
