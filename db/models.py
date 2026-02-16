"""SQLAlchemy ORM models with pgvector support.

Tables:
  - shelters: registered shelter sources
  - pets: extracted pet data + vector embeddings
  - crawl_jobs: track ingestion runs
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship, Session, sessionmaker

from config.settings import get_settings


class Base(DeclarativeBase):
    pass


# ── Shelters ──────────────────────────────────────────────────────────────────

class Shelter(Base):
    __tablename__ = "shelters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    website_url = Column(String(1024), nullable=False, unique=True)
    location = Column(String(512))
    contact_info = Column(String(512))
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    pets = relationship("Pet", back_populates="shelter", cascade="all, delete-orphan")
    crawl_jobs = relationship("CrawlJob", back_populates="shelter", cascade="all, delete-orphan")


# ── Pets ──────────────────────────────────────────────────────────────────────

class Pet(Base):
    __tablename__ = "pets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shelter_id = Column(UUID(as_uuid=True), ForeignKey("shelters.id"), nullable=False)

    # External ID from source (e.g. "CMHS-A-46003")
    external_id = Column(String(255), nullable=True, index=True)

    # Core identity
    name = Column(String(255), nullable=False)
    species = Column(String(50), nullable=False, index=True)
    breed = Column(String(255), default="Unknown")
    age_text = Column(String(100), default="Unknown")
    age_months = Column(Integer)
    sex = Column(String(20), default="unknown")
    size = Column(String(20), default="unknown")
    weight_lbs = Column(Float)
    color = Column(String(255), default="Unknown")

    # Behavioural / contextual
    energy_level = Column(String(20), default="unknown")
    good_with_dogs = Column(Boolean)
    good_with_cats = Column(Boolean)
    good_with_children = Column(Boolean)
    house_trained = Column(Boolean)
    special_needs = Column(Text)
    personality_description = Column(Text, default="")

    # Logistics
    adoption_fee = Column(Float)
    is_neutered = Column(Boolean)
    listing_url = Column(String(1024), default="")
    image_urls = Column(ARRAY(String), default=[])

    # Image path for local/frontend images (e.g. "/images/CMHS-A-46003.jpeg")
    image_path = Column(String(1024), nullable=True)

    # Intake / source info
    intake_date_str = Column(String(50), nullable=True)

    # Vector embedding of the combined text profile
    embedding = Column(Vector(768))  # dimension matches nomic-embed-text / MiniLM

    # Metadata
    raw_extracted_json = Column(JSONB)  # store the raw LLM output or source JSON for debugging
    source = Column(String(50), default="crawl")  # "crawl", "json", "manual"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    shelter = relationship("Shelter", back_populates="pets")

    # Composite index for common filter + vector queries
    __table_args__ = (
        Index("ix_pets_species_embedding", "species"),
    )

    def to_text_for_embedding(self) -> str:
        """Build a rich text representation for vector embedding."""
        parts = [
            f"{self.name} is a {self.age_text} {self.sex} {self.breed} ({self.species}).",
            f"Size: {self.size}. Energy level: {self.energy_level}.",
        ]
        if self.weight_lbs:
            parts.append(f"Weight: {self.weight_lbs} lbs.")
        if self.good_with_dogs is not None:
            parts.append(f"Good with dogs: {'yes' if self.good_with_dogs else 'no'}.")
        if self.good_with_cats is not None:
            parts.append(f"Good with cats: {'yes' if self.good_with_cats else 'no'}.")
        if self.good_with_children is not None:
            parts.append(f"Good with children: {'yes' if self.good_with_children else 'no'}.")
        if self.house_trained is not None:
            parts.append(f"House trained: {'yes' if self.house_trained else 'no'}.")
        if self.special_needs:
            parts.append(f"Special needs: {self.special_needs}")
        if self.personality_description:
            parts.append(self.personality_description)
        return " ".join(parts)


# ── Crawl Jobs ────────────────────────────────────────────────────────────────

class CrawlJob(Base):
    __tablename__ = "crawl_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shelter_id = Column(UUID(as_uuid=True), ForeignKey("shelters.id"), nullable=False)
    status = Column(String(20), default="pending", index=True)

    pages_crawled = Column(Integer, default=0)
    pets_extracted = Column(Integer, default=0)
    errors = Column(JSONB, default=[])

    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    shelter = relationship("Shelter", back_populates="crawl_jobs")


# ── Engine & Session factory ──────────────────────────────────────────────────

def get_engine(settings=None):
    if settings is None:
        settings = get_settings()
    return create_engine(settings.database_url, echo=False, pool_size=5)


def get_session_factory(engine=None):
    if engine is None:
        engine = get_engine()
    return sessionmaker(bind=engine)


def init_db(engine=None):
    """Create all tables + pgvector extension."""
    from sqlalchemy import text as sa_text
    if engine is None:
        engine = get_engine()
    with engine.connect() as conn:
        conn.execute(sa_text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(engine)