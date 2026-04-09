from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from threading import RLock
from typing import Any, Optional

import numpy as np

from app.schemas.assistant import AssistantCitation, AssistantQuery, AssistantResponse
from app.services.metrics_engine import MetricsEngine
from app.services.overview_engine import OverviewEngine
from app.services.shap_engine import ShapEngine


logger = logging.getLogger(__name__)


@dataclass
class _KbDoc:
    doc_id: str
    title: str
    text: str


_KB: list[_KbDoc] = [
    _KbDoc(
        doc_id="kpi:demand_health",
        title="Demand Health Score",
        text=(
            "Demand Health is a deterministic composite of stability, volatility penalty, and trend fit. "
            "Strong health indicates stable demand with consistent trend signal. At-risk health indicates high volatility "
            "and weak trend structure."
        ),
    ),
    _KbDoc(
        doc_id="metric:volatility",
        title="Volatility Score",
        text=(
            "Volatility is derived from trailing changes in sales. Higher volatility increases forecast uncertainty and "
            "reduces stability index."
        ),
    ),
    _KbDoc(
        doc_id="metric:stability",
        title="Stability Index",
        text=(
            "Stability Index is a bounded inverse-volatility measure. Higher values indicate predictable demand dynamics "
            "and tighter confidence bands."
        ),
    ),
    _KbDoc(
        doc_id="scenario:controls",
        title="Scenario Controls",
        text=(
            "Scenario simulation uses deterministic multipliers: macro shock, promotion lift, price penalty, and growth ramp. "
            "Use macro shock for broad demand shifts, promotion intensity for uplift, and growth slope for structural trend change."
        ),
    ),
    _KbDoc(
        doc_id="explain:shap",
        title="Forecast Drivers (SHAP)",
        text=(
            "SHAP explanations quantify how each feature contributes to the prediction relative to the expected value. "
            "Lag features typically dominate short-horizon forecasts; momentum and rolling statistics refine trend and volatility."
        ),
    ),
]


class _Embedder:
    def __init__(self) -> None:
        self._lock = RLock()
        self._model: Any | None = None
        self._kb_emb: np.ndarray | None = None

    def _load(self) -> None:
        # MiniLM via sentence-transformers. Deterministic inference (no generation).
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer("all-MiniLM-L6-v2")

    def _ensure(self) -> None:
        with self._lock:
            if self._model is None:
                self._load()
            if self._kb_emb is None:
                texts = [d.text for d in _KB]
                emb = np.asarray(self._model.encode(texts, normalize_embeddings=True))
                self._kb_emb = emb

    def query(self, text: str, k: int = 3) -> list[tuple[_KbDoc, float]]:
        self._ensure()
        q = np.asarray(self._model.encode([text], normalize_embeddings=True))[0]
        sims = (self._kb_emb @ q).astype(float)
        idx = np.argsort(-sims)[:k]
        return [(_KB[int(i)], float(sims[int(i)])) for i in idx]


_embedder = _Embedder()


def _classify_intent(q: str) -> str:
    ql = q.lower().strip()
    if any(k in ql for k in ["volatility", "risk", "uncertainty", "anomaly"]):
        return "risk_explain"
    if any(k in ql for k in ["stability", "stable"]):
        return "stability_explain"
    if any(k in ql for k in ["driver", "shap", "why", "explain forecast"]):
        return "forecast_drivers"
    if any(k in ql for k in ["scenario", "promotion", "elasticity", "shock"]):
        return "scenario_suggest"
    if any(k in ql for k in ["overview", "kpi", "health", "trend"]):
        return "executive_overview"
    return "semantic_answer"


class ChatbotEngine:
    def answer(self, req: AssistantQuery) -> AssistantResponse:
        intent = _classify_intent(req.query)

        citations_raw: list[tuple[_KbDoc, float]] = []
        try:
            citations_raw = _embedder.query(req.query, k=3)
        except Exception:
            logger.exception("assistant_embed_failed")

        citations = [
            AssistantCitation(source_id=d.doc_id, title=d.title, score=float(s)) for d, s in citations_raw
        ]

        bullets: list[str] = []
        actions: list[str] = []
        answer = ""

        # Structured, deterministic response paths
        if intent == "executive_overview":
            ov = OverviewEngine().overview(
                store=req.store,
                item=req.item,
                horizon_days=req.horizon_days,
                anchor_date=req.anchor_date,
            )
            answer = (
                f"Demand health is '{ov.demand_health.band}' (score={ov.demand_health.score:.2f}). "
                f"Trend is {ov.trend.direction} (slope_30d={ov.trend.slope_30d:.2f}, r2_30d={ov.trend.r2_30d:.2f})."
            )
            bullets = [
                f"Volatility={next(k.value for k in ov.kpis if k.label=='Volatility'):.3f}",
                f"Stability={next(k.value for k in ov.kpis if k.label=='Stability'):.3f}",
                f"Forecast delta={ov.forecast_delta:.0f} (pct={ov.forecast_delta_pct:.2f}%)" if ov.forecast_delta_pct is not None else f"Forecast delta={ov.forecast_delta:.0f}",
            ]
            actions = [
                "Review Risk & Stability Analysis for anomaly timeline and uncertainty drivers.",
                "Run Scenario Simulation Lab to stress-test macro shock and promotion intensity.",
            ]

        elif intent in ("risk_explain", "stability_explain"):
            if req.store is None or req.item is None:
                answer = "Risk/Stability explanations require a specific store and item to compute series metrics."
                actions = ["Select store and item, then retry the query."]
            else:
                r = MetricsEngine().risk(store=req.store, item=req.item, horizon_days=req.horizon_days)
                answer = (
                    f"Volatility score is {r.volatility_score:.3f} and stability index is {r.stability_index:.3f}. "
                    f"Anomaly flag is {str(r.anomaly_flag).lower()} and the confidence band is ±{r.confidence_band_pct:.1f}%."
                )
                bullets = [
                    "Higher volatility widens uncertainty and lowers stability.",
                    "Anomaly flag triggers when the last observed point deviates strongly from trailing distribution.",
                ]
                actions = [
                    "Inspect Feature Intelligence for rolling std/cv and anomaly z-score features.",
                    "Compare weekly vs monthly aggregation in Forecast Explorer to dampen noise.",
                ]

        elif intent == "forecast_drivers":
            if req.store is None or req.item is None:
                answer = "Forecast driver explanations require a specific store and item."
                actions = ["Select store and item, then run local SHAP explanation."]
            else:
                # Use SHAP local with anchor_date fallback
                target_date = req.anchor_date or "2017-12-31"
                loc = ShapEngine().local_explanation(store=req.store, item=req.item, target_date=target_date)
                answer = f"Local explanation for {loc.target_date}: {loc.summary}"
                bullets = [f"Prediction={loc.prediction:.2f}", f"Base value={loc.base_value:.2f}"]
                actions = [
                    "Open Feature Intelligence to view SHAP waterfall and interaction matrix.",
                    "Use Scenario Simulation Lab to test sensitivity to macro shock and promotion uplift.",
                ]

        elif intent == "scenario_suggest":
            answer = "Scenario adjustments are deterministic multipliers. Use them to bound risk without retraining."
            bullets = [
                "Macro shock: broad demand shift across horizon.",
                "Promotion intensity: uplift proxy; combine with price elasticity for net effect.",
                "Growth slope: linear ramp to simulate structural trend changes.",
            ]
            actions = [
                "Start with macro_demand_shock_pct ±5% to establish stress bounds.",
                "Use promotion_intensity 0.2–0.6 for lift scenarios; adjust price_elasticity to reflect margin constraints.",
                "Compare baseline vs scenario deltas by week and month aggregation.",
            ]

        else:
            # Semantic answer grounded in KB snippets
            if citations_raw:
                top_doc, _ = citations_raw[0]
                answer = top_doc.text
                bullets = [d.title for d, _ in citations_raw]
                actions = ["Refine query with a specific metric (volatility, stability, drivers, scenario)."]
            else:
                answer = "No semantic evidence found. Use a metric-specific query (volatility, stability, drivers, scenario)."
                actions = ["Try: 'Explain stability index for store 1 item 1'" ]

        debug = {
            "intent": intent,
            "has_embeddings": bool(citations_raw),
            "store": req.store,
            "item": req.item,
        }

        return AssistantResponse(
            intent=intent,
            answer=answer,
            bullets=bullets,
            actions=actions,
            citations=citations,
            debug=debug,
        )
