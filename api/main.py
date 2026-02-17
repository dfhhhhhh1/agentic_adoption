"""FastAPI application — REST API for pet ingestion and matching.

Endpoints:
  POST /ingest           — Start a crawl + extraction job for a shelter
  GET  /ingest/{id}      — Check job status
  POST /import/json      — Import pets from a JSON file
  POST /match            — Find matching pets for an adopter query
  GET  /pets             — List all pets (with optional filters)
  GET  /pets/{id}        — Get a single pet by ID
  GET  /shelters         — List registered shelters
  GET  /stats            — Database statistics
  GET  /health           — Health check
"""

from __future__ import annotations

import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config.settings import get_settings
from db.models import get_engine, get_session_factory, init_db, Pet, Shelter, CrawlJob
from db.repository import PetRepository, ShelterRepository
from ingestion.pipeline import run_ingestion_pipeline
from matchmaker.matcher import match_pets
from models.schemas import (
    CrawlJobRequest,
    CrawlJobResponse,
    CrawlJobStatus,
    JsonImportRequest,
    JsonImportResponse,
    MatchQuery,
    MatchResponse,
    PetSchema,
    Species,
)
from api.ask_router import router as ask_router

logger = structlog.get_logger(__name__)


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


app = FastAPI(
    title="Pet Adoption Platform API",
    description="Agentic AI-powered pet adoption matching engine",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ask_router)


# ── Static file serving for pet images ────────────────────────────────────────
# The DB stores image_path values like "/images/A755074.jpeg".
# This mount serves the local ./images directory so the frontend can load:
#   http://localhost:8000/images/A755074.jpeg
#
# Resolution order: cwd/images → project_root/images
_project_root = Path(__file__).resolve().parent.parent
for _candidate in [Path("images"), _project_root / "images"]:
    if _candidate.is_dir():
        app.mount("/images", StaticFiles(directory=str(_candidate)), name="pet-images")
        logger.info("Mounted /images static directory", path=str(_candidate))
        break
else:
    logger.warning("No images directory found — pet photos will not be served")


def get_db_session():
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "pet-adoption-platform"}


@app.get("/stats")
async def get_stats(session=Depends(get_db_session)):
    pet_repo = PetRepository(session)
    shelter_repo = ShelterRepository(session)
    return {
        "total_pets": pet_repo.count(),
        "dogs": pet_repo.count("dog"),
        "cats": pet_repo.count("cat"),
        "rabbits": pet_repo.count("rabbit"),
        "small_animals": pet_repo.count("small_animal"),
        "reptiles": pet_repo.count("reptile"),
        "other": pet_repo.count("other"),
        "total_shelters": len(shelter_repo.list_all()),
    }


@app.post("/ingest", response_model=CrawlJobResponse)
async def start_ingestion(request: CrawlJobRequest, background_tasks: BackgroundTasks, session=Depends(get_db_session)):
    shelter_repo = ShelterRepository(session)
    shelter = shelter_repo.get_or_create(website_url=request.shelter_url, name=request.shelter_name)
    job = CrawlJob(id=uuid.uuid4(), shelter_id=shelter.id, status="pending")
    session.add(job)
    session.commit()
    job_id = str(job.id)

    def _run_sync():
        try:
            asyncio.run(run_ingestion_pipeline(
                shelter_url=request.shelter_url, shelter_name=request.shelter_name,
                max_depth=request.max_depth, max_pages=request.max_pages,
            ))
        except Exception as e:
            logger.error("Background ingestion failed", job_id=job_id, error=str(e))

    background_tasks.add_task(_run_sync)
    return CrawlJobResponse(job_id=job_id, status=CrawlJobStatus.PENDING, shelter_url=request.shelter_url)


@app.get("/ingest/{job_id}", response_model=CrawlJobResponse)
async def get_ingestion_status(job_id: str, session=Depends(get_db_session)):
    try:
        uid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")
    job = session.get(CrawlJob, uid)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    shelter = session.get(Shelter, job.shelter_id)
    return CrawlJobResponse(
        job_id=str(job.id), status=CrawlJobStatus(job.status),
        shelter_url=shelter.website_url if shelter else "",
        pages_crawled=job.pages_crawled or 0, pets_extracted=job.pets_extracted or 0,
        errors=job.errors or [], started_at=job.started_at, completed_at=job.completed_at,
    )


@app.post("/import/json", response_model=JsonImportResponse)
async def import_from_json(request: JsonImportRequest, background_tasks: BackgroundTasks, session=Depends(get_db_session)):
    filepath = Path(request.file_path)
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")
    try:
        from scripts.load_json import load_json_file, convert_json_entry
        raw_entries = load_json_file(str(filepath))
        shelter_repo = ShelterRepository(session)
        pet_repo = PetRepository(session)
        pets_loaded = 0; pets_skipped = 0; shelters_created_set = set(); errors = []

        for entry in raw_entries:
            converted = convert_json_entry(entry, request.images_base_path)
            if not converted:
                pets_skipped += 1; continue
            try:
                sname = converted["shelter_name"]
                shelter = shelter_repo.get_or_create(
                    website_url=f"https://placeholder.local/{sname.lower().replace(' ', '-')}",
                    name=sname, location=converted.get("shelter_location"),
                )
                if converted.get("shelter_lat") and converted.get("shelter_long"):
                    shelter.latitude = converted["shelter_lat"]
                    shelter.longitude = converted["shelter_long"]
                shelters_created_set.add(sname)
                pet_schema = PetSchema(
                    name=converted["name"], species=converted["species"], breed=converted["breed"],
                    age_text=converted["age_text"], age_months=converted["age_months"],
                    sex=converted["sex"], size=converted["size"], weight_lbs=converted["weight_lbs"],
                    color=converted["color"], energy_level=converted["energy_level"],
                    good_with_dogs=converted["good_with_dogs"], good_with_cats=converted["good_with_cats"],
                    good_with_children=converted["good_with_children"], house_trained=converted["house_trained"],
                    special_needs=converted["special_needs"],
                    personality_description=converted["personality_description"],
                    adoption_fee=converted["adoption_fee"], is_neutered=converted["is_neutered"],
                    shelter_name=converted["shelter_name"], shelter_location=converted["shelter_location"],
                    listing_url=converted["listing_url"], image_urls=converted["image_urls"],
                    image_path=converted.get("image_path"), external_id=converted.get("external_id"),
                    intake_date=converted.get("intake_date"),
                )
                raw_json = {**converted, "species": converted["species"].value,
                            "sex": converted["sex"].value, "size": converted["size"].value,
                            "energy_level": converted["energy_level"].value}
                pet = pet_repo.upsert_pet(pet_data=pet_schema, shelter_id=shelter.id, raw_json=raw_json)
                pet.external_id = converted.get("external_id", "")
                pet.intake_date_str = converted.get("intake_date", "")
                pet.image_path = converted.get("image_path", "")
                pet.source = "json"
                pets_loaded += 1
            except Exception as e:
                errors.append(f"Failed to load {entry.get('name', '?')}: {str(e)}")
                pets_skipped += 1

        session.commit()
        if request.generate_embeddings and pets_loaded > 0:
            def _embed():
                try:
                    from ingestion.embeddings import get_embedder
                    embedder = get_embedder()
                    s = get_session_factory()()
                    pets = s.query(Pet).filter(Pet.embedding.is_(None), Pet.source == "json").all()
                    for p in pets:
                        p.embedding = embedder.embed(p.to_text_for_embedding())
                    s.commit(); s.close()
                except Exception as e:
                    logger.error("Background embedding failed", error=str(e))
            background_tasks.add_task(_embed)
        return JsonImportResponse(pets_loaded=pets_loaded, pets_skipped=pets_skipped,
                                  shelters_created=len(shelters_created_set), errors=errors)
    except Exception as e:
        logger.error("JSON import failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@app.post("/match", response_model=MatchResponse)
async def find_matches(query: MatchQuery):
    try:
        return match_pets(query)
    except Exception as e:
        logger.error("Match failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(e)}")


@app.get("/pets")
async def list_pets(species: Optional[str] = Query(None), limit: int = Query(50, ge=1, le=200),
                    offset: int = Query(0, ge=0), session=Depends(get_db_session)):
    pet_repo = PetRepository(session)
    pets = pet_repo.list_pets(species=species, limit=limit, offset=offset)
    return {"count": len(pets), "pets": [_pet_to_dict(p) for p in pets]}


@app.get("/pets/{pet_id}")
async def get_pet(pet_id: str, session=Depends(get_db_session)):
    try:
        uid = uuid.UUID(pet_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid pet ID format")
    pet_repo = PetRepository(session)
    pet = pet_repo.get_by_id(uid)
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    return _pet_to_dict_full(pet)


@app.get("/shelters")
async def list_shelters(session=Depends(get_db_session)):
    repo = ShelterRepository(session)
    shelters = repo.list_all()
    return {"count": len(shelters), "shelters": [
        {"id": str(s.id), "name": s.name, "website_url": s.website_url,
         "location": s.location, "latitude": s.latitude, "longitude": s.longitude,
         "pet_count": len(s.pets) if s.pets else 0}
        for s in shelters
    ]}


def _pet_to_dict(p: Pet) -> dict:
    return {
        "id": str(p.id), "external_id": p.external_id, "name": p.name,
        "species": p.species, "breed": p.breed, "age_text": p.age_text,
        "sex": p.sex, "size": p.size, "weight_lbs": p.weight_lbs,
        "energy_level": p.energy_level, "personality_description": p.personality_description,
        "adoption_fee": p.adoption_fee,
        "shelter_name": p.shelter.name if p.shelter else None,
        "listing_url": p.listing_url, "image_urls": p.image_urls or [],
        "image_path": p.image_path,
    }


def _pet_to_dict_full(pet: Pet) -> dict:
    return {
        "id": str(pet.id), "external_id": pet.external_id, "name": pet.name,
        "species": pet.species, "breed": pet.breed, "age_text": pet.age_text,
        "age_months": pet.age_months, "sex": pet.sex, "size": pet.size,
        "weight_lbs": pet.weight_lbs, "color": pet.color,
        "energy_level": pet.energy_level,
        "good_with_dogs": pet.good_with_dogs, "good_with_cats": pet.good_with_cats,
        "good_with_children": pet.good_with_children, "house_trained": pet.house_trained,
        "special_needs": pet.special_needs,
        "personality_description": pet.personality_description,
        "adoption_fee": pet.adoption_fee, "is_neutered": pet.is_neutered,
        "listing_url": pet.listing_url, "image_urls": pet.image_urls or [],
        "image_path": pet.image_path, "intake_date": pet.intake_date_str,
        "source": pet.source,
        "shelter": {
            "name": pet.shelter.name, "location": pet.shelter.location,
            "latitude": pet.shelter.latitude, "longitude": pet.shelter.longitude,
            "contact": pet.shelter.contact_info, "website": pet.shelter.website_url,
        } if pet.shelter else None,
    }