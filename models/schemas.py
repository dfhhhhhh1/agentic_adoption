"""Pet data schemas used for LLM extraction and API responses.

These Pydantic models serve double duty:
  1. PydanticAI uses them to constrain LLM output during ingestion.
  2. FastAPI uses them as response models for the query API.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class Species(str, Enum):
    DOG = "dog"
    CAT = "cat"
    RABBIT = "rabbit"
    BIRD = "bird"
    SMALL_ANIMAL = "small_animal"  # hamster, guinea pig, etc.
    REPTILE = "reptile"
    OTHER = "other"


class Sex(str, Enum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


class Size(str, Enum):
    SMALL = "small"       # < 25 lbs
    MEDIUM = "medium"     # 25-60 lbs
    LARGE = "large"       # 60-100 lbs
    EXTRA_LARGE = "xlarge" # 100+ lbs
    UNKNOWN = "unknown"


class EnergyLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    UNKNOWN = "unknown"


# ── Core Extraction Schema ────────────────────────────────────────────────────

class PetSchema(BaseModel):
    """Schema the LLM extraction agent must populate for every pet listing."""

    name: str = Field(..., description="Pet's name as listed by the shelter")
    species: Species = Field(..., description="Type of animal")
    breed: str = Field("Unknown", description="Primary breed or mix description")
    age_text: str = Field("Unknown", description="Age as stated, e.g. '2 years', 'puppy', 'senior'")
    age_months: Optional[int] = Field(None, description="Estimated age in months if determinable")
    sex: Sex = Field(Sex.UNKNOWN)
    size: Size = Field(Size.UNKNOWN)
    weight_lbs: Optional[float] = Field(None, description="Weight in pounds if listed")
    color: str = Field("Unknown", description="Coat / color description")

    # Contextual / behavioural data
    energy_level: EnergyLevel = Field(EnergyLevel.UNKNOWN)
    good_with_dogs: Optional[bool] = Field(None, description="Gets along with other dogs")
    good_with_cats: Optional[bool] = Field(None, description="Gets along with cats")
    good_with_children: Optional[bool] = Field(None, description="Safe around children")
    house_trained: Optional[bool] = Field(None)
    special_needs: Optional[str] = Field(None, description="Medical or behavioural notes")
    personality_description: str = Field(
        "",
        description="Free-text personality blurb from the shelter listing"
    )

    # Logistics
    adoption_fee: Optional[float] = Field(None, description="Fee in USD if listed")
    is_neutered: Optional[bool] = Field(None)
    shelter_name: str = Field("Unknown")
    shelter_location: Optional[str] = Field(None, description="City/state or address")
    shelter_contact: Optional[str] = Field(None, description="Phone or email")
    listing_url: str = Field("", description="Direct URL to the pet's listing page")
    image_urls: list[str] = Field(default_factory=list, description="URLs to pet photos")


class PetListingBatch(BaseModel):
    """Wrapper returned by the LLM when a page contains multiple pet listings."""
    pets: list[PetSchema] = Field(default_factory=list)


# ── API Request / Response Models ─────────────────────────────────────────────

class MatchQuery(BaseModel):
    """What the user sends to the /match endpoint."""
    query: str = Field(
        ...,
        description="Free-text description of what the adopter is looking for",
        min_length=10,
        max_length=2000,
    )
    species_filter: Optional[Species] = None
    max_results: int = Field(10, ge=1, le=50)
    max_distance_miles: Optional[float] = Field(None, description="Radius filter if location is known")
    location: Optional[str] = Field(None, description="Adopter's city/zip for distance calc")


class MatchResult(BaseModel):
    """A single pet result returned by the matchmaker."""
    pet: PetSchema
    similarity_score: float = Field(..., description="Cosine similarity 0-1")
    explanation: Optional[str] = Field(None, description="LLM-generated reason for the match")


class MatchResponse(BaseModel):
    """Full response from the /match endpoint."""
    query: str
    results: list[MatchResult]
    reasoning_summary: Optional[str] = Field(
        None, description="High-level summary from the ReAct agent"
    )


# ── Ingestion Status Models ──────────────────────────────────────────────────

class CrawlJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CrawlJobRequest(BaseModel):
    """Request to start a new crawl job."""
    shelter_url: str = Field(..., description="Root URL of the shelter website")
    shelter_name: Optional[str] = Field(None)
    max_depth: Optional[int] = Field(None, description="Override default crawl depth")
    max_pages: Optional[int] = Field(None, description="Override default page limit")


class CrawlJobResponse(BaseModel):
    """Status of a crawl job."""
    job_id: str
    status: CrawlJobStatus
    shelter_url: str
    pages_crawled: int = 0
    pets_extracted: int = 0
    errors: list[str] = Field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
