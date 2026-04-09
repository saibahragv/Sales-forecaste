from __future__ import annotations

from pydantic import BaseModel, Field


class AssistantQuery(BaseModel):
    query: str = Field(..., min_length=1)
    store: int | None = None
    item: int | None = None
    anchor_date: str | None = None
    horizon_days: int = Field(30, ge=1, le=365)


class AssistantCitation(BaseModel):
    source_id: str
    title: str
    score: float


class AssistantResponse(BaseModel):
    intent: str
    answer: str
    bullets: list[str]
    actions: list[str]
    citations: list[AssistantCitation]
    debug: dict
