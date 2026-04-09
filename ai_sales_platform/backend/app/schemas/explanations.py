from __future__ import annotations

from pydantic import BaseModel


class MetricExplanation(BaseModel):
    title: str
    definition: str
    calculation_logic: str
    business_meaning: str
    current_interpretation: str
    reasoning: list[str]
    suggested_action: str | None = None
