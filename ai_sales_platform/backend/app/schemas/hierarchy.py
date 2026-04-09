from pydantic import BaseModel


class HierarchyResponse(BaseModel):
    stores: list[int]
    items_by_store: dict[int, list[int]]
    min_date: str
    max_date: str
