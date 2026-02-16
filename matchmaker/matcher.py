"""Stage 2: The Matchmaker — RAG-powered pet matching with ReAct reasoning.

Flow:
  1. User provides a natural-language query describing their lifestyle/preferences.
  2. Query is embedded and used for vector search (pgvector cosine similarity).
  3. Top-K candidate pets are retrieved.
  4. A ReAct-style LLM agent reasons over candidates vs. user preferences.
  5. Agent returns ranked results with personalised explanations.
"""

from __future__ import annotations

import json
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

# ── ReAct System Prompt ───────────────────────────────────────────────────────

MATCHMAKER_SYSTEM_PROMPT = """You are a pet adoption matchmaker AI. You help people find their 
perfect pet companion. You receive:
1. The adopter's lifestyle description and preferences.
2. A list of candidate pets found via semantic search.

Your job is to:
- Carefully analyze each candidate against the adopter's needs.
- Consider factors like: living space, activity level, experience with pets, 
  other animals in home, children, work schedule, and any stated preferences.
- Rank the TOP candidates (usually 3-5) from best to worst match.
- For EACH recommended pet, explain WHY it's a good match, referencing specific 
  traits from both the adopter's description and the pet's profile.
- Be honest about potential challenges or considerations.
- If a pet is a surprisingly good match despite apparent mismatches, explain why.

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "reasoning_summary": "Brief overview of your matching logic",
  "ranked_pets": [
    {
      "pet_index": 0,
      "score": 0.95,
      "explanation": "Why this pet is the best match..."
    }
  ]
}

pet_index refers to the 0-based index of the pet in the candidate list provided.
score is your confidence in the match (0.0 to 1.0).
"""


# ── Pet → text for LLM context ───────────────────────────────────────────────

def _pet_to_context(pet: Pet, index: int) -> str:
    """Format a Pet ORM object into readable text for the LLM."""
    lines = [f"[Pet {index}] {pet.name}"]
    lines.append(f"  Species: {pet.species}, Breed: {pet.breed}")
    lines.append(f"  Age: {pet.age_text}, Sex: {pet.sex}, Size: {pet.size}")
    if pet.weight_lbs:
        lines.append(f"  Weight: {pet.weight_lbs} lbs")
    lines.append(f"  Energy Level: {pet.energy_level}")
    if pet.good_with_dogs is not None:
        lines.append(f"  Good with dogs: {'Yes' if pet.good_with_dogs else 'No'}")
    if pet.good_with_cats is not None:
        lines.append(f"  Good with cats: {'Yes' if pet.good_with_cats else 'No'}")
    if pet.good_with_children is not None:
        lines.append(f"  Good with children: {'Yes' if pet.good_with_children else 'No'}")
    if pet.house_trained is not None:
        lines.append(f"  House trained: {'Yes' if pet.house_trained else 'No'}")
    if pet.special_needs:
        lines.append(f"  Special needs: {pet.special_needs}")
    if pet.personality_description:
        lines.append(f"  Personality: {pet.personality_description}")
    if pet.adoption_fee is not None:
        lines.append(f"  Adoption fee: ${pet.adoption_fee}")
    # Include shelter info
    if pet.shelter:
        lines.append(f"  Shelter: {pet.shelter.name}")
        if pet.shelter.location:
            lines.append(f"  Location: {pet.shelter.location}")
    return "\n".join(lines)


def _pet_orm_to_schema(pet: Pet) -> PetSchema:
    """Convert a Pet ORM object back to a PetSchema for the API response."""
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


# ── Core Matching Logic ──────────────────────────────────────────────────────

def match_pets(query: MatchQuery) -> MatchResponse:
    """Run the full RAG matching pipeline."""
    settings = get_settings()
    embedder = get_embedder()
    session_factory = get_session_factory()
    session = session_factory()
    pet_repo = PetRepository(session)

    try:
        # ── Step 1: Embed the user's query ────────────────────────────────
        logger.info("Embedding user query", query_length=len(query.query))
        query_embedding = embedder.embed(query.query)

        # ── Step 2: Vector search ─────────────────────────────────────────
        species_filter = query.species_filter.value if query.species_filter else None
        candidates = pet_repo.vector_search(
            query_embedding=query_embedding,
            top_k=query.max_results * 2,
            species_filter=species_filter,
        )

        if not candidates:
            logger.info("No candidates found via vector search")
            return MatchResponse(
                query=query.query,
                results=[],
                reasoning_summary="No pets found matching your criteria. Try broadening your search.",
            )

        logger.info("Vector search returned candidates", count=len(candidates))

        # ── Step 3: Build context for LLM ─────────────────────────────────
        pet_objects = [pet for pet, score in candidates]
        similarity_scores = {i: score for i, (pet, score) in enumerate(candidates)}

        context_parts = [_pet_to_context(pet, i) for i, pet in enumerate(pet_objects)]
        pets_context = "\n\n".join(context_parts)

        user_prompt = (
            f"ADOPTER'S DESCRIPTION:\n{query.query}\n\n"
            f"CANDIDATE PETS ({len(pet_objects)} found via semantic search):\n\n"
            f"{pets_context}\n\n"
            f"Please analyze these candidates and return your ranked recommendations as JSON."
        )

        # ── Step 4: LLM ReAct Reasoning ──────────────────────────────────
        logger.info("Sending candidates to LLM for reasoning")
        llm_response = _call_ollama_for_matching(user_prompt, settings)

        # ── Step 5: Parse LLM response and build results ──────────────────
        results = _parse_llm_match_response(
            llm_response, pet_objects, similarity_scores
        )

        results = results[:query.max_results]

        reasoning_summary = None
        if isinstance(llm_response, dict):
            reasoning_summary = llm_response.get("reasoning_summary")

        return MatchResponse(
            query=query.query,
            results=results,
            reasoning_summary=reasoning_summary,
        )

    finally:
        session.close()


def _call_ollama_for_matching(user_prompt: str, settings) -> dict:
    """Call Ollama for the matching/reasoning step."""
    try:
        with httpx.Client(timeout=180.0) as client:
            resp = client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_model,
                    "messages": [
                        {"role": "system", "content": MATCHMAKER_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "format": "json",
                    "stream": False,
                },
            )
            resp.raise_for_status()
            content = resp.json()["message"]["content"]
            return json.loads(content)

    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON for matching, using raw text")
        return {"reasoning_summary": content, "ranked_pets": []}
    except Exception as e:
        logger.error("LLM matching call failed", error=str(e))
        return {"reasoning_summary": f"LLM reasoning unavailable: {e}", "ranked_pets": []}


def _parse_llm_match_response(
    llm_response: dict,
    pet_objects: list[Pet],
    similarity_scores: dict[int, float],
) -> list[MatchResult]:
    """Parse the LLM's ranked response into MatchResult objects."""
    results = []

    ranked = llm_response.get("ranked_pets", [])
    if not ranked:
        logger.info("No LLM ranking available, falling back to vector similarity order")
        for i, pet in enumerate(pet_objects):
            results.append(MatchResult(
                pet=_pet_orm_to_schema(pet),
                similarity_score=similarity_scores.get(i, 0.0),
                explanation=None,
            ))
        return results

    for entry in ranked:
        idx = entry.get("pet_index", -1)
        if 0 <= idx < len(pet_objects):
            pet = pet_objects[idx]
            llm_score = float(entry.get("score", 0.5))
            vec_score = similarity_scores.get(idx, 0.0)
            blended_score = 0.6 * llm_score + 0.4 * vec_score

            results.append(MatchResult(
                pet=_pet_orm_to_schema(pet),
                similarity_score=round(blended_score, 4),
                explanation=entry.get("explanation", ""),
            ))

    return sorted(results, key=lambda r: r.similarity_score, reverse=True)