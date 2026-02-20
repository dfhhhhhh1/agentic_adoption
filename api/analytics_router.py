"""FastAPI router for PawMatch AI survey analytics.

Endpoints:
  GET  /analytics/overview     — Overall system stats + AI insights
  GET  /analytics/shelters     — All shelter report cards
  GET  /analytics/shelter/{name} — Single shelter report
  GET  /analytics/model-eval   — AI model accuracy evaluation
  POST /analytics/generate-report — Generate full analysis (triggers Ollama)

Designed as a drop-in router for the existing FastAPI app.
Add to api/main.py:
    from api.analytics_router import router as analytics_router
    app.include_router(analytics_router)
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from analytics.survey_analyzer import (
    load_survey_csv,
    compute_overall_stats,
    compute_shelter_reports,
    compute_ai_model_evaluation,
    run_full_analysis,
)

router = APIRouter(prefix="/analytics", tags=["Survey Analytics"])

# ── Configuration ─────────────────────────────────────────────────────────────

# Default path to the survey CSV — can be overridden via env var
SURVEY_CSV_PATH = os.environ.get(
    "PAWMATCH_SURVEY_CSV",
    str(Path(__file__).parent.parent / "data" / "PawMatchAI_Stats.csv"),
)


# ── Response Models ───────────────────────────────────────────────────────────

class AnalyticsOverviewResponse(BaseModel):
    overall: dict
    ai_insights: dict


class ShelterReportResponse(BaseModel):
    shelter_name: str
    report: dict


class ModelEvalResponse(BaseModel):
    evaluation: dict


class FullAnalysisResponse(BaseModel):
    overall: dict
    shelter_reports: dict
    model_evaluation: dict
    ai_insights: dict


# ── Cached Data ───────────────────────────────────────────────────────────────

_cache: dict = {}


def _load_data():
    """Load and cache the survey data."""
    if "data" not in _cache:
        try:
            _cache["data"] = load_survey_csv(SURVEY_CSV_PATH)
        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail=f"Survey CSV not found at {SURVEY_CSV_PATH}. Set PAWMATCH_SURVEY_CSV env var.",
            )
    return _cache["data"]


def _invalidate_cache():
    """Clear cached data (after uploading new CSV, etc.)."""
    _cache.clear()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(use_ollama: bool = Query(default=True)):
    """Get overall analytics with AI-generated insights.

    Set use_ollama=false to skip LLM generation and use deterministic analysis.
    """
    data = _load_data()
    overall = compute_overall_stats(data)
    shelter_reports = compute_shelter_reports(data)
    model_eval = compute_ai_model_evaluation(data)

    if use_ollama:
        from analytics.survey_analyzer import generate_ai_insights
        ai_insights = await generate_ai_insights(overall, shelter_reports, model_eval)
    else:
        from analytics.survey_analyzer import _fallback_insights
        ai_insights = _fallback_insights(overall, model_eval, shelter_reports)

    return AnalyticsOverviewResponse(overall=overall, ai_insights=ai_insights)


@router.get("/shelters")
async def get_all_shelter_reports():
    """Get report cards for all shelters."""
    data = _load_data()
    reports = compute_shelter_reports(data)
    return {"shelter_reports": reports}


@router.get("/shelter/{shelter_name}")
async def get_shelter_report(shelter_name: str):
    """Get report card for a specific shelter."""
    data = _load_data()
    reports = compute_shelter_reports(data)

    # Fuzzy match shelter name
    matched = None
    for name in reports:
        if shelter_name.lower() in name.lower():
            matched = name
            break

    if not matched:
        raise HTTPException(
            status_code=404,
            detail=f"Shelter '{shelter_name}' not found. Available: {list(reports.keys())}",
        )

    return ShelterReportResponse(shelter_name=matched, report=reports[matched])


@router.get("/model-eval", response_model=ModelEvalResponse)
async def get_model_evaluation():
    """Get AI model accuracy evaluation."""
    data = _load_data()
    evaluation = compute_ai_model_evaluation(data)
    return ModelEvalResponse(evaluation=evaluation)


@router.post("/generate-report", response_model=FullAnalysisResponse)
async def generate_full_report(use_ollama: bool = Query(default=True)):
    """Generate a complete analysis report. Triggers Ollama if use_ollama=true."""
    _invalidate_cache()
    result = await run_full_analysis(SURVEY_CSV_PATH, use_ollama=use_ollama)
    return FullAnalysisResponse(**result)


@router.post("/refresh")
async def refresh_data():
    """Refresh cached data from the CSV file."""
    _invalidate_cache()
    data = _load_data()
    return {"status": "refreshed", "records_loaded": len(data)}
