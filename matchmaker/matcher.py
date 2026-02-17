"""Stage 2: The Matchmaker — Rebuilt for reliability with small local Ollama models.

Root problems fixed:
  - gemma3:4b / llama3.2 don't reliably produce a bare JSON array of 24 numbers.
  - 14k-token explanation prompts time out on local hardware.

New design:
  1. Vector search retrieves top-K candidates (as before).
  2. SCORE PASS: Score pets in small batches (3 at a time) using a trivial
     {"scores": [0.8, 0.5, 0.3]} schema — much easier for small models.
     Falls back to per-pet single scoring if batch parsing still fails.
  3. EXPLAIN PASS: Explain the top-N pets one at a time (tiny prompts, fast).
  4. AGENT LOOP (optional): If the best score is below a confidence threshold,
     the agent widens the search and rescores before giving up.
"""

from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import wraps
from typing import Optional

import httpx
import structlog

from config.settings import get_settings
from db.models import get_session_factory, Pet
from db.repository import PetRepository
from ingestion.embeddings import get_embedder
from models.schemas import (
    MatchQuery,
    MatchResult,
    MatchResponse,
    PetSchema,
    Species,
)

logger = structlog.get_logger(__name__)

# ── Tunables ──────────────────────────────────────────────────────────────────

BATCH_SIZE = 3          # Pets per scoring call — keep small for local models
MAX_WORKERS = 1         # Parallel Ollama calls (keep <= your GPU layers)
SCORE_TIMEOUT = 50.0    # Per-batch timeout (seconds) — small prompt = fast
EXPLAIN_TIMEOUT = 45.0  # Per-pet explanation timeout
LOW_CONFIDENCE_THRESHOLD = 0.55  # Trigger agent retry if best score < this
MAX_AGENT_ROUNDS = 2    # How many times the agent may widen the search

# ── Prompts ───────────────────────────────────────────────────────────────────

BATCH_SCORE_SYSTEM = """You are a pet adoption assistant. Score each pet for adoption fit.
Return ONLY a JSON object: {"scores": [<float>, <float>, ...]}
One float per pet (0.0 = terrible fit, 1.0 = perfect fit). No other text."""

SINGLE_SCORE_SYSTEM = """You are a pet adoption assistant.
Return ONLY a JSON object: {"score": <float>}
Score 0.0 (terrible fit) to 1.0 (perfect fit). No other text."""

EXPLAIN_SYSTEM = """You are a friendly pet adoption matchmaker.
In 2-3 sentences explain why this specific pet suits (or doesn't suit) the adopter.
Return ONLY a JSON object: {"explanation": "<your explanation here>"}
Be specific — mention the pet's name, breed traits, energy level, and how they match the adopter's needs. No other text."""


# ── JSON helpers ──────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict | list:
    """
    Robustly extract JSON from LLM output that may contain:
      - markdown fences (```json ... ```)
      - leading/trailing prose
      - multiple JSON objects (we take the first valid one)
    """
    # 1. Try direct parse first
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # 2. Strip markdown fences
    fenced = re.sub(r"```(?:json)?\s*", "", text)
    fenced = re.sub(r"```", "", fenced).strip()
    try:
        return json.loads(fenced)
    except json.JSONDecodeError:
        pass

    # 3. Find the first {...} or [...] block via regex
    for pattern in (r"\{[^{}]*\}", r"\[[^\[\]]*\]", r"\{.*?\}", r"\[.*?\]"):
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                continue

    raise ValueError(f"No valid JSON found in LLM output: {text[:200]!r}")


# ── Retry decorator ───────────────────────────────────────────────────────────

def retry_with_backoff(max_retries: int = 2, base_delay: float = 1.0, backoff_factor: float = 2.0):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            delay = base_delay
            last_err = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except (httpx.TimeoutException, httpx.ConnectError, ValueError) as e:
                    last_err = e
                    if attempt < max_retries:
                        logger.warning("Retrying after error", error=str(e), attempt=attempt + 1, delay=delay)
                        time.sleep(delay)
                        delay *= backoff_factor
            raise last_err
        return wrapper
    return decorator


# ── Ollama call ───────────────────────────────────────────────────────────────

def _ollama_chat(system: str, user: str, timeout: float, settings) -> str:
    """Single Ollama /api/chat call. Returns the message content string."""
    with httpx.Client(timeout=timeout) as client:
        resp = client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "format": "json",   # Forces JSON-only output on supporting models
                "stream": False,
            },
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]


# ── Pet formatters ────────────────────────────────────────────────────────────

def _pet_minimal(pet: Pet) -> str:
    """Ultra-compact one-liner for scoring prompts."""
    compat = []
    if pet.good_with_dogs is not None:
        compat.append(f"dogs:{'Y' if pet.good_with_dogs else 'N'}")
    if pet.good_with_cats is not None:
        compat.append(f"cats:{'Y' if pet.good_with_cats else 'N'}")
    if pet.good_with_children is not None:
        compat.append(f"kids:{'Y' if pet.good_with_children else 'N'}")
    compat_str = f" [{', '.join(compat)}]" if compat else ""
    return f"{pet.name} ({pet.breed}, {pet.age_text}, {pet.size}, {pet.energy_level} energy{compat_str})"


def _pet_full(pet: Pet) -> str:
    """Full context for explanation prompts."""
    lines = [
        f"Name: {pet.name}",
        f"Breed: {pet.breed} | Age: {pet.age_text} | Size: {pet.size} | Sex: {pet.sex}",
        f"Energy: {pet.energy_level}",
    ]
    if pet.good_with_dogs is not None:
        lines.append(f"Good with dogs: {'Yes' if pet.good_with_dogs else 'No'}")
    if pet.good_with_cats is not None:
        lines.append(f"Good with cats: {'Yes' if pet.good_with_cats else 'No'}")
    if pet.good_with_children is not None:
        lines.append(f"Good with children: {'Yes' if pet.good_with_children else 'No'}")
    if pet.house_trained is not None:
        lines.append(f"House trained: {'Yes' if pet.house_trained else 'No'}")
    if pet.personality_description:
        lines.append(f"Personality: {pet.personality_description}")
    return "\n".join(lines)


def _pet_fallback_reasoning(pet: Pet) -> str:
    """Generate a specific fallback explanation when LLM explanation fails.
    
    BUG FIX: The old code returned the same generic string for every pet.
    This version uses actual pet attributes so each fallback is unique.
    """
    traits = []
    if pet.energy_level and pet.energy_level != "unknown":
        traits.append(f"{pet.energy_level}-energy")
    if pet.size and pet.size != "unknown":
        traits.append(f"{pet.size}-sized")
    
    personality_snippet = ""
    if pet.personality_description:
        # Take just the first sentence
        first_sentence = pet.personality_description.split('.')[0].strip()
        if len(first_sentence) > 10:
            personality_snippet = f" {first_sentence}."
    
    compat_parts = []
    if pet.good_with_children:
        compat_parts.append("children")
    if pet.good_with_dogs:
        compat_parts.append("dogs")
    if pet.good_with_cats:
        compat_parts.append("cats")
    compat_str = ""
    if compat_parts:
        compat_str = f" Gets along well with {', '.join(compat_parts)}."
    
    trait_str = f" {' '.join(traits)}" if traits else ""
    return (
        f"{pet.name} is a{trait_str} {pet.breed} "
        f"who could be a great companion.{personality_snippet}{compat_str}"
    )


def _pet_orm_to_schema(pet: Pet) -> PetSchema:
    return PetSchema(
        name=pet.name,
        species=pet.species,
        breed=pet.breed,
        age_text=pet.age_text,
        age_months=pet.age_months,
        sex=pet.sex,
        size=pet.size,
        weight_lbs=pet.weight_lbs,
        color=pet.color,
        energy_level=pet.energy_level,
        good_with_dogs=pet.good_with_dogs,
        good_with_cats=pet.good_with_cats,
        good_with_children=pet.good_with_children,
        house_trained=pet.house_trained,
        special_needs=pet.special_needs,
        personality_description=pet.personality_description,
        adoption_fee=pet.adoption_fee,
        is_neutered=pet.is_neutered,
        shelter_name=pet.shelter.name if pet.shelter else "Unknown",
        shelter_location=pet.shelter.location if pet.shelter else None,
        shelter_contact=pet.shelter.contact_info if pet.shelter else None,
        listing_url=pet.listing_url or "",
        image_urls=pet.image_urls or [],
        image_path=pet.image_path,
        external_id=pet.external_id,
        intake_date=pet.intake_date_str,
    )


# ── Scoring ───────────────────────────────────────────────────────────────────

@retry_with_backoff(max_retries=2, base_delay=1.0)
def _score_batch(user_query: str, pets: list[Pet], settings) -> list[float]:
    """
    Score a small batch of pets (BATCH_SIZE). Returns a float list in the same order.
    Falls back to None if the model cannot produce parseable output after retries,
    signaling the caller to use vector similarity scores instead.
    """
    if not pets:
        return []

    pet_lines = "\n".join(
        f"{i + 1}. {_pet_minimal(p)}" for i, p in enumerate(pets)
    )
    prompt = (
        f"Adopter: {user_query}\n\n"
        f"Rate these {len(pets)} pet(s) for fit:\n{pet_lines}\n\n"
        f'Return exactly {len(pets)} scores. Example for {len(pets)} pets: '
        f'{{"scores": {[0.8] * len(pets)}}}'
    )

    try:
        raw = _ollama_chat(BATCH_SCORE_SYSTEM, prompt, SCORE_TIMEOUT, settings)
        data = _extract_json(raw)

        # Accept {"scores": [...]} or a bare list
        if isinstance(data, dict):
            scores = data.get("scores") or data.get("score")
            if isinstance(scores, (int, float)):
                scores = [scores]
        elif isinstance(data, list):
            scores = data
        else:
            raise ValueError(f"Unexpected JSON shape: {data}")

        scores = [float(s) for s in (scores or [])]
        if len(scores) != len(pets):
            logger.warning(
                "Score count mismatch — padding/trimming",
                expected=len(pets),
                got=len(scores),
            )
            scores = (scores + [0.5] * len(pets))[: len(pets)]

        return [max(0.0, min(1.0, s)) for s in scores]

    except Exception as e:
        # BUG FIX: Return None instead of [0.5]*N so the caller knows scoring
        # failed and can fall back to vector similarity scores instead of
        # giving every pet the identical 0.5 score.
        logger.warning("Batch scoring failed, returning None for vec-score fallback", error=str(e), batch_size=len(pets))
        return None


def _score_all_pets(user_query: str, pets: list[Pet], settings) -> tuple[dict[int, float], bool]:
    """
    Score all pets in parallel batches. Returns ({original_index: score}, llm_scored).
    
    BUG FIX: Now returns a boolean indicating whether LLM scoring actually worked.
    When it didn't, the caller can weight vector similarity higher instead of
    showing identical percentages for all pets.
    """
    batches: list[tuple[list[int], list[Pet]]] = []
    for start in range(0, len(pets), BATCH_SIZE):
        chunk = pets[start: start + BATCH_SIZE]
        indices = list(range(start, start + len(chunk)))
        batches.append((indices, chunk))

    scores: dict[int, float] = {}
    llm_succeeded = False

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_to_indices = {
            pool.submit(_score_batch, user_query, chunk, settings): idxs
            for idxs, chunk in batches
        }
        for future in as_completed(future_to_indices):
            idxs = future_to_indices[future]
            try:
                batch_scores = future.result()
            except Exception as e:
                logger.error("Batch future failed", indices=idxs, error=str(e))
                batch_scores = None

            if batch_scores is not None:
                llm_succeeded = True
                for idx, score in zip(idxs, batch_scores):
                    scores[idx] = score
            else:
                # Mark these as needing fallback (use None sentinel)
                for idx in idxs:
                    scores[idx] = None

    # Fill in None entries with a fallback value
    # If LLM scored some but not all, use the average LLM score as fallback
    valid_scores = [s for s in scores.values() if s is not None]
    fallback = sum(valid_scores) / len(valid_scores) if valid_scores else 0.5
    for idx in scores:
        if scores[idx] is None:
            scores[idx] = fallback

    logger.info("Scoring complete", scored=len(scores), total_pets=len(pets), llm_succeeded=llm_succeeded)
    return scores, llm_succeeded


# ── Explanations ──────────────────────────────────────────────────────────────

def _explain_one(user_query: str, pet: Pet, settings) -> str:
    """Generate a 1-2 sentence explanation for a single pet. Never raises."""
    prompt = (
        f"Adopter wants: {user_query}\n\n"
        f"Pet details:\n{_pet_full(pet)}\n\n"
        f'Return: {{"explanation": "..."}}'
    )
    try:
        raw = _ollama_chat(EXPLAIN_SYSTEM, prompt, EXPLAIN_TIMEOUT, settings)
        data = _extract_json(raw)
        explanation = data.get("explanation", "")
        if explanation:
            return str(explanation).strip()
    except Exception as e:
        logger.warning("Explanation failed", pet=pet.name, error=str(e))
    # BUG FIX: Return pet-specific fallback instead of generic string
    return _pet_fallback_reasoning(pet)


def _explain_top_pets(
    user_query: str,
    top_pets: list[Pet],
    settings,
    explain_n: int = 10,  # BUG FIX: Was 3, now explains up to 10 pets by default
) -> dict[int, str]:
    """Explain the top N pets in parallel. Returns {list_index: explanation}."""
    to_explain = top_pets[:explain_n]
    results: dict[int, str] = {}

    with ThreadPoolExecutor(max_workers=min(len(to_explain), max(MAX_WORKERS, 2))) as pool:
        futures = {
            pool.submit(_explain_one, user_query, pet, settings): i
            for i, pet in enumerate(to_explain)
        }
        for future in as_completed(futures):
            i = futures[future]
            try:
                results[i] = future.result()
            except Exception:
                # BUG FIX: Pet-specific fallback instead of generic
                results[i] = _pet_fallback_reasoning(to_explain[i])

    # Fill remaining with pet-specific defaults (for any pets beyond explain_n)
    for i in range(len(top_pets)):
        if i not in results:
            results[i] = _pet_fallback_reasoning(top_pets[i])

    return results


# ── Agent loop ────────────────────────────────────────────────────────────────

def _agent_widen_search(
    query: MatchQuery,
    pet_repo: PetRepository,
    embedder,
    current_best_score: float,
    round_num: int,
) -> list[tuple[Pet, float]]:
    """
    Agentic retry: if top scores are weak, widen the candidate pool.
    Each round doubles the search space and drops the species filter.
    """
    multiplier = 2 ** round_num  # Round 1 -> 2x, Round 2 -> 4x
    new_top_k = query.max_results * 4 * multiplier

    logger.info(
        "Agent widening search",
        round=round_num,
        best_score=round(current_best_score, 3),
        new_top_k=new_top_k,
    )

    query_embedding = embedder.embed(query.query)
    candidates = pet_repo.vector_search(
        query_embedding=query_embedding,
        top_k=new_top_k,
        species_filter=None,  # Drop species filter on retry
    )
    return candidates


# ── Public entry point ────────────────────────────────────────────────────────

def match_pets(query: MatchQuery) -> MatchResponse:
    """
    Run the two-pass RAG matching pipeline with optional agentic retry.

    Pass 1 — SCORE: Small-batch parallel scoring, robust JSON parsing.
    Pass 2 — EXPLAIN: One-pet-at-a-time explanations for the top N.
    Agent   — If best score < LOW_CONFIDENCE_THRESHOLD, widen and rescore.
    """
    settings = get_settings()
    embedder = get_embedder()
    session_factory = get_session_factory()
    session = session_factory()
    pet_repo = PetRepository(session)

    try:
        # Step 1: Embed query
        logger.info("Embedding user query", query_length=len(query.query))
        query_embedding = embedder.embed(query.query)

        # Step 2: Vector search
        species_filter = query.species_filter.value if query.species_filter else None
        candidates = pet_repo.vector_search(
            query_embedding=query_embedding,
            top_k=query.max_results * 3,
            species_filter=species_filter,
        )

        if not candidates:
            return MatchResponse(
                query=query.query,
                results=[],
                reasoning_summary="No pets found matching your criteria. Try broadening your search.",
            )

        logger.info("Vector search returned candidates", count=len(candidates))

        pet_objects = [pet for pet, _ in candidates]
        similarity_scores = {i: score for i, (_, score) in enumerate(candidates)}

        # Step 3: Score all candidates in parallel batches
        logger.info("Starting parallel batch scoring", pet_count=len(pet_objects))
        relevance_scores, llm_scored = _score_all_pets(query.query, pet_objects, settings)

        # Step 4 (Agent): Widen search if confidence is low
        best_score = max(relevance_scores.values(), default=0.0)
        agent_round = 0

        while best_score < LOW_CONFIDENCE_THRESHOLD and agent_round < MAX_AGENT_ROUNDS:
            agent_round += 1
            logger.info(
                "Low confidence — agent widening search",
                best_score=round(best_score, 3),
                round=agent_round,
            )
            new_candidates = _agent_widen_search(
                query, pet_repo, embedder, best_score, agent_round
            )
            if not new_candidates:
                break

            # Deduplicate by pet id
            existing_ids = {p.id for p in pet_objects}
            new_pairs = [(p, s) for p, s in new_candidates if p.id not in existing_ids]
            if not new_pairs:
                break

            new_pet_objects = [p for p, _ in new_pairs]
            offset = len(pet_objects)

            new_rel_scores, new_llm_scored = _score_all_pets(query.query, new_pet_objects, settings)
            llm_scored = llm_scored or new_llm_scored

            pet_objects.extend(new_pet_objects)
            similarity_scores.update({offset + i: s for i, (_, s) in enumerate(new_pairs)})
            relevance_scores.update({offset + k: v for k, v in new_rel_scores.items()})

            best_score = max(relevance_scores.values(), default=0.0)
            logger.info("Agent round complete", new_best_score=round(best_score, 3))

        # Step 5: Rank and select top-N
        ranked_indices = sorted(
            range(len(pet_objects)),
            key=lambda i: relevance_scores.get(i, 0.0),
            reverse=True,
        )[: query.max_results]

        top_pets = [pet_objects[i] for i in ranked_indices]

        logger.info(
            "Ranking complete",
            top_n=len(top_pets),
            best_score=round(relevance_scores.get(ranked_indices[0], 0.0), 3) if ranked_indices else 0,
        )

        # Step 6: Explain ALL returned matches (not just top 3)
        # BUG FIX: Was only explaining top 3, now explains all returned pets
        explanations = _explain_top_pets(query.query, top_pets, settings, explain_n=len(top_pets))

        # Step 7: Build response
        # BUG FIX: Adjust blending weights based on whether LLM scoring worked.
        # If LLM scoring failed, lean heavily on vector similarity to preserve
        # score differentiation instead of showing identical percentages.
        if llm_scored:
            llm_weight, vec_weight = 0.7, 0.3
        else:
            llm_weight, vec_weight = 0.1, 0.9
            logger.info("LLM scoring failed — using vector similarity as primary ranking signal")

        results = []
        for list_pos, pet_idx in enumerate(ranked_indices):
            pet = pet_objects[pet_idx]
            llm_score = relevance_scores.get(pet_idx, 0.5)
            vec_score = similarity_scores.get(pet_idx, 0.0)
            blended = round(llm_weight * llm_score + vec_weight * vec_score, 4)

            explanation_text = explanations.get(list_pos, _pet_fallback_reasoning(pet))

            results.append(
                MatchResult(
                    pet=_pet_orm_to_schema(pet),
                    similarity_score=blended,
                    match_percentage=round(blended * 100),
                    explanation=explanation_text,
                    reasoning=explanation_text,
                )
            )

        agent_note = f" (agent widened search {agent_round}x)" if agent_round else ""
        scoring_note = "" if llm_scored else " Scores based primarily on profile similarity."
        reasoning_summary = (
            f"Found {len(results)} great match{'es' if len(results) != 1 else ''} "
            f"for your lifestyle{agent_note}.{scoring_note}"
        )

        return MatchResponse(
            query=query.query,
            results=results,
            reasoning_summary=reasoning_summary,
        )

    finally:
        session.close()