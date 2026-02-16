"""FastAPI application — REST API for pet ingestion and matching.

Endpoints:
  POST /ingest       — Start a crawl + extraction job for a shelter
  GET  /ingest/{id}  — Check job status
  POST /match        — Find matching pets for an adopter query
  GET  /pets         — List all pets (with optional filters)
  GET  /pets/{id}    — Get a single pet by ID
  GET  /shelters     — List registered shelters
  GET  /stats        — Database statistics
  GET  /health       — Health check
"""

from __future__ import annotations

import asyncio
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query
from fastapi.middleware.cors import CORSMiddleware

from config.settings import get_settings
from db.models import get_engine, get_session_factory, init_db, Pet, Shelter, CrawlJob
from db.repository import PetRepository, ShelterRepository
from ingestion.pipeline import run_ingestion_pipeline
from matchmaker.matcher import match_pets
from models.schemas import (
    CrawlJobRequest,
    CrawlJobResponse,
    CrawlJobStatus,
    MatchQuery,
    MatchResponse,
    PetSchema,
    Species,
)

logger = structlog.get_logger(__name__)

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    logger.info("Initializing database...")
    try:
        engine = get_engine()
        init_db(engine)
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error("Database initialization failed", error=str(e))
        logger.warning("App will start but DB operations will fail until PostgreSQL is available")
    yield
    logger.info("Shutting down...")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Pet Adoption Platform API",
    description="Agentic AI-powered pet adoption matching engine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Dependencies ──────────────────────────────────────────────────────────────

def get_db_session():
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "pet-adoption-platform"}


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/stats")
async def get_stats(session=Depends(get_db_session)):
    pet_repo = PetRepository(session)
    shelter_repo = ShelterRepository(session)
    return {
        "total_pets": pet_repo.count(),
        "dogs": pet_repo.count("dog"),
        "cats": pet_repo.count("cat"),
        "total_shelters": len(shelter_repo.list_all()),
    }


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 1: INGESTION ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/ingest", response_model=CrawlJobResponse)
async def start_ingestion(
    request: CrawlJobRequest,
    background_tasks: BackgroundTasks,
    session=Depends(get_db_session),
):
    """Start a new crawl + extraction job for a shelter website.

    The job runs in the background. Use GET /ingest/{job_id} to check status.
    """
    shelter_repo = ShelterRepository(session)
    shelter = shelter_repo.get_or_create(
        website_url=request.shelter_url,
        name=request.shelter_name,
    )

    # Create the job record
    job = CrawlJob(
        id=uuid.uuid4(),
        shelter_id=shelter.id,
        status="pending",
    )
    session.add(job)
    session.commit()

    job_id = str(job.id)

    # Run pipeline in background — use a sync wrapper so Starlette's
    # threadpool executor can run it without needing an existing event loop.
    def _run_sync():
        try:
            asyncio.run(
                run_ingestion_pipeline(
                    shelter_url=request.shelter_url,
                    shelter_name=request.shelter_name,
                    max_depth=request.max_depth,
                    max_pages=request.max_pages,
                )
            )
        except Exception as e:
            logger.error("Background ingestion failed", job_id=job_id, error=str(e))

    background_tasks.add_task(_run_sync)

    return CrawlJobResponse(
        job_id=job_id,
        status=CrawlJobStatus.PENDING,
        shelter_url=request.shelter_url,
    )


@app.get("/ingest/{job_id}", response_model=CrawlJobResponse)
async def get_ingestion_status(job_id: str, session=Depends(get_db_session)):
    """Check the status of a crawl job."""
    try:
        uid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    job = session.get(CrawlJob, uid)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    shelter = session.get(Shelter, job.shelter_id)
    return CrawlJobResponse(
        job_id=str(job.id),
        status=CrawlJobStatus(job.status),
        shelter_url=shelter.website_url if shelter else "",
        pages_crawled=job.pages_crawled or 0,
        pets_extracted=job.pets_extracted or 0,
        errors=job.errors or [],
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 2: MATCHING / QUERY ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/match", response_model=MatchResponse)
async def find_matches(query: MatchQuery):
    """Find matching pets based on adopter's lifestyle description.

    This is the core Stage 2 endpoint. It:
    1. Embeds the query using the configured embedding model.
    2. Performs vector similarity search against all stored pets.
    3. Sends top candidates to the LLM for ReAct reasoning.
    4. Returns ranked results with personalised explanations.
    """
    try:
        return match_pets(query)
    except Exception as e:
        logger.error("Match failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(e)}")


# ── Browse / Filter Pets ──────────────────────────────────────────────────────

@app.get("/pets")
async def list_pets(
    species: Optional[str] = Query(None, description="Filter by species"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session=Depends(get_db_session),
):
    """List pets with optional species filter."""
    pet_repo = PetRepository(session)
    pets = pet_repo.list_pets(species=species, limit=limit, offset=offset)
    return {
        "count": len(pets),
        "pets": [
            {
                "id": str(p.id),
                "name": p.name,
                "species": p.species,
                "breed": p.breed,
                "age_text": p.age_text,
                "sex": p.sex,
                "size": p.size,
                "energy_level": p.energy_level,
                "personality_description": p.personality_description,
                "shelter_name": p.shelter.name if p.shelter else None,
                "listing_url": p.listing_url,
                "image_urls": p.image_urls or [],
            }
            for p in pets
        ],
    }


@app.get("/pets/{pet_id}")
async def get_pet(pet_id: str, session=Depends(get_db_session)):
    """Get a single pet by ID."""
    try:
        uid = uuid.UUID(pet_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid pet ID format")

    pet_repo = PetRepository(session)
    pet = pet_repo.get_by_id(uid)
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    return {
        "id": str(pet.id),
        "name": pet.name,
        "species": pet.species,
        "breed": pet.breed,
        "age_text": pet.age_text,
        "age_months": pet.age_months,
        "sex": pet.sex,
        "size": pet.size,
        "weight_lbs": pet.weight_lbs,
        "color": pet.color,
        "energy_level": pet.energy_level,
        "good_with_dogs": pet.good_with_dogs,
        "good_with_cats": pet.good_with_cats,
        "good_with_children": pet.good_with_children,
        "house_trained": pet.house_trained,
        "special_needs": pet.special_needs,
        "personality_description": pet.personality_description,
        "adoption_fee": pet.adoption_fee,
        "is_neutered": pet.is_neutered,
        "listing_url": pet.listing_url,
        "image_urls": pet.image_urls or [],
        "shelter": {
            "name": pet.shelter.name,
            "location": pet.shelter.location,
            "contact": pet.shelter.contact_info,
            "website": pet.shelter.website_url,
        } if pet.shelter else None,
    }


@app.get("/shelters")
async def list_shelters(session=Depends(get_db_session)):
    """List all registered shelters."""
    repo = ShelterRepository(session)
    shelters = repo.list_all()
    return {
        "count": len(shelters),
        "shelters": [
            {
                "id": str(s.id),
                "name": s.name,
                "website_url": s.website_url,
                "location": s.location,
                "pet_count": len(s.pets) if s.pets else 0,
            }
            for s in shelters
        ],
    }