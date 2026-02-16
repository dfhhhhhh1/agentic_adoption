"""Repository pattern for Pet CRUD + vector search operations."""

from __future__ import annotations

import uuid
from typing import Optional

import numpy as np
from pgvector.sqlalchemy import Vector
from sqlalchemy import select, text, func
from sqlalchemy.orm import Session

from db.models import Pet, Shelter, CrawlJob
from models.schemas import PetSchema


class PetRepository:
    """Handles all pet-related database operations."""

    def __init__(self, session: Session):
        self.session = session

    # ── Write operations ──────────────────────────────────────────────────

    def upsert_pet(self, pet_data: PetSchema, shelter_id: uuid.UUID,
                   embedding: list[float] | None = None,
                   raw_json: dict | None = None) -> Pet:
        """Insert or update a pet record.  Dedup by (shelter_id, name, breed)."""
        existing = (
            self.session.query(Pet)
            .filter(
                Pet.shelter_id == shelter_id,
                Pet.name == pet_data.name,
                Pet.breed == pet_data.breed,
            )
            .first()
        )

        if existing:
            pet = existing
        else:
            pet = Pet(id=uuid.uuid4(), shelter_id=shelter_id)

        # Map schema fields to ORM
        pet.name = pet_data.name
        pet.species = pet_data.species.value if hasattr(pet_data.species, 'value') else pet_data.species
        pet.breed = pet_data.breed
        pet.age_text = pet_data.age_text
        pet.age_months = pet_data.age_months
        pet.sex = pet_data.sex.value if hasattr(pet_data.sex, 'value') else pet_data.sex
        pet.size = pet_data.size.value if hasattr(pet_data.size, 'value') else pet_data.size
        pet.weight_lbs = pet_data.weight_lbs
        pet.color = pet_data.color
        pet.energy_level = pet_data.energy_level.value if hasattr(pet_data.energy_level, 'value') else pet_data.energy_level
        pet.good_with_dogs = pet_data.good_with_dogs
        pet.good_with_cats = pet_data.good_with_cats
        pet.good_with_children = pet_data.good_with_children
        pet.house_trained = pet_data.house_trained
        pet.special_needs = pet_data.special_needs
        pet.personality_description = pet_data.personality_description
        pet.adoption_fee = pet_data.adoption_fee
        pet.is_neutered = pet_data.is_neutered
        pet.listing_url = pet_data.listing_url
        pet.image_urls = pet_data.image_urls

        # New fields
        if pet_data.image_path is not None:
            pet.image_path = pet_data.image_path
        if pet_data.external_id is not None:
            pet.external_id = pet_data.external_id
        if pet_data.intake_date is not None:
            pet.intake_date_str = pet_data.intake_date

        if embedding is not None:
            pet.embedding = embedding
        if raw_json is not None:
            pet.raw_extracted_json = raw_json

        self.session.add(pet)
        return pet

    def bulk_upsert(self, pets: list[PetSchema], shelter_id: uuid.UUID,
                    embeddings: list[list[float]] | None = None) -> list[Pet]:
        """Upsert multiple pets in a single transaction."""
        results = []
        for i, pet_data in enumerate(pets):
            emb = embeddings[i] if embeddings and i < len(embeddings) else None
            raw = pet_data.model_dump(mode="json")
            pet = self.upsert_pet(pet_data, shelter_id, embedding=emb, raw_json=raw)
            results.append(pet)
        self.session.commit()
        return results

    # ── Read operations ───────────────────────────────────────────────────

    def get_by_id(self, pet_id: uuid.UUID) -> Pet | None:
        return self.session.get(Pet, pet_id)

    def get_by_external_id(self, external_id: str) -> Pet | None:
        """Find a pet by its source-system ID (e.g. CMHS-A-46003)."""
        return (
            self.session.query(Pet)
            .filter(Pet.external_id == external_id)
            .first()
        )

    def list_pets(self, species: str | None = None, limit: int = 50,
                  offset: int = 0) -> list[Pet]:
        q = self.session.query(Pet)
        if species:
            q = q.filter(Pet.species == species)
        return q.order_by(Pet.created_at.desc()).offset(offset).limit(limit).all()

    # ── Vector search ─────────────────────────────────────────────────────

    def vector_search(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        species_filter: str | None = None,
    ) -> list[tuple[Pet, float]]:
        """Find nearest pets by cosine similarity."""
        distance_expr = Pet.embedding.cosine_distance(query_embedding)
        similarity_expr = (1 - distance_expr).label("similarity")

        q = (
            self.session.query(Pet, similarity_expr)
            .filter(Pet.embedding.isnot(None))
        )

        if species_filter:
            q = q.filter(Pet.species == species_filter)

        results = (
            q.order_by(distance_expr)
            .limit(top_k)
            .all()
        )

        return [(pet, float(sim)) for pet, sim in results]

    # ── Stats ─────────────────────────────────────────────────────────────

    def count(self, species: str | None = None) -> int:
        q = self.session.query(func.count(Pet.id))
        if species:
            q = q.filter(Pet.species == species)
        return q.scalar()


class ShelterRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_or_create(self, website_url: str, name: str | None = None,
                      location: str | None = None) -> Shelter:
        existing = (
            self.session.query(Shelter)
            .filter(Shelter.website_url == website_url)
            .first()
        )
        if existing:
            return existing

        shelter = Shelter(
            id=uuid.uuid4(),
            name=name or website_url,
            website_url=website_url,
            location=location,
        )
        self.session.add(shelter)
        self.session.commit()
        return shelter

    def list_all(self) -> list[Shelter]:
        return self.session.query(Shelter).order_by(Shelter.name).all()