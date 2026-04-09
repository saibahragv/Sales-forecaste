from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from app.schemas.features import FeatureCorrelation, FeatureGroup, FeatureValue, FeaturesResponse
from app.services.model_registry import ModelRegistry
from app.utils.feature_engineering import build_feature_frame, get_model_feature_order


_FEATURE_GROUPS: list[FeatureGroup] = [
    FeatureGroup(
        name="time_intelligence",
        features=[
            "year",
            "quarter",
            "month",
            "day",
            "day_of_week",
            "week_of_year",
            "day_of_year",
            "day_of_quarter",
            "dow_sin",
            "dow_cos",
            "month_sin",
            "month_cos",
            "woy_sin",
            "woy_cos",
            "is_weekend",
            "is_month_start",
            "is_month_end",
            "is_quarter_start",
            "is_quarter_end",
            "seasonal_amp_30",
            "seasonal_amp_90",
        ],
    ),
    FeatureGroup(
        name="momentum",
        features=[
            "lag_1",
            "lag_3",
            "lag_7",
            "lag_14",
            "lag_30",
            "lag_60",
            "lag_90",
            "roll_mean_7",
            "roll_mean_14",
            "roll_mean_30",
            "roll_mean_60",
            "roll_mean_90",
            "ema_7",
            "ema_14",
            "ema_30",
            "ema_60",
            "slope_14",
            "slope_30",
            "slope_60",
            "diff_1",
            "diff_7",
            "accel_7",
            "momentum_7_30",
            "momentum_ratio_7_30",
        ],
    ),
    FeatureGroup(
        name="risk",
        features=[
            "roll_std_7",
            "roll_std_14",
            "roll_std_30",
            "roll_std_60",
            "roll_std_90",
            "cv_30",
            "cv_90",
            "anomaly_z_90",
            "stability_index",
        ],
    ),
    FeatureGroup(
        name="hierarchical",
        features=[
            "store_mean",
            "item_mean",
            "global_mean",
            "store_demand_index",
            "item_popularity_index",
            "store_item_interaction",
            "demand_concentration_ratio",
            "store_id",
            "item_id",
        ],
    ),
    FeatureGroup(
        name="synthetic_simulation",
        features=[
            "elasticity_factor",
            "promotion_boost_factor",
            "macro_shock_multiplier",
            "competitive_pressure_factor",
        ],
    ),
]


class FeaturesService:
    def get_features(
        self,
        store: Optional[int] = None,
        item: Optional[int] = None,
        anchor_date: str | None = None,
        lookback_days: int = 180,
    ) -> FeaturesResponse:
        assets = ModelRegistry.get_instance().get_assets()
        model = assets.model
        df = assets.data

        scoped = df
        scope_parts = []
        if store is not None:
            scoped = scoped[scoped["store"] == store]
            scope_parts.append(f"store={store}")
        if item is not None:
            scoped = scoped[scoped["item"] == item]
            scope_parts.append(f"item={item}")

        scope = "global" if not scope_parts else ",".join(scope_parts)
        if scoped.empty:
            raise ValueError("No data for requested scope")

        scoped = scoped.sort_values("date")
        anchor = pd.to_datetime(anchor_date) if anchor_date else scoped["date"].max()
        start = anchor - pd.Timedelta(days=int(lookback_days))
        scoped = scoped[(scoped["date"] >= start) & (scoped["date"] <= anchor)].copy()
        if scoped.empty:
            raise ValueError("No history in requested lookback window")

        fe = build_feature_frame(scoped[["date", "store", "item", "sales"]].copy())
        fe_num = fe.select_dtypes(include=["number"]).copy()

        # Snapshot: latest row (most recent date)
        last = fe.sort_values("date").tail(1)
        snapshot = []
        for c in fe_num.columns:
            snapshot.append(FeatureValue(feature=str(c), value=float(last[c].iloc[0]) if c in last.columns else 0.0))

        # Correlations: compute on engineered numeric features (limit for performance)
        # Use a cap to keep response size reasonable.
        cols = list(fe_num.columns)
        if len(cols) > 80:
            cols = cols[:80]
        corr = fe_num[cols].corr().replace([np.inf, -np.inf], np.nan).fillna(0.0)

        pairs: list[FeatureCorrelation] = []
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                v = float(corr.iloc[i, j])
                if abs(v) >= 0.65:
                    pairs.append(FeatureCorrelation(feature_a=str(cols[i]), feature_b=str(cols[j]), corr=v))
        pairs = sorted(pairs, key=lambda p: abs(p.corr), reverse=True)[:20]

        model_features = get_model_feature_order(model) or []
        feature_count = int(len(fe_num.columns))

        return FeaturesResponse(
            scope=scope,
            feature_count=feature_count,
            feature_groups=_FEATURE_GROUPS,
            snapshot=sorted(snapshot, key=lambda x: x.feature),
            top_correlations=pairs,
            model_features=model_features,
        )
