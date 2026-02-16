"""LLM extraction agent — uses raw Ollama API to pull structured pet data from Markdown.

The agent receives cleaned Markdown from Crawl4AI and returns validated PetSchema
objects. It uses Ollama (Llama 3.1 8B) as the local LLM backend.
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


# ── Direct Ollama API extraction ────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def extract_pets_ollama(
    markdown: str,
    page_url: str = "",
    shelter_name: str = "Unknown",
) -> list[PetSchema]:
    """Extract pet listings using Ollama's chat API directly with JSON mode.

    This is the primary method - PydanticAI doesn't have reliable Ollama support,
    so we use the raw API with schema validation.
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

    logger.info("Calling Ollama for extraction", url=page_url, model=settings.ollama_model)

    try:
        with httpx.Client(timeout=180.0) as client:
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
    except httpx.TimeoutException as e:
        logger.error("Ollama request timed out", url=page_url, error=str(e))
        raise
    except httpx.ConnectError as e:
        logger.error("Cannot connect to Ollama", base_url=settings.ollama_base_url, error=str(e))
        raise

    content = resp.json()["message"]["content"]

    # Parse the JSON response
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # Try to find JSON within the response
        import re
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group())
            except json.JSONDecodeError:
                logger.error("Could not parse extracted JSON", content=content[:500])
                return []
        else:
            logger.error("No JSON found in LLM output", content=content[:500])
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

    logger.info("Ollama extraction complete",
                 page_url=page_url, pets_found=len(pets))
    return pets


# ── Main extraction entry point ───────────────────────────────────────────────

def extract_pets(
    markdown: str,
    page_url: str = "",
    shelter_name: str = "Unknown",
) -> list[PetSchema]:
    """Extract pet listings from Markdown content.

    Uses Ollama directly with JSON mode for reliable extraction.
    """
    return extract_pets_ollama(markdown, page_url, shelter_name)