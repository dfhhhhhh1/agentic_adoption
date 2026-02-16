#!/usr/bin/env python3
"""Initialize the database and optionally seed with sample data.

Usage:
    python scripts/init_db.py           # Just create tables
    python scripts/init_db.py --seed    # Create tables + seed sample data
"""

import sys
import uuid
import argparse
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import get_settings
from db.models import get_engine, get_session_factory, init_db, Shelter, Pet


SAMPLE_PETS = [
    {
        "name": "Buster",
        "species": "dog",
        "breed": "Husky Mix",
        "age_text": "3 years",
        "age_months": 36,
        "sex": "male",
        "size": "large",
        "weight_lbs": 55.0,
        "color": "Gray and White",
        "energy_level": "low",
        "good_with_dogs": True,
        "good_with_cats": True,
        "good_with_children": True,
        "house_trained": True,
        "personality_description": (
            "Buster is an unusually calm Husky who prefers lounging on the couch to running. "
            "He's been described as 'cat-like' in his independence and is very gentle with "
            "everyone he meets. Perfect for someone who wants a big cuddly companion."
        ),
        "adoption_fee": 150.0,
        "is_neutered": True,
        "listing_url": "https://example-shelter.org/pets/buster",
    },
    {
        "name": "Luna",
        "species": "cat",
        "breed": "Domestic Shorthair",
        "age_text": "2 years",
        "age_months": 24,
        "sex": "female",
        "size": "small",
        "weight_lbs": 8.0,
        "color": "Black",
        "energy_level": "medium",
        "good_with_dogs": False,
        "good_with_cats": True,
        "good_with_children": True,
        "house_trained": True,
        "personality_description": (
            "Luna is a playful and affectionate cat who loves to be in the same room as her people. "
            "She enjoys window watching and interactive toys. She can be shy at first but warms up quickly."
        ),
        "adoption_fee": 75.0,
        "is_neutered": True,
        "listing_url": "https://example-shelter.org/pets/luna",
    },
    {
        "name": "Max",
        "species": "dog",
        "breed": "Labrador Retriever",
        "age_text": "1 year",
        "age_months": 14,
        "sex": "male",
        "size": "large",
        "weight_lbs": 68.0,
        "color": "Yellow",
        "energy_level": "high",
        "good_with_dogs": True,
        "good_with_cats": None,
        "good_with_children": True,
        "house_trained": True,
        "personality_description": (
            "Max is a young, energetic Lab who loves fetch, swimming, and long hikes. "
            "He needs an active family with a yard. He knows basic commands and is eager to please. "
            "Would thrive with an experienced dog owner."
        ),
        "adoption_fee": 200.0,
        "is_neutered": True,
        "listing_url": "https://example-shelter.org/pets/max",
    },
    {
        "name": "Bella",
        "species": "dog",
        "breed": "Cavalier King Charles Spaniel",
        "age_text": "5 years",
        "age_months": 60,
        "sex": "female",
        "size": "small",
        "weight_lbs": 15.0,
        "color": "Blenheim (Chestnut and White)",
        "energy_level": "low",
        "good_with_dogs": True,
        "good_with_cats": True,
        "good_with_children": True,
        "house_trained": True,
        "personality_description": (
            "Bella is the ultimate lap dog. She's calm, sweet-natured, and wants nothing more "
            "than to curl up next to you on the sofa. Great for apartments, seniors, or first-time "
            "dog owners. She's gentle with everyone including small children and other pets."
        ),
        "adoption_fee": 175.0,
        "is_neutered": True,
        "listing_url": "https://example-shelter.org/pets/bella",
    },
    {
        "name": "Whiskers",
        "species": "cat",
        "breed": "Maine Coon Mix",
        "age_text": "4 years",
        "age_months": 48,
        "sex": "male",
        "size": "medium",
        "weight_lbs": 14.0,
        "color": "Orange Tabby",
        "energy_level": "medium",
        "good_with_dogs": True,
        "good_with_cats": True,
        "good_with_children": True,
        "house_trained": True,
        "personality_description": (
            "Whiskers is a gentle giant. He's very social and follows his people around the house. "
            "He gets along with dogs and other cats. Loves to play but also happy to nap. "
            "Very vocal — he'll 'talk' to you throughout the day."
        ),
        "adoption_fee": 100.0,
        "is_neutered": True,
        "listing_url": "https://example-shelter.org/pets/whiskers",
    },
    {
        "name": "Rosie",
        "species": "dog",
        "breed": "Pit Bull Terrier Mix",
        "age_text": "2 years",
        "age_months": 28,
        "sex": "female",
        "size": "medium",
        "weight_lbs": 45.0,
        "color": "Brindle",
        "energy_level": "medium",
        "good_with_dogs": False,
        "good_with_cats": False,
        "good_with_children": True,
        "house_trained": True,
        "special_needs": "Needs to be the only pet in the household. Some leash reactivity being worked on.",
        "personality_description": (
            "Rosie is a sweet, loyal girl who bonds deeply with her person. She loves belly rubs, "
            "car rides, and moderate walks. She does best as the only pet but is wonderful with humans "
            "of all ages. She's working on her leash manners and improving every day."
        ),
        "adoption_fee": 125.0,
        "is_neutered": True,
        "listing_url": "https://example-shelter.org/pets/rosie",
    },
]


def seed_database(session, shelter_id: uuid.UUID):
    """Insert sample pets into the database."""
    for pet_data in SAMPLE_PETS:
        pet = Pet(
            id=uuid.uuid4(),
            shelter_id=shelter_id,
            **pet_data,
        )
        session.add(pet)
    session.commit()
    print(f"  Seeded {len(SAMPLE_PETS)} sample pets")


def main():
    parser = argparse.ArgumentParser(description="Initialize the pet adoption database")
    parser.add_argument("--seed", action="store_true", help="Seed with sample data")
    parser.add_argument("--embed", action="store_true", help="Generate embeddings for seeded data")
    args = parser.parse_args()

    settings = get_settings()
    print(f"Database: {settings.database_url}")

    engine = get_engine(settings)
    print("Creating tables...")
    init_db(engine)
    print("  Tables created successfully")

    if args.seed:
        session_factory = get_session_factory(engine)
        session = session_factory()

        # Create sample shelter
        shelter = Shelter(
            id=uuid.uuid4(),
            name="Happy Paws Shelter",
            website_url="https://example-shelter.org",
            location="Columbia, MO",
            contact_info="info@example-shelter.org",
        )
        session.add(shelter)
        session.commit()
        print(f"  Created shelter: {shelter.name}")

        seed_database(session, shelter.id)

        if args.embed:
            print("Generating embeddings...")
            try:
                from ingestion.embeddings import get_embedder
                embedder = get_embedder()

                pets = session.query(Pet).filter(Pet.shelter_id == shelter.id).all()
                for pet in pets:
                    text = pet.to_text_for_embedding()
                    embedding = embedder.embed(text)
                    pet.embedding = embedding
                    print(f"  Embedded: {pet.name}")
                session.commit()
                print(f"  Generated embeddings for {len(pets)} pets")
            except Exception as e:
                print(f"  Warning: Could not generate embeddings: {e}")
                print("  (Make sure Ollama is running with nomic-embed-text)")

        session.close()

    print("\nDone! Start the API with:")
    print("  cd pet-adoption-platform && uvicorn api.main:app --reload")


if __name__ == "__main__":
    main()
