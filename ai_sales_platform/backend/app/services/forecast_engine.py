from __future__ import annotations

import hashlib
from typing import List, Optional

import numpy as np
import pandas as pd

from app.core.config import settings
from app.schemas.forecast import (
    ConfidencePoint,
    DecompositionPoint,
    ForecastPoint,
    ForecastRequest,
    ForecastResponse,
    HistoryPoint,
)
from app.services.model_registry import ModelRegistry
from app.services.metrics_engine import MetricsEngine
from app.services.interpretation_engine import InterpretationContext, InterpretationEngine
from app.utils.cache import TTLCache
from app.utils.feature_engineering import (
    build_inference_row_fast,
    clamp_non_negative,
    compile_inference_requirements,
    get_model_feature_order,
)


_cache = TTLCache()


def _cache_key(req: ForecastRequest) -> str:
    raw = (
        f"store={req.store}|item={req.item}|h={req.horizon_days}|anchor={req.anchor_date or ''}"
        f"|hist={req.history_days}|agg={req.aggregation}|ih={int(req.include_history)}"
        f"|ic={int(req.include_confidence)}|norm={int(req.normalize)}"
    )
    return "forecast:v1:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _aggregate_series(df: pd.DataFrame, date_col: str, value_col: str, aggregation: str) -> pd.DataFrame:
    tmp = df[[date_col, value_col]].copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col])

    if aggregation == "daily":
        out = tmp.groupby(date_col, as_index=False)[value_col].sum()
        return out.sort_values(date_col)

    if aggregation == "weekly":
        # Week ending Sunday
        per = tmp[date_col].dt.to_period("W-SUN")
        out = tmp.assign(_p=per).groupby("_p", as_index=False)[value_col].sum()
        out[date_col] = out["_p"].dt.end_time.dt.normalize()
        return out[[date_col, value_col]].sort_values(date_col)

    if aggregation == "monthly":
        per = tmp[date_col].dt.to_period("M")
        out = tmp.assign(_p=per).groupby("_p", as_index=False)[value_col].sum()
        out[date_col] = out["_p"].dt.end_time.dt.normalize()
        return out[[date_col, value_col]].sort_values(date_col)

    raise ValueError("aggregation must be one of: daily, weekly, monthly")


def _decompose(history_daily: pd.DataFrame) -> list[DecompositionPoint]:
    if history_daily.empty:
        return []

    df = history_daily.copy().sort_values("date")
    df["date"] = pd.to_datetime(df["date"])
    df["y"] = pd.to_numeric(df["actual"], errors="coerce").fillna(0.0)

    # Trend: EMA(30)
    df["trend"] = df["y"].ewm(span=30, adjust=False, min_periods=1).mean()

    # Seasonality: deterministic weekday effect computed on detrended series
    df["dow"] = df["date"].dt.dayofweek.astype(int)
    df["detrended"] = df["y"] - df["trend"]
    dow_mean = df.groupby("dow", as_index=True)["detrended"].mean().to_dict()
    df["seasonal"] = df["dow"].map(lambda d: float(dow_mean.get(int(d), 0.0)))
    df["residual"] = df["y"] - df["trend"] - df["seasonal"]

    out: list[DecompositionPoint] = []
    for _, r in df.iterrows():
        out.append(
            DecompositionPoint(
                date=pd.to_datetime(r["date"]).date().isoformat(),
                trend=float(r["trend"]),
                seasonal=float(r["seasonal"]),
                residual=float(r["residual"]),
            )
        )
    return out


class ForecastEngine:
    def forecast(self, req: ForecastRequest) -> ForecastResponse:
        if req.horizon_days < 1:
            raise ValueError("horizon_days must be >= 1")

        key = _cache_key(req)
        cached = _cache.get(key)
        if cached is not None:
            return cached

        assets = ModelRegistry.get_instance().get_assets()
        model = assets.model
        df = assets.data

        feature_order = get_model_feature_order(model)
        if not feature_order:
            raise ValueError("Model does not expose feature order; cannot run fast inference")

        series = df[(df["store"] == req.store) & (df["item"] == req.item)].copy()
        series = series.sort_values("date")
        if series.empty:
            raise ValueError("No history found for selected store/item")

        if req.anchor_date:
            anchor = pd.to_datetime(req.anchor_date)
        else:
            anchor = series["date"].max()

        series = series[series["date"] <= anchor].copy()
        if series.empty:
            raise ValueError("No history on or before anchor_date")

        work = series[["date", "store", "item", "sales"]].copy()

        # Prepare numeric history for fast iterative forecasting
        work_series = work[["date", "sales"]].copy().sort_values("date")
        work_series = work_series[work_series["date"] <= anchor].copy()
        y_hist = pd.to_numeric(work_series["sales"], errors="coerce").fillna(0.0).astype(float).values
        if y_hist.size < 2:
            raise ValueError("Insufficient history for forecasting")

        # History window
        hist_start = anchor - pd.Timedelta(days=int(req.history_days))
        history_df = work[(work["date"] >= hist_start) & (work["date"] <= anchor)].copy()

        history_points: list[HistoryPoint] = []
        if req.include_history:
            hist_daily = _aggregate_series(history_df.rename(columns={"sales": "actual"}), "date", "actual", "daily")
            for _, r in hist_daily.iterrows():
                history_points.append(
                    HistoryPoint(date=pd.to_datetime(r["date"]).date().isoformat(), actual_sales=float(r["actual"]))
                )

        decomposition = _decompose(history_df.rename(columns={"sales": "actual"})[["date", "actual"]].copy())

        infer_req = compile_inference_requirements(feature_order)

        preds: List[ForecastPoint] = []
        for step in range(1, req.horizon_days + 1):
            next_date = anchor + pd.Timedelta(days=step)

            # Fast-path: compute only the model-required features for this single step from trailing y array.
            # Note: features are computed from history up to anchor+(step-1); we append prediction after scoring.
            X_next = build_inference_row_fast(y_hist, pd.to_datetime(next_date), feature_order, infer_req)
            yhat = float(model.predict(X_next)[0])
            yhat = float(clamp_non_negative(np.array([yhat]))[0])

            y_hist = np.append(y_hist, yhat)
            preds.append(ForecastPoint(date=next_date.date().isoformat(), predicted_sales=yhat))

        # Aggregation for display
        agg = req.aggregation
        if agg not in ("daily", "weekly", "monthly"):
            raise ValueError("aggregation must be one of: daily, weekly, monthly")

        forecast_df = pd.DataFrame({"date": [p.date for p in preds], "pred": [p.predicted_sales for p in preds]})
        forecast_agg = _aggregate_series(forecast_df, "date", "pred", agg)
        forecast_points: list[ForecastPoint] = [
            ForecastPoint(date=pd.to_datetime(r["date"]).date().isoformat(), predicted_sales=float(r["pred"]))
            for _, r in forecast_agg.iterrows()
        ]

        history_out: list[HistoryPoint] = []
        if req.include_history:
            hist_df = pd.DataFrame({"date": [p.date for p in history_points], "actual": [p.actual_sales for p in history_points]})
            hist_agg = _aggregate_series(hist_df, "date", "actual", agg)
            history_out = [
                HistoryPoint(date=pd.to_datetime(r["date"]).date().isoformat(), actual_sales=float(r["actual"]))
                for _, r in hist_agg.iterrows()
            ]

        normalized = bool(req.normalize)

        # Confidence interval (heuristic)
        confidence: list[ConfidencePoint] = []
        explanations: dict[str, object] = {}
        if req.include_confidence:
            risk = MetricsEngine().risk(store=req.store, item=req.item, horizon_days=req.horizon_days)
            band = float(risk.confidence_band_pct) / 100.0
            for fp in forecast_points:
                yhat = float(fp.predicted_sales)
                lo = max(0.0, yhat * (1.0 - band))
                hi = max(0.0, yhat * (1.0 + band))
                confidence.append(ConfidencePoint(date=fp.date, lower=lo, upper=hi))

            # carry deterministic explanation from /risk
            explanations["confidence_band_pct"] = risk.explanations.get("confidence_band_pct")

        # Normalization (index to 100 at mean of history)
        if normalized:
            base = float(np.mean([p.actual_sales for p in history_out]) if history_out else 0.0)
            base = base if base > 0 else 1.0

            history_out = [
                HistoryPoint(date=p.date, actual_sales=float(p.actual_sales) / base * 100.0) for p in history_out
            ]
            forecast_points = [
                ForecastPoint(date=p.date, predicted_sales=float(p.predicted_sales) / base * 100.0)
                for p in forecast_points
            ]
            confidence = [
                ConfidencePoint(date=c.date, lower=float(c.lower) / base * 100.0, upper=float(c.upper) / base * 100.0)
                for c in confidence
            ]
            # Decomposition normalization uses same base
            decomposition = [
                DecompositionPoint(
                    date=d.date,
                    trend=float(d.trend) / base * 100.0,
                    seasonal=float(d.seasonal) / base * 100.0,
                    residual=float(d.residual) / base * 100.0,
                )
                for d in decomposition
            ]

        ie = InterpretationEngine()
        ctx = InterpretationContext(
            scope=f"store={req.store},item={req.item}",
            horizon_days=req.horizon_days,
            aggregation=agg,
            normalized=normalized,
        )
        explanations["forecast_aggregation"] = ie.explain("forecast_aggregation", None, ctx, extras={"aggregation": agg})
        explanations["forecast_normalization"] = ie.explain("forecast_normalization", None, ctx, extras={"normalized": normalized})
        explanations["forecast_decomposition"] = ie.explain("forecast_decomposition", None, ctx)

        resp = ForecastResponse(
            store=req.store,
            item=req.item,
            anchor_date=pd.to_datetime(anchor).date().isoformat(),
            horizon_days=req.horizon_days,
            forecast=forecast_points,
            predicted_total=float(sum(p.predicted_sales for p in forecast_points)),
            aggregation=agg,
            normalized=normalized,
            history=history_out,
            confidence=confidence,
            decomposition=decomposition if req.include_history else [],
            explanations={k: v for k, v in explanations.items() if v is not None},
        )

        _cache.set(key, resp, ttl_seconds=settings.cache_ttl_forecast)
        return resp
