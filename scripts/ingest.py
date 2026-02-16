#!/usr/bin/env python3
"""CLI entry point for running the ingestion pipeline.

Usage:
    python scripts/ingest.py https://example-shelter.org --name "Happy Paws"
    python scripts/ingest.py https://example-shelter.org --depth 2 --max-pages 20
"""

import sys
import argparse
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.pipeline import run_ingestion_pipeline


def main():
    parser = argparse.ArgumentParser(description="Run the pet ingestion spider on a shelter website")
    parser.add_argument("url", help="Root URL of the shelter website")
    parser.add_argument("--name", "-n", help="Shelter name (defaults to URL)")
    parser.add_argument("--depth", "-d", type=int, help="Max crawl depth")
    parser.add_argument("--max-pages", "-p", type=int, help="Max pages to crawl")
    args = parser.parse_args()

    print(f"Starting ingestion for: {args.url}")
    print(f"Shelter name: {args.name or args.url}")
    print()

    result = asyncio.run(
        run_ingestion_pipeline(
            shelter_url=args.url,
            shelter_name=args.name,
            max_depth=args.depth,
            max_pages=args.max_pages,
        )
    )

    print("\n" + "=" * 60)
    print("INGESTION COMPLETE")
    print("=" * 60)
    print(f"  Job ID:         {result['job_id']}")
    print(f"  Status:         {result['status']}")
    print(f"  Pages crawled:  {result['pages_crawled']}")
    print(f"  Pets extracted: {result['pets_extracted']}")
    if result["errors"]:
        print(f"  Errors:         {len(result['errors'])}")
        for err in result["errors"][:5]:
            print(f"    - {err}")


if __name__ == "__main__":
    main()
