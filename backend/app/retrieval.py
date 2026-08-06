"""Lexical retrieval (BM25) + rank fusion.

BM25 is the standard keyword-ranking function: it weights rare, informative
terms higher (IDF) and normalizes for document length, which is a large jump in
quality over plain bag-of-words cosine. It runs on chunk *text* — no vectors,
no dependencies, and it works on documents that were ingested earlier.

We fuse BM25 (lexical) with the embedding cosine (semantic) using Reciprocal
Rank Fusion, so a chunk that ranks well on either signal surfaces.
"""
from __future__ import annotations

import math
import re

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Small English stopword list — dropping these focuses ranking on content words.
_STOPWORDS = frozenset(
    """a an and are as at be been being but by for from has have had he her his i
    if in into is it its of on or our that the their them they this to was were
    what when where which who will with you your do does did not can could would
    should about over under than then them these those there here""".split()
)


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if len(t) > 1 and t not in _STOPWORDS]


def bm25_rank(
    query: str,
    docs: list[tuple[str, str]],
    k1: float = 1.5,
    b: float = 0.75,
) -> list[tuple[str, float]]:
    """Rank ``docs`` = [(id, text)] against ``query``. Returns [(id, score)] desc."""
    tokenized = [(doc_id, tokenize(text)) for doc_id, text in docs]
    n = len(tokenized)
    if n == 0:
        return []

    doc_len = {doc_id: len(toks) for doc_id, toks in tokenized}
    avgdl = (sum(doc_len.values()) / n) or 1.0

    df: dict[str, int] = {}
    for _doc_id, toks in tokenized:
        for term in set(toks):
            df[term] = df.get(term, 0) + 1

    q_terms = tokenize(query)
    scores: list[tuple[str, float]] = []
    for doc_id, toks in tokenized:
        tf: dict[str, int] = {}
        for t in toks:
            tf[t] = tf.get(t, 0) + 1
        score = 0.0
        for term in q_terms:
            freq = tf.get(term)
            if not freq:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            denom = freq + k1 * (1 - b + b * doc_len[doc_id] / avgdl)
            score += idf * (freq * (k1 + 1)) / denom
        scores.append((doc_id, score))

    scores.sort(key=lambda t: t[1], reverse=True)
    return scores


def rrf_fuse(rankings: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    """Reciprocal Rank Fusion of several ranked id-lists → [(id, score)] desc.

    Each id scores sum(1 / (k + rank)) across the lists it appears in, so an
    item ranked highly by any signal rises without needing score calibration.
    """
    fused: dict[str, float] = {}
    for ranked in rankings:
        for rank, doc_id in enumerate(ranked):
            fused[doc_id] = fused.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(fused.items(), key=lambda t: t[1], reverse=True)
