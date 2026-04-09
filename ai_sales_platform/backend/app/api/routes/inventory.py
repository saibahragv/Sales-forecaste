from fastapi import APIRouter, Query
from typing import Optional

from app.services.inventory_engine import InventoryEngine

router = APIRouter()
_engine = InventoryEngine()


@router.get("/inventory")
def get_inventory(
    store: int = Query(...),
    item: int = Query(...),
    lead_time_days: Optional[int] = Query(None),
    service_level: Optional[float] = Query(None),
):
    return _engine.get_inventory(store=store, item=item, lead_time_days=lead_time_days, service_level=service_level)


@router.get("/inventory/alerts")
def get_inventory_alerts(top_n: int = Query(10, ge=1, le=50)):
    return {"alerts": _engine.get_alerts(top_n=top_n)}


@router.get("/inventory/abc-xyz")
def get_abc_xyz(store: Optional[int] = Query(None)):
    return _engine.get_abc_xyz_matrix(store=store)
