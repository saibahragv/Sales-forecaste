from app.schemas.hierarchy import HierarchyResponse
from app.services.model_registry import ModelRegistry
from app.utils.cache import TTLCache
from app.core.config import settings


_cache = TTLCache()


class HierarchyService:
    def get_hierarchy(self) -> HierarchyResponse:
        cached = _cache.get("hierarchy:v1")
        if cached is not None:
            return cached

        assets = ModelRegistry.get_instance().get_assets()
        df = assets.data

        stores = sorted(df["store"].unique().tolist())
        items_by_store: dict[int, list[int]] = {}
        for s in stores:
            items_by_store[int(s)] = sorted(df[df["store"] == s]["item"].unique().tolist())

        resp = HierarchyResponse(
            stores=stores,
            items_by_store=items_by_store,
            min_date=df["date"].min().date().isoformat(),
            max_date=df["date"].max().date().isoformat(),
        )

        _cache.set("hierarchy:v1", resp, ttl_seconds=settings.cache_ttl_hierarchy)
        return resp
