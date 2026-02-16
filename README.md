# Pet Adoption Platform — Agentic AI Matching Engine

An intelligent pet adoption platform that uses autonomous agents for data ingestion and RAG-powered matching. Built 100% local-first with no paid APIs required.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FastAPI Server                           │
│  POST /ingest  │  POST /match  │  GET /pets  │  GET /shelters  │
└───────┬────────────────┬────────────────┬───────────────────────┘
        │                │                │
   ┌────▼─────┐    ┌─────▼──────┐    ┌───▼────┐
   │ Stage 1  │    │  Stage 2   │    │  CRUD  │
   │ Ingest   │    │ Matchmaker │    │ Browse │
   └────┬─────┘    └─────┬──────┘    └───┬────┘
        │                │                │
   ┌────▼─────┐    ┌─────▼──────┐        │
   │ Crawl4AI │    │   Ollama   │        │
   │  Spider  │    │  (ReAct)   │        │
   └────┬─────┘    └─────┬──────┘        │
        │                │                │
   ┌────▼─────┐    ┌─────▼──────┐        │
   │  Ollama  │    │  Embedder  │        │
   │ Extract  │    │  (Vector)  │        │
   └────┬─────┘    └─────┬──────┘        │
        │                │                │
        └────────┬───────┘────────────────┘
                 │
        ┌────────▼────────┐
        │   PostgreSQL    │
        │   + pgvector    │
        │  (relational +  │
        │   vector store) │
        └─────────────────┘
```

## Tech Stack

| Component         | Tool                        | Why                                                    |
|-------------------|-----------------------------|--------------------------------------------------------|
| Web Scraping      | Crawl4AI                    | BFS deep crawl, FitMarkdown, fully local               |
| LLM Extraction    | PydanticAI + Ollama         | Schema-validated JSON output with auto-retry            |
| LLM Model         | Llama 3.1 8B (via Ollama)   | Optimized for tool use & JSON formatting               |
| Embeddings        | Ollama nomic-embed-text     | Free local embeddings (768-dim)                        |
| Database          | PostgreSQL + pgvector       | Unified relational + vector store                      |
| API               | FastAPI                     | Async, auto-docs, Pydantic integration                 |
| Matching          | RAG + ReAct reasoning       | Vector search → LLM reasoning → explained results      |

## Prerequisites

- **Python 3.11+**
- **Docker** (for PostgreSQL) or a local PostgreSQL 16 install with pgvector
- **Ollama** installed and running ([ollama.com](https://ollama.com))

## Quick Start

### 1. Start PostgreSQL with pgvector

```bash
docker compose up -d
```

### 2. Pull Ollama models

```bash
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

### 3. Install Python dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env if your PostgreSQL or Ollama settings differ
```

### 5. Initialize database & seed sample data

```bash
# Tables only
python scripts/init_db.py

# Tables + sample pets + embeddings
python scripts/init_db.py --seed --embed
```

### 6. Start the API

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
or
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: **http://localhost:8000/docs**

## Usage

### Stage 1: Ingest a Shelter Website

**Via API:**
```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"shelter_url": "https://example-shelter.org", "shelter_name": "Happy Paws"}'
```

**Via CLI:**
```bash
python scripts/ingest.py https://example-shelter.org --name "Happy Paws" --depth 2
```

The ingestion pipeline will:
1. Spider the shelter site using BFS deep crawling
2. Clean HTML → Markdown via FitMarkdown (strips nav/ads)
3. Send each page to Llama 3.1 for structured extraction
4. Validate output against PetSchema with auto-retry
5. Generate vector embeddings via nomic-embed-text
6. Store everything in PostgreSQL + pgvector

### Stage 2: Find a Match

```bash
curl -X POST http://localhost:8000/match \
  -H "Content-Type: application/json" \
  -d '{
    "query": "I live in a small apartment, work from home, and I am a first-time owner looking for a chill companion.",
    "max_results": 5
  }'
```

**Example response:**
```json
{
  "query": "I live in a small apartment...",
  "reasoning_summary": "Based on your apartment living and first-time ownership...",
  "results": [
    {
      "pet": {
        "name": "Bella",
        "breed": "Cavalier King Charles Spaniel",
        "energy_level": "low",
        "personality_description": "Bella is the ultimate lap dog..."
      },
      "similarity_score": 0.92,
      "explanation": "Bella is ideal for your apartment because..."
    }
  ]
}
```

### Browse Pets

```bash
# List all pets
curl http://localhost:8000/pets

# Filter by species
curl http://localhost:8000/pets?species=cat

# Get specific pet
curl http://localhost:8000/pets/{pet_id}

# Database stats
curl http://localhost:8000/stats
```

## Project Structure

```
pet-adoption-platform/
├── api/
│   └── main.py              # FastAPI app with all endpoints
├── config/
│   └── settings.py          # Centralised Pydantic settings
├── db/
│   ├── models.py            # SQLAlchemy ORM + pgvector
│   └── repository.py        # CRUD + vector search operations
├── ingestion/
│   ├── crawler.py           # Crawl4AI shelter spider
│   ├── extractor.py         # PydanticAI + Ollama extraction agent
│   ├── embeddings.py        # Ollama/sentence-transformers embedder
│   └── pipeline.py          # Orchestrates crawl→extract→embed→store
├── matchmaker/
│   └── matcher.py           # RAG search + ReAct reasoning
├── models/
│   └── schemas.py           # Pydantic schemas (extraction + API)
├── scripts/
│   ├── init_db.py           # DB init + optional seed data
│   └── ingest.py            # CLI ingestion runner
├── docker-compose.yml       # PostgreSQL + pgvector
├── requirements.txt
├── .env.example
└── README.md
```

## Key Design Decisions

- **Unified pgvector**: Relational data and vector embeddings in the same table — no separate vector DB needed.
- **PydanticAI over LangChain**: Purpose-built for structured extraction with schema validation and auto-retry.
- **Ollama-first**: Everything runs locally. Swap `EMBEDDING_PROVIDER=sentence-transformers` in `.env` if you prefer torch-based embeddings.
- **Blended scoring**: Match results blend vector similarity (40%) with LLM confidence (60%) for more nuanced ranking.
- **Graceful fallbacks**: If PydanticAI fails, the extractor falls back to raw Ollama JSON mode.

## Next Steps (Stage 3+)

- **Lost Pet Recovery**: Reverse image search + community alerts
- **Community Marketplace**: Give/request pet supplies
- **Multi-shelter scheduler**: Automated periodic re-crawls
- **Frontend**: React/Next.js UI with chat-based matching
