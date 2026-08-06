"""RAG orchestration: retrieve → generate → ground-check → trace.

This is the heart of the platform and where three Lyzr primitives show up:
memory/RAG (retrieval), orchestration (this pipeline), and the Hallucination
Manager (the grounding guardrail).
"""
from __future__ import annotations

import re
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import embeddings, llm, retrieval
from .models import Agent, Chunk, Document, Trace
from .schemas import Citation

# Match "chunk N" regardless of surrounding bracket style — models vary between
# [chunk 1], (chunk 1), and full-width 【chunk 1】, and grounding shouldn't
# hinge on punctuation the model happened to choose.
_CITATION_RE = re.compile(r"chunk\s*(\d+)", re.IGNORECASE)


def _retrieve(db: Session, agent_id: str, question: str, k: int) -> list[tuple[Chunk, float]]:
    """Hybrid retrieval: BM25 (lexical) fused with embedding cosine (semantic).

    Reciprocal Rank Fusion combines the two rankings, so a chunk that scores
    well on either signal surfaces — robust without calibrating either score.
    Returned scores are the fused relevance, normalized so the top chunk is 1.0.
    """
    rows = db.scalars(select(Chunk).where(Chunk.agent_id == agent_id)).all()
    if not rows:
        return []
    by_id = {c.id: c for c in rows}

    # Lexical ranking (BM25) — keeps only chunks that actually match query terms.
    bm25 = retrieval.bm25_rank(question, [(c.id, c.text) for c in rows])
    bm25_ids = [cid for cid, score in bm25 if score > 0]

    # Semantic ranking (embedding cosine).
    q_vec = embeddings.embed(question)
    sem = embeddings.top_k(q_vec, [(c.id, c.embedding) for c in rows], len(rows))
    sem_ids = [cid for cid, score in sem if score > 0]

    fused = retrieval.rrf_fuse([bm25_ids, sem_ids])
    if not fused:
        return []
    top = fused[:k]
    max_score = top[0][1] or 1.0
    return [(by_id[cid], round(score / max_score, 4)) for cid, score in top]


def _grounding_status(answer: str, retrieved: list[tuple[Chunk, float]]) -> str:
    """Mini Hallucination Manager.

    - no_context:  nothing was retrieved, so grounding can't be assessed.
    - grounded:    the answer cites at least one retrieved chunk.
    - ungrounded:  content was retrieved but the answer cites none of it.
    """
    if not retrieved:
        return "no_context"
    cited = {int(n) for n in _CITATION_RE.findall(answer)}
    available = {c.ordinal for c, _ in retrieved}
    return "grounded" if cited & available else "ungrounded"


def run_chat(db: Session, agent: Agent, question: str, top_k: int,
             created_by: str | None = None):
    """Execute one agent run and persist a trace. Returns (payload_dict, trace)."""
    started = time.perf_counter()
    retrieved = _retrieve(db, agent.id, question, top_k)

    # Build the context block with stable [chunk N] tags the model must cite.
    context_lines = [f"[chunk {c.ordinal}] {c.text}" for c, _ in retrieved]
    context_block = "\n".join(context_lines)

    result = llm.generate(
        agent_prompt=agent.system_prompt,
        model=agent.model,
        temperature=agent.temperature,
        question=question,
        context_block=context_block,
    )

    latency_ms = int((time.perf_counter() - started) * 1000)
    status = _grounding_status(result.text, retrieved)

    # Resolve filenames for citations.
    doc_names = {
        d.id: d.filename
        for d in db.scalars(select(Document).where(Document.agent_id == agent.id)).all()
    }
    citations = [
        Citation(
            chunk_id=c.id,
            ordinal=c.ordinal,
            filename=doc_names.get(c.document_id, "unknown"),
            score=round(score, 4),
            text=c.text,
        )
        for c, score in retrieved
    ]

    trace = Trace(
        agent_id=agent.id,
        question=question,
        answer=result.text,
        provider=result.provider,
        model=result.model,
        latency_ms=latency_ms,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        guardrail_status=status,
        created_by=created_by,
    )
    trace.retrieved_chunk_ids = [c.id for c, _ in retrieved]
    db.add(trace)
    db.commit()
    db.refresh(trace)

    payload = {
        "answer": result.text,
        "citations": citations,
        "guardrail_status": status,
        "provider": result.provider,
        "model": result.model,
        "latency_ms": latency_ms,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "trace_id": trace.id,
    }
    return payload, trace
