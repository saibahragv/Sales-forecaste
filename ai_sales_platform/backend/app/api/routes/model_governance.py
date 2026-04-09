from fastapi import APIRouter

from app.schemas.governance import ModelGovernanceResponse
from app.services.model_metadata_service import ModelMetadataService


router = APIRouter(prefix="/model")


@router.get("/governance", response_model=ModelGovernanceResponse)
async def get_governance() -> ModelGovernanceResponse:
    return ModelMetadataService().governance()
