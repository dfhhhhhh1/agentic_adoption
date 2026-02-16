#!/usr/bin/env python3
"""Load pet data from a JSON file (e.g. CMHS_animals.json) into the database.

Usage:
    python scripts/load_json.py data/CMHS_animals.json
    python scripts/load_json.py data/CMHS_animals.json --embed
    python scripts/load_json.py data/CMHS_animals.json --images-dir static/images
"""

import sys
import re
import json
import uuid
import argparse
from pathlib import Path
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import get_settings
from db.models import get_engine, get_session_factory, init_db, Shelter, Pet
from db.repository import PetRepository, ShelterRepository
from models.schemas import PetSchema, Species, Sex, Size, EnergyLevel


# ── Mapping helpers ───────────────────────────────────────────────────────────

def _map_species(raw_type: str) -> Species:
    """Map JSON 'type' field to our Species enum."""
    mapping = {
        "dog": Species.DOG,
        "cat": Species.CAT,
        "rabbit": Species.RABBIT,
        "bird": Species.BIRD,
        "guinea pig": Species.SMALL_ANIMAL,
        "hamster": Species.SMALL_ANIMAL,
        "ferret": Species.SMALL_ANIMAL,
        "turtle": Species.REPTILE,
        "tortoise": Species.REPTILE,
        "snake": Species.REPTILE,
        "lizard": Species.REPTILE,
    }
    return mapping.get(raw_type.lower().strip(), Species.OTHER)


def _map_sex(raw_sex: str) -> Sex:
    mapping = {
        "male": Sex.MALE,
        "female": Sex.FEMALE,
    }
    return mapping.get(raw_sex.lower().strip(), Sex.UNKNOWN)


def _map_size(weight_lbs: float | None, species_str: str) -> Size:
    """Infer size from weight and species."""
    if weight_lbs is None:
        return Size.UNKNOWN
    # For cats and small animals, thresholds are different
    if species_str in ("cat", "rabbit", "guinea pig", "ferret", "turtle"):
        if weight_lbs < 6:
            return Size.SMALL
        elif weight_lbs < 12:
            return Size.MEDIUM
        else:
            return Size.LARGE
    # Dogs
    if weight_lbs < 25:
        return Size.SMALL
    elif weight_lbs <= 60:
        return Size.MEDIUM
    elif weight_lbs <= 100:
        return Size.LARGE
    else:
        return Size.EXTRA_LARGE


def _infer_energy_level(description: str) -> EnergyLevel:
    """Best-effort energy level inference from the description text."""
    desc_lower = description.lower()
    high_keywords = ["high energy", "very active", "lots of exercise", "zoomies", "energetic", "loves to run"]
    low_keywords = ["calm", "chill", "couch", "lap dog", "lap cat", "laid back", "lazy", "reserved", "relaxed"]
    
    high_score = sum(1 for kw in high_keywords if kw in desc_lower)
    low_score = sum(1 for kw in low_keywords if kw in desc_lower)
    
    if high_score > low_score:
        return EnergyLevel.HIGH
    elif low_score > high_score:
        return EnergyLevel.LOW
    elif high_score > 0 or low_score > 0:
        return EnergyLevel.MEDIUM
    return EnergyLevel.UNKNOWN


def _build_age_text(age_obj: dict) -> str:
    """Build a human-readable age string from {years, months}."""
    years = age_obj.get("years")
    months = age_obj.get("months")
    if years is None and months is None:
        return "Unknown"
    parts = []
    if years and years > 0:
        parts.append(f"{years} year{'s' if years != 1 else ''}")
    if months and months > 0:
        parts.append(f"{months} month{'s' if months != 1 else ''}")
    return ", ".join(parts) if parts else "Unknown"


def _age_to_months(age_obj: dict) -> int | None:
    years = age_obj.get("years") or 0
    months = age_obj.get("months") or 0
    total = years * 12 + months
    return total if total > 0 else None


def _infer_good_with(description: str) -> dict:
    """Try to infer compatibility from description text."""
    desc_lower = description.lower()
    result = {
        "good_with_dogs": None,
        "good_with_cats": None,
        "good_with_children": None,
        "house_trained": None,
    }
    
    # Dogs
    if any(kw in desc_lower for kw in ["gets along great with", "loves other dogs", "good with dogs", "plays well with other dogs"]):
        result["good_with_dogs"] = True
    elif any(kw in desc_lower for kw in ["only pet", "no other dogs", "reactive toward other animals", "does not do well with other dogs"]):
        result["good_with_dogs"] = False
    
    # Cats
    if any(kw in desc_lower for kw in ["good with cats", "gets along with cats", "lives with cats"]):
        result["good_with_cats"] = True
    elif any(kw in desc_lower for kw in ["not good with cats", "chases cats", "no cats"]):
        result["good_with_cats"] = False
    
    # Children
    if any(kw in desc_lower for kw in ["good with children", "great with kids", "older children", "safe around children"]):
        result["good_with_children"] = True
    elif any(kw in desc_lower for kw in ["not do well with children", "no small children", "without small children", "without babies", "would not do well with children", "child-free"]):
        result["good_with_children"] = False
    
    # House trained
    if any(kw in desc_lower for kw in ["house trained", "house-trained", "housebroken", "potty trained", "no accidents in the house", "fully house trained"]):
        result["house_trained"] = True
    elif any(kw in desc_lower for kw in ["working on potty training", "not house trained", "not yet potty trained"]):
        result["house_trained"] = False
    
    return result


def _extract_special_needs(description: str) -> str | None:
    """Pull out medical/special needs mentions."""
    desc_lower = description.lower()
    needs = []
    
    medical_keywords = [
        "heart condition", "pulmonic stenosis", "subaortic stenosis",
        "bladder stone", "skin infection", "dental", "medication",
        "special diet", "allergies", "anxiety", "leash reactivity",
        "life expectancy", "surgery", "follow up visits", "ongoing monitoring",
        "declawed",
    ]
    
    for kw in medical_keywords:
        if kw in desc_lower:
            # Find the sentence containing this keyword
            for sentence in description.split("."):
                if kw in sentence.lower():
                    needs.append(sentence.strip())
                    break
    
    return ". ".join(needs) if needs else None


def _parse_intake_date(date_str: str) -> str | None:
    """Parse intake date string to ISO format."""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str.strip(), "%m/%d/%Y")
        return dt.isoformat()
    except ValueError:
        return date_str


def convert_json_entry(entry: dict, images_base_path: str = "/images") -> dict | None:
    """Convert a single JSON entry to our internal format.
    
    Returns None if the entry is empty/invalid.
    """
    # Skip empty entries
    if not entry.get("name") or not entry.get("type"):
        return None
    
    raw_type = entry.get("type", "")
    species = _map_species(raw_type)
    sex = _map_sex(entry.get("sex", ""))
    weight = entry.get("weight_lbs")
    size = _map_size(weight, raw_type.lower())
    age_obj = entry.get("age", {})
    description = entry.get("description", "")
    
    compatibility = _infer_good_with(description)
    energy = _infer_energy_level(description)
    special_needs = _extract_special_needs(description)
    
    # Build image URL from image_path
    image_path = entry.get("image_path", "")
    image_urls = [image_path] if image_path else []
    
    # Location info
    location = entry.get("location", {})
    shelter_name = location.get("name", "Unknown")
    shelter_lat = location.get("lat")
    shelter_long = location.get("long")
    shelter_location_str = None
    if shelter_lat and shelter_long:
        shelter_location_str = f"{shelter_lat},{shelter_long}"
    
    return {
        "external_id": entry.get("id", ""),
        "name": entry["name"],
        "species": species,
        "breed": entry.get("breed", "Unknown"),
        "age_text": _build_age_text(age_obj),
        "age_months": _age_to_months(age_obj),
        "sex": sex,
        "size": size,
        "weight_lbs": weight,
        "color": "Unknown",  # Not in the JSON
        "energy_level": energy,
        "good_with_dogs": compatibility["good_with_dogs"],
        "good_with_cats": compatibility["good_with_cats"],
        "good_with_children": compatibility["good_with_children"],
        "house_trained": compatibility["house_trained"],
        "special_needs": special_needs,
        "personality_description": description,
        "adoption_fee": entry.get("adoption_fee"),
        "is_neutered": None,  # Not in the JSON
        "shelter_name": shelter_name,
        "shelter_location": shelter_location_str,
        "listing_url": "",
        "image_urls": image_urls,
        "image_path": image_path,
        "intake_date": entry.get("intake_date", ""),
        "external_id": entry.get("id", ""),
        "shelter_lat": shelter_lat,
        "shelter_long": shelter_long,
    }


def load_json_file(filepath: str) -> list[dict]:
    """Load and fix common JSON issues, then return parsed entries."""
    with open(filepath, "r") as f:
        content = f.read()
    
    # Fix empty values (e.g. "weight_lbs": ,)
    content = re.sub(r":\s*,", ": null,", content)
    content = re.sub(r":\s*\n\s*}", ": null\n}", content)
    
    data = json.loads(content)
    if not isinstance(data, list):
        data = [data]
    
    return data


def main():
    parser = argparse.ArgumentParser(description="Load pets from a JSON file into the database")
    parser.add_argument("json_file", help="Path to the JSON file")
    parser.add_argument("--embed", action="store_true", help="Generate embeddings after loading")
    parser.add_argument("--images-dir", help="Base path for image files (stored in DB for frontend use)")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without writing to DB")
    args = parser.parse_args()

    filepath = Path(args.json_file)
    if not filepath.exists():
        print(f"Error: File not found: {filepath}")
        sys.exit(1)

    print(f"Loading pets from: {filepath}")

    # Parse JSON
    raw_entries = load_json_file(str(filepath))
    print(f"Found {len(raw_entries)} entries in JSON")

    # Convert entries
    converted = []
    skipped = 0
    for entry in raw_entries:
        result = convert_json_entry(entry, args.images_dir or "/images")
        if result:
            converted.append((entry, result))
        else:
            skipped += 1

    print(f"Converted: {len(converted)}, Skipped (empty): {skipped}")

    if args.dry_run:
        print("\n-- DRY RUN --")
        for raw, conv in converted:
            print(f"  {conv['name']:20s} | {conv['species'].value:12s} | {conv['breed']:30s} | {conv['age_text']}")
        print("\nNo data written to database.")
        return

    # Initialize DB
    settings = get_settings()
    print(f"Database: {settings.database_url}")
    engine = get_engine(settings)
    init_db(engine)
    session_factory = get_session_factory(engine)
    session = session_factory()

    shelter_repo = ShelterRepository(session)
    pet_repo = PetRepository(session)

    # Group by shelter
    shelters_map = {}  # shelter_name -> shelter ORM object
    pets_by_shelter = {}  # shelter_name -> list of converted dicts

    for raw, conv in converted:
        sname = conv["shelter_name"]
        if sname not in shelters_map:
            location = raw.get("location", {})
            shelter = shelter_repo.get_or_create(
                website_url=f"https://placeholder.local/{sname.lower().replace(' ', '-')}",
                name=sname,
                location=conv.get("shelter_location"),
            )
            # Update location coords if we have them
            if conv.get("shelter_lat") and conv.get("shelter_long"):
                shelter.latitude = conv["shelter_lat"]
                shelter.longitude = conv["shelter_long"]
                session.commit()
            shelters_map[sname] = shelter
            pets_by_shelter[sname] = []
        
        pets_by_shelter[sname].append(conv)

    print(f"\nShelters: {len(shelters_map)}")
    for sname, shelter in shelters_map.items():
        count = len(pets_by_shelter[sname])
        print(f"  {sname}: {count} pets")

    # Insert pets
    all_pet_records = []
    for sname, pet_dicts in pets_by_shelter.items():
        shelter = shelters_map[sname]
        for pdata in pet_dicts:
            # Build PetSchema for upsert
            pet_schema = PetSchema(
                name=pdata["name"],
                species=pdata["species"],
                breed=pdata["breed"],
                age_text=pdata["age_text"],
                age_months=pdata["age_months"],
                sex=pdata["sex"],
                size=pdata["size"],
                weight_lbs=pdata["weight_lbs"],
                color=pdata["color"],
                energy_level=pdata["energy_level"],
                good_with_dogs=pdata["good_with_dogs"],
                good_with_cats=pdata["good_with_cats"],
                good_with_children=pdata["good_with_children"],
                house_trained=pdata["house_trained"],
                special_needs=pdata["special_needs"],
                personality_description=pdata["personality_description"],
                adoption_fee=pdata["adoption_fee"],
                is_neutered=pdata["is_neutered"],
                shelter_name=pdata["shelter_name"],
                shelter_location=pdata["shelter_location"],
                listing_url=pdata["listing_url"],
                image_urls=pdata["image_urls"],
            )
            
            raw_json = {**pdata, "species": pdata["species"].value, 
                        "sex": pdata["sex"].value, "size": pdata["size"].value,
                        "energy_level": pdata["energy_level"].value}
            
            pet = pet_repo.upsert_pet(
                pet_data=pet_schema,
                shelter_id=shelter.id,
                raw_json=raw_json,
            )
            # Store extra fields from JSON
            pet.external_id = pdata.get("external_id", "")
            pet.intake_date_str = pdata.get("intake_date", "")
            pet.image_path = pdata.get("image_path", "")
            
            all_pet_records.append(pet)
            print(f"  Loaded: {pdata['name']} ({pdata['species'].value})")

    session.commit()
    print(f"\nStored {len(all_pet_records)} pets in database")

    # Generate embeddings
    if args.embed:
        print("\nGenerating embeddings...")
        try:
            from ingestion.embeddings import get_embedder
            embedder = get_embedder()

            texts = [p.to_text_for_embedding() for p in all_pet_records]
            try:
                embeddings = embedder.embed_batch(texts)
            except Exception as e:
                print(f"  Batch embed failed ({e}), trying one by one...")
                embeddings = []
                for t in texts:
                    try:
                        embeddings.append(embedder.embed(t))
                    except Exception as e2:
                        print(f"  Warning: embed failed for one pet: {e2}")
                        embeddings.append(None)

            for pet, emb in zip(all_pet_records, embeddings):
                if emb is not None:
                    pet.embedding = emb
                    print(f"  Embedded: {pet.name}")

            session.commit()
            embedded_count = sum(1 for e in embeddings if e is not None)
            print(f"  Generated {embedded_count}/{len(all_pet_records)} embeddings")
        except Exception as e:
            print(f"  Warning: Could not generate embeddings: {e}")
            print("  (Make sure Ollama is running with nomic-embed-text)")

    session.close()
    print(f"\nDone! {len(all_pet_records)} pets loaded from {filepath.name}")


if __name__ == "__main__":
    main()
