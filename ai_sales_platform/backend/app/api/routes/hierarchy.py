from fastapi import APIRouter

from app.schemas.hierarchy import HierarchyResponse
from app.services.hierarchy_service import HierarchyService


router = APIRouter(prefix="/hierarchy")


@router.get("", response_model=HierarchyResponse)
async def get_hierarchy() -> HierarchyResponse:
    return HierarchyService().get_hierarchy()
