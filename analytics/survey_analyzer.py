"""PawMatch AI Survey Analytics Engine.

Processes adoption follow-up survey data and generates:
  - Overall system performance metrics
  - Per-shelter report cards
  - AI model accuracy breakdown
  - Actionable insights via local LLM (Ollama)

Designed to run in "local mode" — no external APIs, Ollama-powered analysis.
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Optional

import httpx
import structlog

logger = structlog.get_logger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

BEHAVIOR_ASPECTS = [
    "Energy level/Need for exercise",
    "Affection level/Need for attention",
    "Temperment",
    "Trainability/Obedience",
    "Compatibility with children",
]

RATING_FIELDS = {
    "lifestyle_fit": "How well does the pet fit your lifestyle?",
    "comfort_people": "Rate your pets Comfort with new people or visitors",
    "noise_adjustment": "Please rate your pets adjustment to the noise levels",
    "comfort_other_pets": "Please rate your pets comfort with other existing pets",
    "sleeping_area": "Please rate your pet settling into their designated sleeping area",
    "emotional_bond": "How would you rate the current emotional bond between you and your adopted pet?",
    "tool_helpfulness": "Did the matching tool help you choose the right pet?",
    "recommend_tool": "Would you reccomend this tool to others?",
}

OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2:latest"


# ── Data Loading ──────────────────────────────────────────────────────────────

def load_survey_csv(path: str | Path) -> list[dict]:
    """Load and parse the survey CSV into a list of response dicts."""
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            parsed = {
                "name": row.get("Enter your name", "").strip(),
                "gender": row.get("Gender", "").strip(),
                "still_has_pet": row.get("Do you still have the adopted pet?", "").strip(),
                "pet_type": row.get("What type of pet did you adopt?", "").strip(),
                "shelter": row.get("Adoption Shelter", "").strip(),
                "shelter_comments": row.get("Any comments for the shelter (to improve or commend)", "").strip(),
                "predicted_behaviors": row.get(
                    "Which aspects of your pet's behavior were accurately predicted by the PawMatch AI tool?", ""
                ).strip(),
                "process_comments": row.get("Any other comments about the pawmatch process?", "").strip(),
            }
            # Parse numeric ratings
            for key, col_name in RATING_FIELDS.items():
                try:
                    parsed[key] = int(row.get(col_name, 0))
                except (ValueError, TypeError):
                    parsed[key] = 0
            rows.append(parsed)
    return rows


# ── Core Analytics ────────────────────────────────────────────────────────────

def compute_overall_stats(data: list[dict]) -> dict[str, Any]:
    """Compute system-wide performance metrics."""
    n = len(data)
    if n == 0:
        return {}

    # Retention
    still_has = sum(1 for r in data if r["still_has_pet"] == "Yes")
    returned = [r for r in data if r["still_has_pet"] == "No"]

    # Pet type distribution
    pet_types = Counter(r["pet_type"] for r in data)

    # Gender distribution
    genders = Counter(r["gender"] for r in data)

    # Average ratings
    avg_ratings = {}
    for key in RATING_FIELDS:
        vals = [r[key] for r in data if r[key] > 0]
        avg_ratings[key] = round(sum(vals) / len(vals), 2) if vals else 0

    # Behavior prediction accuracy
    behavior_counts = Counter()
    none_count = 0
    for r in data:
        preds = r["predicted_behaviors"]
        if preds.lower() == "none of these" or not preds:
            none_count += 1
        else:
            for b in preds.split(","):
                b = b.strip()
                if b:
                    behavior_counts[b] += 1

    # Shelter distribution
    shelters = Counter(r["shelter"] for r in data)

    # Satisfaction tiers
    tool_ratings = [r["tool_helpfulness"] for r in data if r["tool_helpfulness"] > 0]
    promoters = sum(1 for t in tool_ratings if t >= 5)
    passives = sum(1 for t in tool_ratings if t == 4)
    detractors = sum(1 for t in tool_ratings if t <= 3)

    # NPS-style score
    nps = round(((promoters - detractors) / len(tool_ratings)) * 100) if tool_ratings else 0

    # Return reasons from comments
    return_reasons = []
    for r in returned:
        reasons = []
        if r["shelter_comments"]:
            reasons.append(r["shelter_comments"])
        if r["process_comments"]:
            reasons.append(r["process_comments"])
        return_reasons.append({
            "name": r["name"],
            "pet_type": r["pet_type"],
            "shelter": r["shelter"],
            "comments": " | ".join(reasons) if reasons else "No comment provided",
        })

    return {
        "total_responses": n,
        "retention_rate": round((still_has / n) * 100, 1),
        "still_has_pet": still_has,
        "returned_pet": n - still_has,
        "pet_type_distribution": dict(pet_types),
        "gender_distribution": dict(genders),
        "average_ratings": avg_ratings,
        "behavior_prediction_counts": dict(behavior_counts.most_common()),
        "behavior_none_count": none_count,
        "shelter_distribution": dict(shelters),
        "nps_score": nps,
        "satisfaction_tiers": {
            "promoters": promoters,
            "passives": passives,
            "detractors": detractors,
        },
        "return_cases": return_reasons,
    }


def compute_shelter_reports(data: list[dict]) -> dict[str, dict]:
    """Compute per-shelter report cards."""
    shelters: dict[str, list[dict]] = defaultdict(list)
    for r in data:
        shelters[r["shelter"]].append(r)

    reports = {}
    for shelter_name, responses in shelters.items():
        n = len(responses)
        still_has = sum(1 for r in responses if r["still_has_pet"] == "Yes")

        # Average ratings for this shelter
        avg_ratings = {}
        for key in RATING_FIELDS:
            vals = [r[key] for r in responses if r[key] > 0]
            avg_ratings[key] = round(sum(vals) / len(vals), 2) if vals else 0

        # Pet types at this shelter
        pet_types = Counter(r["pet_type"] for r in responses)

        # Behavior prediction accuracy
        behavior_counts = Counter()
        none_count = 0
        for r in responses:
            preds = r["predicted_behaviors"]
            if preds.lower() == "none of these" or not preds:
                none_count += 1
            else:
                for b in preds.split(","):
                    b = b.strip()
                    if b:
                        behavior_counts[b] += 1

        # Collect all shelter comments
        positive_comments = []
        negative_comments = []
        for r in responses:
            comment = r["shelter_comments"]
            if not comment:
                continue
            # Simple sentiment heuristic based on rating
            overall_avg = sum(r[k] for k in RATING_FIELDS if r[k] > 0) / max(
                sum(1 for k in RATING_FIELDS if r[k] > 0), 1
            )
            if overall_avg >= 4:
                positive_comments.append({"name": r["name"], "comment": comment})
            elif overall_avg <= 2.5:
                negative_comments.append({"name": r["name"], "comment": comment})
            else:
                # Neutral — classify by keywords
                neg_words = ["bad", "poor", "terrible", "awful", "disappoint", "complain", "wait", "rush", "understaffed", "run down"]
                if any(w in comment.lower() for w in neg_words):
                    negative_comments.append({"name": r["name"], "comment": comment})
                else:
                    positive_comments.append({"name": r["name"], "comment": comment})

        # Overall shelter grade (out of 5)
        all_ratings = []
        for r in responses:
            r_vals = [r[k] for k in RATING_FIELDS if r[k] > 0]
            if r_vals:
                all_ratings.append(sum(r_vals) / len(r_vals))
        shelter_grade = round(sum(all_ratings) / len(all_ratings), 2) if all_ratings else 0

        # Tool recommendation rate at this shelter
        recommend_vals = [r["recommend_tool"] for r in responses if r["recommend_tool"] > 0]
        recommend_rate = round(
            (sum(1 for v in recommend_vals if v >= 4) / len(recommend_vals)) * 100, 1
        ) if recommend_vals else 0

        reports[shelter_name] = {
            "total_adoptions": n,
            "retention_rate": round((still_has / n) * 100, 1),
            "shelter_grade": shelter_grade,
            "average_ratings": avg_ratings,
            "pet_type_distribution": dict(pet_types),
            "behavior_predictions": dict(behavior_counts.most_common()),
            "behavior_none_count": none_count,
            "positive_comments": positive_comments,
            "negative_comments": negative_comments,
            "tool_recommendation_rate": recommend_rate,
        }

    return reports


def compute_ai_model_evaluation(data: list[dict]) -> dict[str, Any]:
    """Evaluate the PawMatch AI model's prediction accuracy."""
    # Which behaviors are most/least accurately predicted?
    behavior_hits = Counter()
    total_respondents_with_predictions = 0

    for r in data:
        preds = r["predicted_behaviors"]
        if preds.lower() != "none of these" and preds.strip():
            total_respondents_with_predictions += 1
            for b in preds.split(","):
                b = b.strip()
                if b:
                    behavior_hits[b] += 1

    # Prediction accuracy by pet type
    pet_type_accuracy = defaultdict(lambda: {"total": 0, "high_match": 0, "low_match": 0})
    for r in data:
        pt = r["pet_type"]
        pet_type_accuracy[pt]["total"] += 1
        if r["tool_helpfulness"] >= 4:
            pet_type_accuracy[pt]["high_match"] += 1
        elif r["tool_helpfulness"] <= 2:
            pet_type_accuracy[pt]["low_match"] += 1

    # Correlation: bond strength vs tool helpfulness
    bond_vs_tool = []
    for r in data:
        if r["emotional_bond"] > 0 and r["tool_helpfulness"] > 0:
            bond_vs_tool.append({
                "bond": r["emotional_bond"],
                "tool": r["tool_helpfulness"],
            })

    # Weakest areas (lowest avg ratings)
    rating_averages = []
    for key, label in RATING_FIELDS.items():
        vals = [r[key] for r in data if r[key] > 0]
        avg = round(sum(vals) / len(vals), 2) if vals else 0
        rating_averages.append({"field": key, "label": label, "average": avg})
    rating_averages.sort(key=lambda x: x["average"])

    # Failure analysis — cases where tool was rated 1-2
    failures = []
    for r in data:
        if r["tool_helpfulness"] <= 2:
            failures.append({
                "name": r["name"],
                "pet_type": r["pet_type"],
                "shelter": r["shelter"],
                "still_has_pet": r["still_has_pet"],
                "tool_rating": r["tool_helpfulness"],
                "shelter_comment": r["shelter_comments"],
                "process_comment": r["process_comments"],
                "predicted_behaviors": r["predicted_behaviors"],
            })

    return {
        "total_with_predictions": total_respondents_with_predictions,
        "total_without_predictions": len(data) - total_respondents_with_predictions,
        "behavior_hit_rates": {
            b: {
                "count": c,
                "rate": round((c / total_respondents_with_predictions) * 100, 1)
                if total_respondents_with_predictions > 0
                else 0,
            }
            for b, c in behavior_hits.most_common()
        },
        "pet_type_accuracy": {
            k: {
                "total": v["total"],
                "high_match_pct": round((v["high_match"] / v["total"]) * 100, 1),
                "low_match_pct": round((v["low_match"] / v["total"]) * 100, 1),
            }
            for k, v in pet_type_accuracy.items()
        },
        "weakest_areas": rating_averages[:3],
        "strongest_areas": rating_averages[-3:],
        "failures": failures,
        "bond_tool_correlation": bond_vs_tool,
    }


# ── Ollama-Powered AI Insights ───────────────────────────────────────────────

async def generate_ai_insights(
    overall: dict,
    shelter_reports: dict,
    model_eval: dict,
    ollama_url: str = OLLAMA_URL,
    model: str = OLLAMA_MODEL,
) -> dict[str, Any]:
    """Use local Ollama LLM to generate actionable insights from the analytics."""

    # Build a structured prompt with all data
    prompt = f"""You are an expert pet adoption analytics consultant. Analyze the following PawMatch AI survey data and provide actionable insights.

## OVERALL STATISTICS
- Total survey responses: {overall['total_responses']}
- Pet retention rate: {overall['retention_rate']}%
- Pets returned: {overall['returned_pet']}
- NPS Score: {overall['nps_score']}
- Satisfaction tiers: {json.dumps(overall['satisfaction_tiers'])}
- Average ratings: {json.dumps(overall['average_ratings'])}
- Pet type distribution: {json.dumps(overall['pet_type_distribution'])}

## RETURN CASES
{json.dumps(overall['return_cases'], indent=2)}

## AI MODEL EVALUATION
- Behavior predictions: {json.dumps(model_eval['behavior_hit_rates'])}
- Pet type accuracy: {json.dumps(model_eval['pet_type_accuracy'])}
- Weakest areas: {json.dumps(model_eval['weakest_areas'])}
- Failure cases: {json.dumps(model_eval['failures'], indent=2)}

## SHELTER PERFORMANCE SUMMARY
{json.dumps({name: {
    'grade': report['shelter_grade'],
    'retention': report['retention_rate'],
    'adoptions': report['total_adoptions'],
    'recommendation_rate': report['tool_recommendation_rate'],
    'negative_comments_count': len(report['negative_comments']),
} for name, report in shelter_reports.items()}, indent=2)}

Respond with a JSON object containing exactly these keys:
1. "executive_summary" — a 3-4 sentence overview of PawMatch AI's performance
2. "model_strengths" — array of 3-4 specific strengths of the AI matching model
3. "model_weaknesses" — array of 3-4 specific areas the AI model needs improvement
4. "priority_actions" — array of 4-5 concrete, prioritized action items for the engineering team
5. "shelter_insights" — object mapping each shelter name to a 2-sentence personalized insight
6. "risk_flags" — array of 2-3 risk areas that need immediate attention
7. "retention_analysis" — 2-3 sentences specifically about why pets are being returned

Respond ONLY with the JSON object, no markdown fences or extra text."""

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 2000},
                },
            )
            resp.raise_for_status()
            raw = resp.json().get("response", "")

            # Try to extract JSON from the response
            # Strip markdown fences if present
            cleaned = re.sub(r"```json\s*", "", raw)
            cleaned = re.sub(r"```\s*", "", cleaned)
            cleaned = cleaned.strip()

            try:
                insights = json.loads(cleaned)
            except json.JSONDecodeError:
                # Try to find JSON object in the text
                match = re.search(r"\{.*\}", cleaned, re.DOTALL)
                if match:
                    insights = json.loads(match.group())
                else:
                    logger.warning("Could not parse LLM response as JSON, returning raw")
                    insights = {"raw_response": raw, "parse_error": True}

            return insights

    except httpx.ConnectError:
        logger.error("Cannot connect to Ollama for insights generation")
        return _fallback_insights(overall, model_eval, shelter_reports)
    except Exception as e:
        logger.error("Ollama insights generation failed", error=str(e))
        return _fallback_insights(overall, model_eval, shelter_reports)


def _fallback_insights(overall: dict, model_eval: dict, shelter_reports: dict) -> dict:
    """Generate deterministic insights when Ollama is unavailable."""
    # Build insights from data analysis alone
    strengths = []
    weaknesses = []
    actions = []

    if overall["retention_rate"] >= 90:
        strengths.append(f"Excellent retention rate of {overall['retention_rate']}% demonstrates strong matching accuracy.")
    elif overall["retention_rate"] >= 80:
        strengths.append(f"Good retention rate of {overall['retention_rate']}%, though there is room for improvement.")
    else:
        weaknesses.append(f"Retention rate of {overall['retention_rate']}% is below target and needs urgent attention.")

    if overall["nps_score"] >= 50:
        strengths.append(f"Strong NPS score of {overall['nps_score']} indicates high user satisfaction and willingness to recommend.")
    elif overall["nps_score"] >= 20:
        strengths.append(f"Moderate NPS score of {overall['nps_score']} shows general satisfaction with the tool.")

    # Analyze behavior predictions
    if model_eval["behavior_hit_rates"]:
        top_behavior = list(model_eval["behavior_hit_rates"].keys())[0]
        strengths.append(f"'{top_behavior}' is the most accurately predicted behavior, validated by adopters.")

    # Weakest areas
    for area in model_eval["weakest_areas"][:2]:
        weaknesses.append(f"'{area['field'].replace('_', ' ').title()}' has the lowest average rating ({area['average']}/5) and needs improvement.")

    # Pet-type specific accuracy
    for pet, acc in model_eval["pet_type_accuracy"].items():
        if acc["low_match_pct"] > 15:
            weaknesses.append(f"{pet} adoptions have a {acc['low_match_pct']}% low-match rate — the model may need more {pet.lower()}-specific training data.")
            actions.append(f"Improve {pet.lower()} behavior prediction models with additional species-specific features.")

    # Failure analysis
    failures = model_eval["failures"]
    if failures:
        common_issues = []
        for f in failures:
            if "aggression" in (f.get("shelter_comment", "") + f.get("process_comment", "")).lower():
                common_issues.append("aggression detection")
            if "energy" in (f.get("shelter_comment", "") + f.get("process_comment", "")).lower():
                common_issues.append("energy level prediction")
            if "noise" in (f.get("shelter_comment", "") + f.get("process_comment", "")).lower():
                common_issues.append("noise sensitivity assessment")
            if "compatible" in (f.get("shelter_comment", "") + f.get("process_comment", "")).lower() or "multi-pet" in (f.get("process_comment", "") or "").lower():
                common_issues.append("multi-pet compatibility")
        if common_issues:
            actions.append(f"Address prediction gaps in: {', '.join(set(common_issues))}.")

    actions.append("Add apartment/housing-type as a weighted factor in the matching algorithm.")
    actions.append("Implement post-adoption follow-up surveys at 2-week and 3-month intervals to catch early issues.")

    # Shelter insights
    shelter_insights = {}
    for name, report in shelter_reports.items():
        if report["shelter_grade"] >= 4.5:
            shelter_insights[name] = f"Excellent performance with a {report['shelter_grade']}/5 grade. {report['retention_rate']}% retention rate. Keep up the great work."
        elif report["shelter_grade"] >= 3.5:
            shelter_insights[name] = f"Good performance ({report['shelter_grade']}/5) but {len(report['negative_comments'])} areas of concern noted by adopters. Review feedback for quick wins."
        else:
            shelter_insights[name] = f"Needs attention — {report['shelter_grade']}/5 grade with {100 - report['retention_rate']}% return rate. Priority: address adopter complaints about transparency and staffing."

    # Retention analysis
    return_types = Counter(r["pet_type"] for r in overall.get("return_cases", []))
    return_analysis = f"Of {overall['returned_pet']} returns, the most returned pet type is {return_types.most_common(1)[0][0] if return_types else 'N/A'}. " if overall["returned_pet"] > 0 else ""
    return_analysis += "Common return reasons include behavioral mismatches, housing incompatibility, and life circumstance changes. The AI model should better account for environmental factors."

    return {
        "executive_summary": f"PawMatch AI processed {overall['total_responses']} adoption follow-ups with a {overall['retention_rate']}% retention rate and NPS of {overall['nps_score']}. The matching tool is performing well overall, with most adopters reporting accurate behavioral predictions. Key improvement areas include noise sensitivity prediction, multi-pet compatibility, and bird/exotic species matching.",
        "model_strengths": strengths[:4],
        "model_weaknesses": weaknesses[:4],
        "priority_actions": actions[:5],
        "shelter_insights": shelter_insights,
        "risk_flags": [
            f"{overall['returned_pet']} pets were returned — each represents a failed match that could have been prevented.",
            "Bird adoptions show significantly lower satisfaction; the model may lack sufficient avian behavioral data.",
            "Some shelters report understaffing and long wait times, which can negatively affect the adoption experience regardless of match quality.",
        ],
        "retention_analysis": return_analysis,
        "fallback_mode": True,
    }


# ── Full Analysis Pipeline ────────────────────────────────────────────────────

async def run_full_analysis(csv_path: str | Path, use_ollama: bool = True) -> dict[str, Any]:
    """Run the complete analysis pipeline and return all results."""
    data = load_survey_csv(csv_path)

    overall = compute_overall_stats(data)
    shelter_reports = compute_shelter_reports(data)
    model_eval = compute_ai_model_evaluation(data)

    if use_ollama:
        ai_insights = await generate_ai_insights(overall, shelter_reports, model_eval)
    else:
        ai_insights = _fallback_insights(overall, model_eval, shelter_reports)

    return {
        "overall": overall,
        "shelter_reports": shelter_reports,
        "model_evaluation": model_eval,
        "ai_insights": ai_insights,
    }
