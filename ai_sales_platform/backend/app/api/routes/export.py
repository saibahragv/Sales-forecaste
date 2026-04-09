from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse, Response
from typing import Optional
import io
import csv

from app.services.forecast_engine import ForecastEngine
from app.services.scenario_engine import ScenarioEngine
from app.schemas.forecast import ForecastRequest
from app.schemas.scenario import ScenarioRequest, ScenarioAdjustments

router = APIRouter()


@router.get("/export/forecast")
def export_forecast(
    store: int = Query(...),
    item: int = Query(...),
    horizon_days: int = Query(30),
    anchor_date: Optional[str] = Query(None),
    aggregation: str = Query("daily"),
):
    engine = ForecastEngine()
    result = engine.forecast(ForecastRequest(
        store=store, item=item,
        horizon_days=horizon_days,
        anchor_date=anchor_date,
        aggregation=aggregation,
        include_history=True,
        include_confidence=True,
    ))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "type", "value", "lower_ci", "upper_ci"])

    for h in result.history:
        writer.writerow([h.date, "actual", round(h.actual_sales, 2), "", ""])

    conf_map = {c.date: c for c in result.confidence}
    for f in result.forecast:
        ci = conf_map.get(f.date)
        lo = round(ci.lower, 2) if ci else ""
        hi = round(ci.upper, 2) if ci else ""
        writer.writerow([f.date, "forecast", round(f.predicted_sales, 2), lo, hi])

    content = output.getvalue()
    filename = f"forecast_store{store}_item{item}_{anchor_date or 'latest'}.csv"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
