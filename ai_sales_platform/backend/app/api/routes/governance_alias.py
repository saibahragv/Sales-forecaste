from fastapi import APIRouter

from app.schemas.governance import ModelGovernanceResponse
from app.services.model_metadata_service import ModelMetadataService


router = APIRouter(prefix="/governance")


@router.get("", response_model=ModelGovernanceResponse)
async def get_governance_alias() -> ModelGovernanceResponse:
    return ModelMetadataService().governance()
