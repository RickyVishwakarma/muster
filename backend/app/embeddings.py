"""Embeddings + retrieval.

Ships with a dependency-free, deterministic hashing embedding so the app runs
fully offline with no model download. It is intentionally isolated behind
`embed()` / `top_k()` — swap in real embeddings (e.g. Voyage) or move retrieval
into pgvector without touching the routers.
"""
from __future__ import annotations

import hashlib
import math
import re

EMBED_DIM = 256
_WORD_RE = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> list[str]:
    return _WORD_RE.findall(text.lower())


def embed(text: str) -> list[float]:
    """Hashing bag-of-words embedding, L2-normalized.

    Deterministic and offline. Good enough to demonstrate semantic-ish
    retrieval; replace with a real embedding model for production quality.
    """
    vec = [0.0] * EMBED_DIM
    for tok in _tokens(text):
        h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
        idx = h % EMBED_DIM
        sign = 1.0 if (h >> 8) & 1 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0.0:
        return vec
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    return sum(x * y for x, y in zip(a, b))


def top_k(
    query_vec: list[float],
    candidates: list[tuple[str, list[float]]],
    k: int,
) -> list[tuple[str, float]]:
    """Return [(id, score)] for the k highest-scoring candidates."""
    scored = [(cid, cosine(query_vec, vec)) for cid, vec in candidates]
    scored.sort(key=lambda t: t[1], reverse=True)
    return scored[:k]


def chunk_text(text: str, target_words: int = 120, overlap: int = 20) -> list[str]:
    """Split text into overlapping word windows."""
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    step = max(target_words - overlap, 1)
    for start in range(0, len(words), step):
        window = words[start : start + target_words]
        if window:
            chunks.append(" ".join(window))
        if start + target_words >= len(words):
            break
    return chunks
