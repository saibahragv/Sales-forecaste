from __future__ import annotations

from typing import List, Optional

import numpy as np
import pandas as pd


REQUIRED_FEATURES = [
    "year",
    "month",
    "day",
    "day_of_week",
    "week_of_year",
    "lag_7",
    "lag_30",
]


def _safe_div(a: pd.Series | np.ndarray, b: pd.Series | np.ndarray, eps: float = 1e-9):
    return a / (b + eps)


def _rolling_slope(y: pd.Series, window: int) -> pd.Series:
    # Deterministic slope via OLS on index 0..window-1
    x = np.arange(window, dtype=float)
    x_mean = float(x.mean())
    denom = float(((x - x_mean) ** 2).sum()) + 1e-12

    def _slope(arr: np.ndarray) -> float:
        if len(arr) != window:
            return 0.0
        yv = arr.astype(float)
        y_mean = float(yv.mean())
        num = float(((x - x_mean) * (yv - y_mean)).sum())
        return num / denom

    return y.rolling(window=window, min_periods=window).apply(lambda a: _slope(np.asarray(a)), raw=False)


def add_date_features(df: pd.DataFrame, date_col: str = "date") -> pd.DataFrame:
    out = df.copy()
    dt = pd.to_datetime(out[date_col])
    out["year"] = dt.dt.year.astype(int)
    out["month"] = dt.dt.month.astype(int)
    out["day"] = dt.dt.day.astype(int)
    out["day_of_week"] = dt.dt.dayofweek.astype(int)
    out["week_of_year"] = dt.dt.isocalendar().week.astype(int)

    # Time intelligence (additional)
    out["quarter"] = dt.dt.quarter.astype(int)
    out["day_of_year"] = dt.dt.dayofyear.astype(int)
    out["day_of_quarter"] = (dt - dt.dt.to_period("Q").dt.start_time).dt.days.astype(int) + 1
    out["is_month_start"] = dt.dt.is_month_start.astype(int)
    out["is_month_end"] = dt.dt.is_month_end.astype(int)
    out["is_quarter_start"] = dt.dt.is_quarter_start.astype(int)
    out["is_quarter_end"] = dt.dt.is_quarter_end.astype(int)
    out["is_weekend"] = (dt.dt.dayofweek >= 5).astype(int)

    # Cyclical encodings
    out["dow_sin"] = np.sin(2 * np.pi * out["day_of_week"] / 7.0)
    out["dow_cos"] = np.cos(2 * np.pi * out["day_of_week"] / 7.0)
    out["month_sin"] = np.sin(2 * np.pi * out["month"] / 12.0)
    out["month_cos"] = np.cos(2 * np.pi * out["month"] / 12.0)
    out["woy_sin"] = np.sin(2 * np.pi * out["week_of_year"] / 52.0)
    out["woy_cos"] = np.cos(2 * np.pi * out["week_of_year"] / 52.0)
    return out


def add_lag_features(
    df: pd.DataFrame,
    group_cols: List[str] = ["store", "item"],
    target_col: str = "sales",
) -> pd.DataFrame:
    out = df.copy()
    g = out.groupby(group_cols, sort=False)

    # Momentum: multi-window lags
    for k in [1, 3, 7, 14, 30, 60, 90]:
        out[f"lag_{k}"] = g[target_col].shift(k)

    # Rolling metrics
    for w in [7, 14, 30, 60, 90]:
        out[f"roll_mean_{w}"] = g[target_col].rolling(window=w, min_periods=1).mean().reset_index(level=group_cols, drop=True)
        out[f"roll_std_{w}"] = g[target_col].rolling(window=w, min_periods=2).std().reset_index(level=group_cols, drop=True)
        out[f"roll_min_{w}"] = g[target_col].rolling(window=w, min_periods=1).min().reset_index(level=group_cols, drop=True)
        out[f"roll_max_{w}"] = g[target_col].rolling(window=w, min_periods=1).max().reset_index(level=group_cols, drop=True)
        out[f"roll_median_{w}"] = g[target_col].rolling(window=w, min_periods=1).median().reset_index(level=group_cols, drop=True)

    # Risk: coefficient of variation
    for w in [30, 90]:
        out[f"cv_{w}"] = _safe_div(out[f"roll_std_{w}"].fillna(0.0), out[f"roll_mean_{w}"].fillna(0.0))

    # EMA features
    for span in [7, 14, 30, 60]:
        out[f"ema_{span}"] = g[target_col].transform(lambda s: s.ewm(span=span, adjust=False, min_periods=1).mean())

    # Regression slope window + demand acceleration
    for w in [14, 30, 60]:
        out[f"slope_{w}"] = g[target_col].transform(lambda s: _rolling_slope(s, w)).fillna(0.0)

    out["diff_1"] = g[target_col].diff(1)
    out["diff_7"] = g[target_col].diff(7)
    out["accel_7"] = g[target_col].diff(7).diff(7)
    out["momentum_7_30"] = (out["roll_mean_7"] - out["roll_mean_30"]).fillna(0.0)
    out["momentum_ratio_7_30"] = _safe_div(out["roll_mean_7"].fillna(0.0), out["roll_mean_30"].fillna(0.0))

    # Seasonality amplitude proxy
    out["seasonal_amp_30"] = (out["roll_max_30"] - out["roll_min_30"]).fillna(0.0)
    out["seasonal_amp_90"] = (out["roll_max_90"] - out["roll_min_90"]).fillna(0.0)

    # Anomaly z-score (trailing 90)
    mu90 = out["roll_mean_90"].fillna(0.0)
    sd90 = out["roll_std_90"].fillna(0.0)
    out["anomaly_z_90"] = _safe_div((out[target_col] - mu90).fillna(0.0), sd90)

    # Stability index (bounded, deterministic)
    vol = out["cv_90"].fillna(0.0).clip(lower=0.0)
    out["stability_index"] = (1.0 / (1.0 + 10.0 * vol)).astype(float)

    # Fill key lags used by baseline model defaults
    out[["lag_7", "lag_30"]] = out[["lag_7", "lag_30"]].fillna(0.0)

    # Fill any remaining engineered features
    num_cols = out.select_dtypes(include=["number"]).columns
    out[num_cols] = out[num_cols].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return out


def add_hierarchical_features(
    df: pd.DataFrame,
    group_cols: List[str] = ["store", "item"],
    target_col: str = "sales",
) -> pd.DataFrame:
    out = df.copy()

    # Store/item demand indices based on trailing means (deterministic, avoids leakage by using expanding mean)
    out["store_mean"] = out.groupby(["store"], sort=False)[target_col].transform(lambda s: s.expanding(min_periods=1).mean())
    out["item_mean"] = out.groupby(["item"], sort=False)[target_col].transform(lambda s: s.expanding(min_periods=1).mean())
    out["global_mean"] = out[target_col].expanding(min_periods=1).mean()

    out["store_demand_index"] = _safe_div(out["store_mean"], out["global_mean"].replace(0.0, np.nan)).fillna(0.0)
    out["item_popularity_index"] = _safe_div(out["item_mean"], out["global_mean"].replace(0.0, np.nan)).fillna(0.0)
    out["store_item_interaction"] = (out["store_demand_index"] * out["item_popularity_index"]).astype(float)

    # Demand concentration ratio: share of store mean vs sum of item means in store on same date proxy
    # Use per-date store totals for deterministic concentration estimation
    store_total = out.groupby(["date", "store"], sort=False)[target_col].transform("sum").replace(0.0, np.nan)
    out["demand_concentration_ratio"] = _safe_div(out[target_col], store_total).fillna(0.0)

    # Categorical codes (kept numeric)
    out["store_id"] = out["store"].astype(int)
    out["item_id"] = out["item"].astype(int)

    num_cols = out.select_dtypes(include=["number"]).columns
    out[num_cols] = out[num_cols].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return out


def add_synthetic_simulation_features(df: pd.DataFrame) -> pd.DataFrame:
    # These are neutral baseline factors used by scenario simulation and sensitivity analysis.
    out = df.copy()
    out["elasticity_factor"] = 1.0
    out["promotion_boost_factor"] = 1.0
    out["macro_shock_multiplier"] = 1.0
    out["competitive_pressure_factor"] = 1.0
    return out


def build_feature_frame(raw: pd.DataFrame) -> pd.DataFrame:
    fe = add_date_features(raw, "date")
    fe = add_lag_features(fe, ["store", "item"], "sales")
    fe = add_hierarchical_features(fe, ["store", "item"], "sales")
    fe = add_synthetic_simulation_features(fe)
    return fe


def get_model_feature_order(model) -> Optional[List[str]]:
    feature_names = getattr(model, "feature_name_", None)
    if feature_names is not None:
        return list(feature_names)
    return None


def prepare_X(fe_df: pd.DataFrame, model) -> pd.DataFrame:
    feature_order = get_model_feature_order(model) or REQUIRED_FEATURES

    missing = [c for c in feature_order if c not in fe_df.columns]
    if missing:
        raise ValueError(f"Missing required features for inference: {missing}")

    X = fe_df[feature_order].copy()
    for c in X.columns:
        X[c] = pd.to_numeric(X[c], errors="coerce").fillna(0.0)

    return X


def clamp_non_negative(arr: np.ndarray) -> np.ndarray:
    return np.maximum(arr, 0.0)


def build_inference_row(
    work: pd.DataFrame,
    target_date: pd.Timestamp,
    feature_order: List[str],
    date_col: str = "date",
    target_col: str = "sales",
) -> pd.DataFrame:
    """Fast-path feature computation for iterative forecasting.

    Computes only the requested feature columns for a single (store,item,target_date) row.
    Assumes `work` contains a single store/item series sorted by date and includes prior
    actuals and already-filled predictions.
    """

    if work.empty:
        raise ValueError("work is empty")

    w = work[[date_col, target_col]].copy()
    w[date_col] = pd.to_datetime(w[date_col])
    w = w.sort_values(date_col)

    y = pd.to_numeric(w[target_col], errors="coerce").fillna(0.0).astype(float).values
    dts = pd.to_datetime(w[date_col]).values

    # Index of target_date in w (must exist)
    t = np.datetime64(target_date)
    idx_arr = np.where(dts == t)[0]
    if len(idx_arr) == 0:
        raise ValueError("target_date not present in work")
    idx = int(idx_arr[-1])

    # Date features for target_date
    ts = pd.to_datetime(target_date)
    year = int(ts.year)
    month = int(ts.month)
    day = int(ts.day)
    dow = int(ts.dayofweek)
    woy = int(ts.isocalendar().week)
    quarter = int(ts.quarter)
    doy = int(ts.dayofyear)
    doq = int((ts - ts.to_period("Q").start_time).days) + 1

    vals: dict[str, float] = {}
    for f in feature_order:
        if f == "year":
            vals[f] = float(year)
        elif f == "month":
            vals[f] = float(month)
        elif f == "day":
            vals[f] = float(day)
        elif f == "day_of_week":
            vals[f] = float(dow)
        elif f == "week_of_year":
            vals[f] = float(woy)
        elif f == "quarter":
            vals[f] = float(quarter)
        elif f == "day_of_year":
            vals[f] = float(doy)
        elif f == "day_of_quarter":
            vals[f] = float(doq)
        elif f == "dow_sin":
            vals[f] = float(np.sin(2 * np.pi * dow / 7.0))
        elif f == "dow_cos":
            vals[f] = float(np.cos(2 * np.pi * dow / 7.0))
        elif f == "month_sin":
            vals[f] = float(np.sin(2 * np.pi * month / 12.0))
        elif f == "month_cos":
            vals[f] = float(np.cos(2 * np.pi * month / 12.0))
        elif f == "woy_sin":
            vals[f] = float(np.sin(2 * np.pi * woy / 52.0))
        elif f == "woy_cos":
            vals[f] = float(np.cos(2 * np.pi * woy / 52.0))

    # Helpers for windowed computations
    def _tail(window: int) -> np.ndarray:
        if window <= 0:
            return y[: idx + 1]
        start = max(0, idx - window + 1)
        return y[start : idx + 1]

    def _lag(k: int) -> float:
        j = idx - k
        return float(y[j]) if j >= 0 else 0.0

    for f in feature_order:
        if f.startswith("lag_"):
            try:
                k = int(f.split("_")[1])
            except Exception:
                k = 0
            vals[f] = _lag(k)

        elif f.startswith("roll_mean_"):
            wdw = int(f.split("_")[-1])
            arr = _tail(wdw)
            vals[f] = float(arr.mean()) if arr.size else 0.0

        elif f.startswith("roll_std_"):
            wdw = int(f.split("_")[-1])
            arr = _tail(wdw)
            vals[f] = float(arr.std(ddof=1)) if arr.size >= 2 else 0.0

        elif f.startswith("ema_"):
            span = int(f.split("_")[-1])
            # Fast EMA via recursion over limited tail
            alpha = 2.0 / (float(span) + 1.0)
            arr = _tail(max(span * 3, 10))
            ema = float(arr[0]) if arr.size else 0.0
            for v in arr[1:]:
                ema = alpha * float(v) + (1.0 - alpha) * ema
            vals[f] = float(ema)

        elif f.startswith("slope_"):
            wdw = int(f.split("_")[-1])
            arr = _tail(wdw)
            if arr.size < max(3, wdw):
                vals[f] = 0.0
            else:
                x = np.arange(arr.size, dtype=float)
                x_mean = float(x.mean())
                y_mean = float(arr.mean())
                denom = float(((x - x_mean) ** 2).sum()) + 1e-12
                vals[f] = float(((x - x_mean) * (arr - y_mean)).sum() / denom)

        elif f == "diff_1":
            vals[f] = float(y[idx] - y[idx - 1]) if idx >= 1 else 0.0

        elif f == "diff_7":
            vals[f] = float(y[idx] - y[idx - 7]) if idx >= 7 else 0.0

        elif f == "accel_7":
            if idx >= 14:
                vals[f] = float((y[idx] - y[idx - 7]) - (y[idx - 7] - y[idx - 14]))
            else:
                vals[f] = 0.0

        elif f == "momentum_7_30":
            m7 = float(_tail(7).mean())
            m30 = float(_tail(30).mean())
            vals[f] = float(m7 - m30)

        elif f == "momentum_ratio_7_30":
            m7 = float(_tail(7).mean())
            m30 = float(_tail(30).mean())
            vals[f] = float(m7 / (m30 + 1e-9))

        elif f.startswith("cv_"):
            wdw = int(f.split("_")[-1])
            arr = _tail(wdw)
            mu = float(arr.mean()) if arr.size else 0.0
            sd = float(arr.std(ddof=1)) if arr.size >= 2 else 0.0
            vals[f] = float(sd / (mu + 1e-9))

        elif f == "anomaly_z_90":
            arr = _tail(90)
            mu = float(arr.mean()) if arr.size else 0.0
            sd = float(arr.std(ddof=1)) if arr.size >= 2 else 0.0
            vals[f] = float((float(y[idx]) - mu) / (sd + 1e-9))

        elif f == "stability_index":
            # Uses cv_90 proxy
            arr = _tail(90)
            mu = float(arr.mean()) if arr.size else 0.0
            sd = float(arr.std(ddof=1)) if arr.size >= 2 else 0.0
            cv = float(sd / (mu + 1e-9))
            vals[f] = float(1.0 / (1.0 + 10.0 * max(cv, 0.0)))

        elif f in ("store_id", "item_id"):
            # Provided by upstream prepare_X fallback if needed; keep 0 for safety.
            vals[f] = float(0.0)

        elif f in ("elasticity_factor", "promotion_boost_factor", "macro_shock_multiplier", "competitive_pressure_factor"):
            vals[f] = 1.0

    out = pd.DataFrame([vals])
    # Ensure all requested cols exist
    for c in feature_order:
        if c not in out.columns:
            out[c] = 0.0
    out = out[feature_order].copy()
    out = out.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return out


def compile_inference_requirements(feature_order: List[str]) -> dict:
    lags: set[int] = set()
    roll_mean: set[int] = set()
    roll_std: set[int] = set()
    ema: set[int] = set()
    slope: set[int] = set()

    for f in feature_order:
        if f.startswith("lag_"):
            try:
                lags.add(int(f.split("_")[1]))
            except Exception:
                pass
        elif f.startswith("roll_mean_"):
            try:
                roll_mean.add(int(f.split("_")[-1]))
            except Exception:
                pass
        elif f.startswith("roll_std_"):
            try:
                roll_std.add(int(f.split("_")[-1]))
            except Exception:
                pass
        elif f.startswith("ema_"):
            try:
                ema.add(int(f.split("_")[-1]))
            except Exception:
                pass
        elif f.startswith("slope_"):
            try:
                slope.add(int(f.split("_")[-1]))
            except Exception:
                pass

    max_lookback = 1
    if lags:
        max_lookback = max(max_lookback, max(lags))
    if roll_mean:
        max_lookback = max(max_lookback, max(roll_mean))
    if roll_std:
        max_lookback = max(max_lookback, max(roll_std))
    if slope:
        max_lookback = max(max_lookback, max(slope))
    if ema:
        max_lookback = max(max_lookback, max(ema) * 3)

    return {
        "lags": sorted(lags),
        "roll_mean": sorted(roll_mean),
        "roll_std": sorted(roll_std),
        "ema": sorted(ema),
        "slope": sorted(slope),
        "max_lookback": int(max_lookback),
    }


def build_inference_row_fast(
    y: np.ndarray,
    current_date: pd.Timestamp,
    feature_order: List[str],
    req: dict,
) -> pd.DataFrame:
    idx = int(len(y) - 1)
    ts = pd.to_datetime(current_date)
    year = int(ts.year)
    month = int(ts.month)
    day = int(ts.day)
    dow = int(ts.dayofweek)
    woy = int(ts.isocalendar().week)
    quarter = int(ts.quarter)
    doy = int(ts.dayofyear)
    doq = int((ts - ts.to_period("Q").start_time).days) + 1

    def _tail(window: int) -> np.ndarray:
        if window <= 0:
            return y
        start = max(0, idx - window + 1)
        return y[start : idx + 1]

    def _lag(k: int) -> float:
        j = idx - k
        return float(y[j]) if j >= 0 else 0.0

    cache_mean: dict[int, float] = {}
    cache_std: dict[int, float] = {}
    for w in req.get("roll_mean", []):
        arr = _tail(int(w))
        cache_mean[int(w)] = float(arr.mean()) if arr.size else 0.0
    for w in req.get("roll_std", []):
        arr = _tail(int(w))
        cache_std[int(w)] = float(arr.std(ddof=1)) if arr.size >= 2 else 0.0

    vals: dict[str, float] = {}
    for f in feature_order:
        if f == "year":
            vals[f] = float(year)
        elif f == "month":
            vals[f] = float(month)
        elif f == "day":
            vals[f] = float(day)
        elif f == "day_of_week":
            vals[f] = float(dow)
        elif f == "week_of_year":
            vals[f] = float(woy)
        elif f == "quarter":
            vals[f] = float(quarter)
        elif f == "day_of_year":
            vals[f] = float(doy)
        elif f == "day_of_quarter":
            vals[f] = float(doq)
        elif f == "dow_sin":
            vals[f] = float(np.sin(2 * np.pi * dow / 7.0))
        elif f == "dow_cos":
            vals[f] = float(np.cos(2 * np.pi * dow / 7.0))
        elif f == "month_sin":
            vals[f] = float(np.sin(2 * np.pi * month / 12.0))
        elif f == "month_cos":
            vals[f] = float(np.cos(2 * np.pi * month / 12.0))
        elif f == "woy_sin":
            vals[f] = float(np.sin(2 * np.pi * woy / 52.0))
        elif f == "woy_cos":
            vals[f] = float(np.cos(2 * np.pi * woy / 52.0))
        elif f.startswith("lag_"):
            try:
                vals[f] = _lag(int(f.split("_")[1]))
            except Exception:
                vals[f] = 0.0
        elif f.startswith("roll_mean_"):
            try:
                vals[f] = float(cache_mean.get(int(f.split("_")[-1]), 0.0))
            except Exception:
                vals[f] = 0.0
        elif f.startswith("roll_std_"):
            try:
                vals[f] = float(cache_std.get(int(f.split("_")[-1]), 0.0))
            except Exception:
                vals[f] = 0.0
        elif f.startswith("ema_"):
            try:
                span = int(f.split("_")[-1])
            except Exception:
                span = 0
            if span <= 1:
                vals[f] = float(y[idx]) if idx >= 0 else 0.0
            else:
                alpha = 2.0 / (float(span) + 1.0)
                arr = _tail(max(span * 3, 10))
                ema = float(arr[0]) if arr.size else 0.0
                for v in arr[1:]:
                    ema = alpha * float(v) + (1.0 - alpha) * ema
                vals[f] = float(ema)
        elif f.startswith("slope_"):
            try:
                wdw = int(f.split("_")[-1])
            except Exception:
                wdw = 0
            arr = _tail(wdw)
            if arr.size < max(3, wdw) or wdw <= 1:
                vals[f] = 0.0
            else:
                x = np.arange(arr.size, dtype=float)
                x_mean = float(x.mean())
                y_mean = float(arr.mean())
                denom = float(((x - x_mean) ** 2).sum()) + 1e-12
                vals[f] = float(((x - x_mean) * (arr - y_mean)).sum() / denom)
        elif f == "diff_1":
            vals[f] = float(y[idx] - y[idx - 1]) if idx >= 1 else 0.0
        elif f == "diff_7":
            vals[f] = float(y[idx] - y[idx - 7]) if idx >= 7 else 0.0
        elif f == "accel_7":
            vals[f] = float((y[idx] - y[idx - 7]) - (y[idx - 7] - y[idx - 14])) if idx >= 14 else 0.0
        elif f == "momentum_7_30":
            m7 = float(_tail(7).mean())
            m30 = float(_tail(30).mean())
            vals[f] = float(m7 - m30)
        elif f == "momentum_ratio_7_30":
            m7 = float(_tail(7).mean())
            m30 = float(_tail(30).mean())
            vals[f] = float(m7 / (m30 + 1e-9))
        elif f.startswith("cv_"):
            try:
                wdw = int(f.split("_")[-1])
            except Exception:
                wdw = 0
            arr = _tail(wdw)
            mu = float(arr.mean()) if arr.size else 0.0
            sd = float(arr.std(ddof=1)) if arr.size >= 2 else 0.0
            vals[f] = float(sd / (mu + 1e-9))
        elif f == "anomaly_z_90":
            arr = _tail(90)
            mu = float(arr.mean()) if arr.size else 0.0
            sd = float(arr.std(ddof=1)) if arr.size >= 2 else 0.0
            vals[f] = float((float(y[idx]) - mu) / (sd + 1e-9))
        elif f == "stability_index":
            arr = _tail(90)
            mu = float(arr.mean()) if arr.size else 0.0
            sd = float(arr.std(ddof=1)) if arr.size >= 2 else 0.0
            cv = float(sd / (mu + 1e-9))
            vals[f] = float(1.0 / (1.0 + 10.0 * max(cv, 0.0)))
        elif f in ("elasticity_factor", "promotion_boost_factor", "macro_shock_multiplier", "competitive_pressure_factor"):
            vals[f] = 1.0
        else:
            if f not in vals:
                vals[f] = 0.0

    out = pd.DataFrame([vals])
    out = out.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    out = out[feature_order].copy()
    return out
