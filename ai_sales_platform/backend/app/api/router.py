from fastapi import APIRouter

from app.api.routes.assistant import router as assistant_router
from app.api.routes.features import router as features_router
from app.api.routes.forecast import router as forecast_router
from app.api.routes.governance_alias import router as governance_alias_router
from app.api.routes.hierarchy import router as hierarchy_router
from app.api.routes.model_governance import router as governance_router
from app.api.routes.overview import router as overview_router
from app.api.routes.risk import router as risk_router
from app.api.routes.scenario import router as scenario_router
from app.api.routes.shap_routes import router as shap_router
from app.api.routes.stream import router as stream_router


api_router = APIRouter()

api_router.include_router(overview_router, tags=["overview"])
api_router.include_router(hierarchy_router, tags=["hierarchy"])
api_router.include_router(forecast_router, tags=["forecast"])
api_router.include_router(scenario_router, tags=["scenario"])
api_router.include_router(shap_router, tags=["explainability"])
api_router.include_router(risk_router, tags=["risk"])
api_router.include_router(governance_router, tags=["governance"])
api_router.include_router(governance_alias_router, tags=["governance"])
api_router.include_router(features_router, tags=["features"])
api_router.include_router(assistant_router, tags=["assistant"])
api_router.include_router(stream_router, tags=["stream"])
