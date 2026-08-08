"""RAG orchestration: retrieve → generate → ground-check → trace.

This is the heart of the platform and where three Lyzr primitives show up:
memory/RAG (retrieval), orchestration (this pipeline), and the Hallucination
Manager (the grounding guardrail).
"""
from __future__ import annotations

import json
import re
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import embeddings, llm, retrieval, tools
from .models import Agent, Chunk, Document, Trace
from .schemas import Citation

# Match "chunk N" regardless of surrounding bracket style — models vary between
# [chunk 1], (chunk 1), and full-width 【chunk 1】, and grounding shouldn't
# hinge on punctuation the model happened to choose.
_CITATION_RE = re.compile(r"chunk\s*(\d+)", re.IGNORECASE)

# Flat JSON object, e.g. {"tool": "calculator", "input": "2+2"}.
_ACTION_RE = re.compile(r"\{[^{}]*\}", re.DOTALL)

_MAX_TOOL_STEPS = 4


def _build_tools_prompt(agent_tools: list[dict]) -> str:
    if not agent_tools:
        return ""
    lines = [
        "You can use tools. When a tool would help, reply with ONLY a JSON "
        'object (no other text): {"tool": "<name>", "input": "<string>"}. '
        "You will then be given the tool's result; use it to answer. "
        "Available tools:",
    ]
    for t in agent_tools:
        lines.append(f'- {t.get("name")}: {tools.describe(t)}')
    return "\n".join(lines)


def _parse_action(text: str, agent_tools: list[dict]) -> tuple[str, str] | None:
    """Return (tool_name, input) if the model asked for an enabled tool."""
    valid = {t.get("name") for t in agent_tools}
    for match in _ACTION_RE.finditer(text):
        try:
            obj = json.loads(match.group(0))
        except Exception:
            continue
        if isinstance(obj, dict) and obj.get("tool") in valid:
            return str(obj["tool"]), str(obj.get("input", ""))
    return None


def _run_agent_loop(agent: Agent, question: str, context_block: str, history):
    """Generate an answer, letting the agent call tools in a loop.

    Returns (result, tools_used). With no tools (or the template provider) this
    is a single generate() call, so behaviour is unchanged for plain RAG agents.
    """
    tools_prompt = _build_tools_prompt(agent.tools)
    tools_used: list[str] = []
    scratchpad = ""
    total_in = total_out = 0
    result = None

    for _ in range(_MAX_TOOL_STEPS):
        prompt_q = question if not scratchpad else f"{question}\n{scratchpad}"
        result = llm.generate(
            agent_prompt=agent.system_prompt,
            model=agent.model,
            temperature=agent.temperature,
            question=prompt_q,
            context_block=context_block,
            history=history,
            tools_prompt=tools_prompt,
        )
        total_in += result.input_tokens
        total_out += result.output_tokens
        action = _parse_action(result.text, agent.tools) if agent.tools else None
        if action is None:
            break
        name, tool_input = action
        observation = tools.execute(name, tool_input, agent.tools)
        tools_used.append(name)
        scratchpad += (
            f'\n[You called tool "{name}" with input "{tool_input}". '
            f"Result: {observation}]\n"
            "Now answer the user's question using this result. If you need "
            "another tool, reply with another tool JSON."
        )

    final = llm.LLMResult(
        text=result.text,
        provider=result.provider,
        model=result.model,
        input_tokens=total_in,
        output_tokens=total_out,
    )
    return final, tools_used


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
             created_by: str | None = None,
             conversation_id: str | None = None,
             history: list[tuple[str, str]] | None = None):
    """Execute one agent run and persist a trace. Returns (payload_dict, trace).

    ``history`` is prior (question, answer) turns in the same conversation; it is
    passed to the model for continuity and used to widen retrieval on follow-ups.
    """
    started = time.perf_counter()
    history = history or []

    # Follow-ups like "what about contractors?" retrieve poorly alone — widen
    # the retrieval query with the previous question for topical continuity.
    retrieval_query = f"{history[-1][0]} {question}" if history else question
    retrieved = _retrieve(db, agent.id, retrieval_query, top_k)

    # Build the context block with stable [chunk N] tags the model must cite.
    context_lines = [f"[chunk {c.ordinal}] {c.text}" for c, _ in retrieved]
    context_block = "\n".join(context_lines)

    result, tools_used = _run_agent_loop(agent, question, context_block, history)

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
        conversation_id=conversation_id,
    )
    trace.retrieved_chunk_ids = [c.id for c, _ in retrieved]
    trace.tools_used = tools_used
    db.add(trace)
    db.commit()
    db.refresh(trace)

    payload = {
        "answer": result.text,
        "citations": citations,
        "tools_used": tools_used,
        "guardrail_status": status,
        "provider": result.provider,
        "model": result.model,
        "latency_ms": latency_ms,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "trace_id": trace.id,
        "conversation_id": conversation_id,
    }
    return payload, trace
