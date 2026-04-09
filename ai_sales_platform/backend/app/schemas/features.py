from __future__ import annotations

from pydantic import BaseModel


class FeatureValue(BaseModel):
    feature: str
    value: float


class FeatureGroup(BaseModel):
    name: str
    features: list[str]


class FeatureCorrelation(BaseModel):
    feature_a: str
    feature_b: str
    corr: float


class FeaturesResponse(BaseModel):
    scope: str
    feature_count: int
    feature_groups: list[FeatureGroup]

    # Snapshot: features for the latest available point in the requested scope
    snapshot: list[FeatureValue]

    # Data engineering console: top correlations in the engineered frame
    top_correlations: list[FeatureCorrelation]

    # Model-facing features (inference order)
    model_features: list[str]
