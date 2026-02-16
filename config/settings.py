"""Centralised configuration loaded from environment / .env file."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Postgres ──────────────────────────────────────────
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "pet_adoption"
    postgres_user: str = "petadmin"
    postgres_password: str = "changeme"

    # ── Ollama ────────────────────────────────────────────
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_embed_model: str = "nomic-embed-text"

    # ── Crawl4AI ──────────────────────────────────────────
    crawl_max_depth: int = 3
    crawl_max_pages: int = 50
    crawl_delay_seconds: float = 2.0

    # ── API ───────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # ── Embedding ─────────────────────────────────────────
    embedding_provider: str = "ollama"  # "ollama" | "sentence-transformers"
    sentence_transformer_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 768

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def async_database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
