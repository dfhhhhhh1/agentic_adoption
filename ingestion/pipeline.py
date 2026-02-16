"""Ingestion pipeline — orchestrates crawl → extract → embed → store.

This is the main entry point for Stage 1.  It coordinates:
  1. Crawl4AI spider crawls a shelter website
  2. LLM agent extracts structured pet data from each page
  3. Embedder generates vectors for each pet's text profile
  4. Repository persists everything to PostgreSQL + pgvector
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

import structlog

from config.settings import get_settings
from db.models import get_session_factory, CrawlJob
from db.repository import PetRepository, ShelterRepository
from ingestion.crawler import crawl_shelter
from ingestion.extractor import extract_pets
from ingestion.embeddings import get_embedder
from models.schemas import PetSchema, CrawlJobStatus

logger = structlog.get_logger(__name__)


async def run_ingestion_pipeline(
    shelter_url: str,
    shelter_name: str | None = None,
    max_depth: int | None = None,
    max_pages: int | None = None,
) -> dict:
    """Run the full ingestion pipeline for a single shelter.

    Returns a summary dict with job stats.
    """
    settings = get_settings()
    session_factory = get_session_factory()
    session = session_factory()
    embedder = get_embedder()

    shelter_repo = ShelterRepository(session)
    pet_repo = PetRepository(session)

    # ── 1. Register the shelter ───────────────────────────────────────────
    shelter = shelter_repo.get_or_create(
        website_url=shelter_url,
        name=shelter_name or shelter_url,
    )
    logger.info("Shelter registered", shelter_id=str(shelter.id), name=shelter.name)

    # ── 2. Create crawl job record ────────────────────────────────────────
    job = CrawlJob(
        id=uuid.uuid4(),
        shelter_id=shelter.id,
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    session.add(job)
    session.commit()

    all_pets: list[PetSchema] = []
    errors: list[str] = []

    try:
        # ── 3. Crawl the shelter website ──────────────────────────────────
        logger.info("Starting crawl phase", url=shelter_url)
        pages = await crawl_shelter(
            shelter_url,
            max_depth=max_depth,
            max_pages=max_pages,
        )
        job.pages_crawled = len(pages)
        session.commit()

        logger.info("Crawl phase complete", pages_found=len(pages))

        # ── 4. Extract pet data from each page ───────────────────────────
        logger.info("Starting extraction phase")
        for page in pages:
            try:
                pets = extract_pets(
                    markdown=page.markdown,
                    page_url=page.url,
                    shelter_name=shelter.name,
                )
                all_pets.extend(pets)
                logger.info("Extracted pets from page",
                           url=page.url, count=len(pets))
            except Exception as e:
                error_msg = f"Extraction failed for {page.url}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)

        logger.info("Extraction phase complete", total_pets=len(all_pets))

        # ── 5. Generate embeddings ────────────────────────────────────────
        if all_pets:
            logger.info("Generating embeddings", count=len(all_pets))

            # Build text representations for embedding
            texts = []
            for pet in all_pets:
                text_parts = [
                    f"{pet.name} is a {pet.age_text} {pet.sex.value} {pet.breed} ({pet.species.value}).",
                    f"Size: {pet.size.value}. Energy level: {pet.energy_level.value}.",
                ]
                if pet.personality_description:
                    text_parts.append(pet.personality_description)
                if pet.good_with_dogs is not None:
                    text_parts.append(f"Good with dogs: {'yes' if pet.good_with_dogs else 'no'}.")
                if pet.good_with_cats is not None:
                    text_parts.append(f"Good with cats: {'yes' if pet.good_with_cats else 'no'}.")
                if pet.good_with_children is not None:
                    text_parts.append(f"Good with children: {'yes' if pet.good_with_children else 'no'}.")
                if pet.special_needs:
                    text_parts.append(f"Special needs: {pet.special_needs}")
                texts.append(" ".join(text_parts))

            try:
                embeddings = embedder.embed_batch(texts)
            except Exception as e:
                logger.error("Batch embedding failed, trying one by one", error=str(e))
                embeddings = []
                for text in texts:
                    try:
                        embeddings.append(embedder.embed(text))
                    except Exception as e2:
                        logger.error("Single embedding failed", error=str(e2))
                        embeddings.append(None)

            # ── 6. Persist to database ────────────────────────────────────
            logger.info("Storing pets in database")
            stored = pet_repo.bulk_upsert(
                pets=all_pets,
                shelter_id=shelter.id,
                embeddings=embeddings,
            )
            job.pets_extracted = len(stored)
        else:
            job.pets_extracted = 0

        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.errors = errors

    except Exception as e:
        logger.error("Pipeline failed", error=str(e))
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        job.errors = errors + [str(e)]
        raise
    finally:
        session.commit()
        session.close()

    summary = {
        "job_id": str(job.id),
        "shelter": shelter.name,
        "status": job.status,
        "pages_crawled": job.pages_crawled,
        "pets_extracted": job.pets_extracted,
        "errors": job.errors,
    }
    logger.info("Pipeline complete", **summary)
    return summary


def run_ingestion_sync(
    shelter_url: str,
    shelter_name: str | None = None,
    max_depth: int | None = None,
    max_pages: int | None = None,
) -> dict:
    """Synchronous entry point for the ingestion pipeline."""
    return asyncio.run(
        run_ingestion_pipeline(shelter_url, shelter_name, max_depth, max_pages)
    )
