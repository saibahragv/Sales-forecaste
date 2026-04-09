from pydantic import BaseModel


class ShapFeatureImportance(BaseModel):
    feature: str
    mean_abs_shap: float


class ShapGlobalResponse(BaseModel):
    status: str
    scope: str
    top_features: list[ShapFeatureImportance]


class ShapContribution(BaseModel):
    feature: str
    value: float
    shap: float


class ShapLocalResponse(BaseModel):
    store: int
    item: int
    target_date: str
    prediction: float
    base_value: float
    contributions: list[ShapContribution]
    summary: str
