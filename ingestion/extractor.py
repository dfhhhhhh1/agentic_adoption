"""LLM extraction agent — uses PydanticAI to pull structured pet data from Markdown.

The agent receives cleaned Markdown from Crawl4AI and returns validated PetSchema
objects.  It uses Ollama (Llama 3.1 8B) as the local LLM backend.
PydanticAI handles schema validation and automatic retries on malformed output.
"""

from __future__ import annotations

import json
from typing import Optional

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from config.settings import get_settings
from models.schemas import PetSchema, PetListingBatch

logger = structlog.get_logger(__name__)

# ── System prompt for the extraction agent ────────────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """You are a pet data extraction agent. Your job is to read Markdown 
content from animal shelter websites and extract structured pet listing data.

RULES:
1. Extract EVERY pet you can find on the page.
2. If a field is not mentioned, use the default/null value — do NOT invent data.
3. For age_months, estimate from text: "puppy" ≈ 4, "young" ≈ 12, "adult" ≈ 36, "senior" ≈ 96.
4. For energy_level, infer from descriptors: "couch potato/calm/lazy" → low, 
   "playful/active" → medium, "high-energy/needs lots of exercise" → high.
5. Return valid JSON matching the schema exactly.
6. If the page has NO pet listings (e.g. it's an about page or donation page), 
   return {"pets": []}.
"""


# ── PydanticAI-based extraction (preferred) ───────────────────────────────────

def extract_pets_pydantic_ai(
    markdown: str,
    page_url: str = "",
    shelter_name: str = "Unknown",
) -> list[PetSchema]:
    """Extract pet listings using PydanticAI for schema-validated output.

    PydanticAI will automatically retry if the LLM output doesn't match
    the PetListingBatch schema.
    """
    try:
        from pydantic_ai import Agent

        settings = get_settings()

        agent = Agent(
            model=f"ollama:{settings.ollama_model}",
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            result_type=PetListingBatch,
            retries=3,
        )

        user_prompt = (
            f"Extract all pet listings from this shelter page.\n"
            f"Shelter: {shelter_name}\n"
            f"URL: {page_url}\n\n"
            f"--- PAGE CONTENT ---\n{markdown[:8000]}\n--- END ---"
        )

        result = agent.run_sync(user_prompt)
        pets = result.data.pets

        # Backfill shelter info + URL on each pet
        for pet in pets:
            if not pet.shelter_name or pet.shelter_name == "Unknown":
                pet.shelter_name = shelter_name
            if not pet.listing_url:
                pet.listing_url = page_url

        logger.info("PydanticAI extraction complete",
                     page_url=page_url, pets_found=len(pets))
        return pets

    except ImportError:
        logger.warning("PydanticAI not available, falling back to raw Ollama extraction")
        return extract_pets_ollama_raw(markdown, page_url, shelter_name)
    except Exception as e:
        logger.error("PydanticAI extraction failed", error=str(e), page_url=page_url)
        return extract_pets_ollama_raw(markdown, page_url, shelter_name)


# ── Fallback: Direct Ollama API extraction ────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def extract_pets_ollama_raw(
    markdown: str,
    page_url: str = "",
    shelter_name: str = "Unknown",
) -> list[PetSchema]:
    """Fallback extraction using Ollama's chat API directly with JSON mode.

    Useful if PydanticAI is not installed or has compatibility issues.
    """
    settings = get_settings()

    schema_example = PetSchema.model_json_schema()

    user_prompt = (
        f"Extract all pet listings from this shelter page as JSON.\n"
        f"Shelter: {shelter_name}\n"
        f"URL: {page_url}\n\n"
        f"Return a JSON object with a 'pets' array. Each pet must match this schema:\n"
        f"{json.dumps(schema_example, indent=2)}\n\n"
        f"--- PAGE CONTENT ---\n{markdown[:8000]}\n--- END ---\n\n"
        f"Return ONLY valid JSON, no explanations."
    )

    with httpx.Client(timeout=120.0) as client:
        resp = client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_model,
                "messages": [
                    {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "format": "json",
                "stream": False,
            },
        )
        resp.raise_for_status()

    content = resp.json()["message"]["content"]

    # Parse the JSON response
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # Try to find JSON within the response
        import re
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
        else:
            logger.error("Could not parse LLM output as JSON", content=content[:500])
            return []

    # Validate each pet through Pydantic
    raw_pets = data.get("pets", [])
    if not raw_pets and isinstance(data, dict) and "name" in data:
        raw_pets = [data]  # Single pet returned without wrapper

    pets = []
    for raw in raw_pets:
        try:
            pet = PetSchema.model_validate(raw)
            if not pet.shelter_name or pet.shelter_name == "Unknown":
                pet.shelter_name = shelter_name
            if not pet.listing_url:
                pet.listing_url = page_url
            pets.append(pet)
        except Exception as e:
            logger.warning("Failed to validate pet record", error=str(e), raw=raw)

    logger.info("Ollama raw extraction complete",
                 page_url=page_url, pets_found=len(pets))
    return pets


# ── Main extraction entry point ───────────────────────────────────────────────

def extract_pets(
    markdown: str,
    page_url: str = "",
    shelter_name: str = "Unknown",
) -> list[PetSchema]:
    """Extract pet listings from Markdown content.

    Tries PydanticAI first, falls back to raw Ollama if needed.
    """
    return extract_pets_pydantic_ai(markdown, page_url, shelter_name)
