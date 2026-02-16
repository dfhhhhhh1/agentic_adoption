# Pet Adoption Platform — Agentic AI Matching Engine

An intelligent pet adoption platform that uses autonomous agents for data ingestion and RAG-powered matching. Built 100% local-first with no paid APIs required.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Frontend                            │
│   Home (Chat) │ Adopt (Quiz + Browse) │ Chat (Multi-Agent)      │
│   Fetches from: /pets, /match, /stats, /shelters                │
└───────────┬─────────────────────────────────────────────────────┘
            │ HTTP (localhost:8000)
┌───────────▼─────────────────────────────────────────────────────┐
│                        FastAPI Server                           │
│  POST /ingest  │  POST /match  │  GET /pets  │  GET /shelters  │
│  POST /import/json  │  GET /stats  │  GET /health              │
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
| **Frontend**      | React (JSX artifact)        | Interactive UI with quiz, chat, and pet browsing       |
| Web Scraping      | Crawl4AI + Playwright       | BFS deep crawl, ShelterLuv-aware, fully local          |
| LLM Extraction    | Ollama (JSON mode)          | Schema-validated JSON output with auto-retry            |
| LLM Model         | Llama 3.2 (via Ollama)      | Optimized for tool use & JSON formatting               |
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

This starts PostgreSQL on **port 5433** (mapped from container port 5432).

### 2. Pull Ollama models

```bash
ollama pull llama3.2:latest
ollama pull nomic-embed-text
```

### 3. Install Python dependencies

```bash
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env if your PostgreSQL or Ollama settings differ
```

The default `.env` uses:
- PostgreSQL on `localhost:5433` (matching docker-compose.yml)
- Ollama on `localhost:11434`
- Ollama model `llama3.2:latest`
- Embedding model `nomic-embed-text`

### 5. Initialize database & load data

**Option A — Seed with sample data + embeddings:**
```bash
python scripts/init_db.py --seed --embed
```

**Option B — Load real shelter data from JSON:**
```bash
# Create tables
python scripts/init_db.py

# Load pets from JSON file with embeddings
python scripts/load_json.py data/CMHS_animals.json --embed
```

**Option C — Crawl a live shelter website:**
```bash
python scripts/init_db.py
python scripts/ingest.py https://example-shelter.org --name "Happy Paws" --depth 2
```

### 6. Start the API server

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Or:
```bash
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: **http://localhost:8000/docs**

### 7. Launch the Frontend

The frontend is a React JSX file (`pet-platform-v2.jsx`) designed to run as a Claude artifact or in any React environment.

**Option A — Claude Artifact (easiest):**
Upload `pet-platform-v2.jsx` to Claude and it will render as an interactive artifact. The frontend connects to `http://localhost:8000` by default.

**Option B — Standalone React app:**
Copy the JSX file into a React project (e.g. Vite + React) and import the default export as your root component.

cd frontend
npm install
npm run dev

> **Important:** The frontend expects the FastAPI backend to be running on `http://localhost:8000`. If your backend runs on a different host/port, update the `API_BASE` constant at the top of the JSX file.

## Running the Full Stack

Here's a summary of all the services you need running:

| Service         | Command                                                | Port   |
|-----------------|--------------------------------------------------------|--------|
| PostgreSQL      | `docker compose up -d`                                 | 5433   |
| Ollama          | `ollama serve` (usually auto-starts)                   | 11434  |
| FastAPI Backend | `uvicorn api.main:app --reload --host 0.0.0.0 --port 8000` | 8000   |
| Frontend        | Claude artifact or React dev server                    | —      |

## Usage

### Browse Pets (Frontend)

Open the frontend and navigate to the **Adopt** tab to browse all pets loaded in the database. Use the species filter buttons to narrow results.

### AI Matching Quiz (Frontend)

Click **Start Matching Quiz** on the Adopt tab. Answer 8 lifestyle questions, and the app will:
1. Build a natural-language query from your answers
2. Send it to the `/match` API endpoint
3. The backend embeds your query, runs vector search (pgvector cosine similarity)
4. An LLM (Ollama) reasons over the top candidates vs. your preferences
5. Results come back ranked with personalized explanations

### API Endpoints

**Match pets:**
```bash
curl -X POST http://localhost:8000/match \
  -H "Content-Type: application/json" \
  -d '{
    "query": "I live in a small apartment, work from home, and I am a first-time owner looking for a chill companion.",
    "max_results": 5
  }'
```

**List pets:**
```bash
curl http://localhost:8000/pets
curl http://localhost:8000/pets?species=cat
curl http://localhost:8000/pets/{pet_id}
```

**Database stats:**
```bash
curl http://localhost:8000/stats
```

**Ingest a shelter website:**
```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"shelter_url": "https://example-shelter.org", "shelter_name": "Happy Paws"}'
```

**Import from JSON file:**
```bash
curl -X POST http://localhost:8000/import/json \
  -H "Content-Type: application/json" \
  -d '{"file_path": "data/CMHS_animals.json", "generate_embeddings": true}'
```

**Health check:**
```bash
curl http://localhost:8000/health
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
│   ├── crawler.py           # Crawl4AI + Playwright shelter spider
│   ├── extractor.py         # Ollama extraction agent (JSON mode)
│   ├── embeddings.py        # Ollama/sentence-transformers embedder
│   └── pipeline.py          # Orchestrates crawl→extract→embed→store
├── matchmaker/
│   └── matcher.py           # RAG search + ReAct reasoning
├── models/
│   └── schemas.py           # Pydantic schemas (extraction + API)
├── scripts/
│   ├── init_db.py           # DB init + optional seed data
│   ├── ingest.py            # CLI ingestion runner
│   └── load_json.py         # Load pets from JSON files
├── data/
│   └── CMHS_animals.json    # Sample shelter data
├── pet-platform-v2.jsx      # React frontend (Claude artifact)
├── docker-compose.yml       # PostgreSQL + pgvector
├── requirements.txt
├── .env
└── README.md
```

## Frontend ↔ Backend Integration

The React frontend communicates with the FastAPI backend via these endpoints:

| Frontend Action         | API Endpoint          | Method | Description                        |
|------------------------|-----------------------|--------|------------------------------------|
| Load pets              | `/pets`               | GET    | List pets with optional species filter |
| Pet detail modal       | `/pets/{id}`          | GET    | Full pet details                   |
| Matching quiz results  | `/match`              | POST   | RAG-powered matching from quiz answers |
| Stats (pet counts)     | `/stats`              | GET    | Database statistics                |
| Health indicator       | `/health`             | GET    | API online/offline status          |

The frontend shows a green/red status dot in the nav bar indicating whether the backend is reachable.

## Key Design Decisions

- **Unified pgvector**: Relational data and vector embeddings in the same table — no separate vector DB needed.
- **Ollama-first**: Everything runs locally. Swap `EMBEDDING_PROVIDER=sentence-transformers` in `.env` if you prefer torch-based embeddings.
- **Blended scoring**: Match results blend vector similarity (40%) with LLM confidence (60%) for more nuanced ranking.
- **Quiz → Natural Language → RAG**: The frontend quiz converts structured answers into a natural-language query, which the backend embeds and uses for vector search + LLM reasoning.
- **Graceful degradation**: The frontend detects when the backend is offline and shows appropriate messaging.
- **ShelterLuv-aware crawler**: Auto-detects ShelterLuv Vue.js SPAs and uses Playwright for JS-rendered content.

## Troubleshooting

**"Backend API is offline" in frontend:**
- Make sure the FastAPI server is running on port 8000
- Check CORS — the backend allows all origins by default

**"No pets found":**
- Run `python scripts/init_db.py --seed --embed` or `python scripts/load_json.py data/CMHS_animals.json --embed`
- Check `curl http://localhost:8000/stats` to verify pet count

**Matching returns no results:**
- Ensure pets have embeddings: load data with the `--embed` flag
- Ensure Ollama is running with `nomic-embed-text` model: `ollama list`

**Ollama connection errors:**
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check the model is pulled: `ollama pull llama3.2:latest && ollama pull nomic-embed-text`