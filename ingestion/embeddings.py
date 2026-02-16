"""Embedding service — abstracts over Ollama and sentence-transformers.

Usage:
    embedder = get_embedder()
    vec = embedder.embed("A friendly golden retriever puppy")
    vecs = embedder.embed_batch(["text1", "text2"])
"""

from __future__ import annotations

import abc
from typing import Protocol

import httpx
import numpy as np

from config.settings import get_settings


class Embedder(Protocol):
    """Common interface for embedding providers."""

    def embed(self, text: str) -> list[float]: ...
    def embed_batch(self, texts: list[str]) -> list[list[float]]: ...


# ── Ollama Embeddings ─────────────────────────────────────────────────────────

class OllamaEmbedder:
    """Generate embeddings via Ollama's /api/embed endpoint."""

    def __init__(self, base_url: str | None = None, model: str | None = None):
        settings = get_settings()
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model = model or settings.ollama_embed_model
        self._client = httpx.Client(timeout=120.0)

    def embed(self, text: str) -> list[float]:
        resp = self._client.post(
            f"{self.base_url}/api/embed",
            json={"model": self.model, "input": text},
        )
        resp.raise_for_status()
        data = resp.json()
        # Ollama returns {"embeddings": [[...]]}
        return data["embeddings"][0]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        # Ollama /api/embed supports batch input
        resp = self._client.post(
            f"{self.base_url}/api/embed",
            json={"model": self.model, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["embeddings"]


# ── Sentence-Transformers Embeddings ──────────────────────────────────────────

class SentenceTransformerEmbedder:
    """Generate embeddings locally via sentence-transformers."""

    def __init__(self, model_name: str | None = None):
        settings = get_settings()
        model_name = model_name or settings.sentence_transformer_model

        # Lazy import so we don't require torch if using Ollama
        from sentence_transformers import SentenceTransformer
        self._model = SentenceTransformer(model_name)

    def embed(self, text: str) -> list[float]:
        return self._model.encode(text, normalize_embeddings=True).tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        embeddings = self._model.encode(texts, normalize_embeddings=True, batch_size=32)
        return embeddings.tolist()


# ── Factory ───────────────────────────────────────────────────────────────────

def get_embedder() -> Embedder:
    """Return the configured embedding provider."""
    settings = get_settings()
    if settings.embedding_provider == "sentence-transformers":
        return SentenceTransformerEmbedder()
    return OllamaEmbedder()
