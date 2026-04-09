"""
Forecast Accuracy Engine
Computes MAPE, RMSE, bias, hit-rate by backtesting the model on historical data.
"""
from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from app.core.config import settings
from app.schemas.forecast import ForecastRequest
from app.services.forecast_engine import ForecastEngine
from app.services.model_registry import ModelRegistry
from app.utils.cache import TTLCache


_cache = TTLCache()


class AccuracyEngine:
    def compute_accuracy(
        self,
        store: int,
        item: int,
        eval_window_days: int = 90,
        forecast_horizon: int = 7,
    ) -> dict:
        cache_key = f"accuracy:{store}:{item}:{eval_window_days}:{forecast_horizon}"
        cached = _cache.get(cache_key)
        if cached:
            return cached

        assets = ModelRegistry.get_instance().get_assets()
        df = assets.data
        series = df[(df["store"] == store) & (df["item"] == item)].sort_values("date").copy()
        if series.empty:
            raise ValueError(f"No data for store={store}, item={item}")

        max_date = series["date"].max()
        eval_start = max_date - pd.Timedelta(days=eval_window_days)
        eval_dates = series[series["date"] > eval_start]["date"].tolist()

        if len(eval_dates) < forecast_horizon:
            raise ValueError("Insufficient history for accuracy evaluation")

        actuals, predictions = [], []

        # Slide window: for each eval date, use anchor = date - horizon, predict forward
        step = max(1, len(eval_dates) // 20)  # At most 20 evaluations for performance
        eval_sample = eval_dates[::step]

        for target_date in eval_sample:
            anchor = target_date - pd.Timedelta(days=forecast_horizon)
            anchor_str = str(anchor.date())
            target_str = str(target_date.date())

            try:
                forecast = ForecastEngine().forecast(
                    ForecastRequest(
                        store=store,
                        item=item,
                        horizon_days=forecast_horizon,
                        anchor_date=anchor_str,
                    )
                )
                if not forecast.forecast:
                    continue

                # Find the predicted value closest to target_date
                pred_val: Optional[float] = None
                for fp in forecast.forecast:
                    if fp.date == target_str:
                        pred_val = fp.predicted_sales
                        break
                if pred_val is None:
                    pred_val = forecast.forecast[-1].predicted_sales

                actual_rows = series[series["date"] == target_date]["sales"].values
                if len(actual_rows) == 0:
                    continue
                actual_val = float(actual_rows[0])

                actuals.append(actual_val)
                predictions.append(pred_val)
            except Exception:
                continue

        if len(actuals) < 3:
            raise ValueError("Not enough valid evaluation points to compute accuracy")

        actuals_arr = np.array(actuals, dtype=float)
        preds_arr = np.array(predictions, dtype=float)
        errors = preds_arr - actuals_arr
        abs_pct_errors = np.abs(errors) / (actuals_arr + 1e-9) * 100.0

        mape = float(np.mean(abs_pct_errors))
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        bias = float(np.mean(errors))
        hit_rate_10 = float(np.mean(abs_pct_errors <= 10.0))
        hit_rate_20 = float(np.mean(abs_pct_errors <= 20.0))

        # Accuracy band classification
        if mape < 5:
            acc_band = "excellent"
        elif mape < 10:
            acc_band = "good"
        elif mape < 20:
            acc_band = "fair"
        else:
            acc_band = "poor"

        # Trend: compare first half vs second half MAPE
        mid = len(abs_pct_errors) // 2
        first_half_mape = float(np.mean(abs_pct_errors[:mid])) if mid > 0 else mape
        second_half_mape = float(np.mean(abs_pct_errors[mid:])) if mid > 0 else mape
        if second_half_mape < first_half_mape * 0.9:
            acc_trend = "improving"
        elif second_half_mape > first_half_mape * 1.1:
            acc_trend = "degrading"
        else:
            acc_trend = "stable"

        result = {
            "store": store,
            "item": item,
            "eval_window_days": eval_window_days,
            "forecast_horizon_days": forecast_horizon,
            "n_evaluations": len(actuals),
            "mape": round(mape, 2),
            "rmse": round(rmse, 2),
            "bias": round(bias, 2),
            "hit_rate_10pct": round(hit_rate_10, 3),
            "hit_rate_20pct": round(hit_rate_20, 3),
            "accuracy_band": acc_band,
            "accuracy_trend": acc_trend,
            "interpretation": (
                f"Model achieves {mape:.1f}% MAPE over the last {eval_window_days} days. "
                f"Hit rate (within 10% of actual): {hit_rate_10*100:.0f}%. "
                f"Forecast bias is {'+' if bias > 0 else ''}{bias:.1f} units ({('over' if bias > 0 else 'under')}-forecasting). "
                f"Trend: {acc_trend}."
            ),
        }
        _cache.set(cache_key, result, ttl_seconds=settings.cache_ttl_accuracy)
        return result
