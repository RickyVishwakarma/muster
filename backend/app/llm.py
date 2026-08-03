"""LLM provider abstraction.

Two providers behind one interface:
  - "anthropic": real generation via the Anthropic API (default model
    claude-opus-5) when ANTHROPIC_API_KEY is set.
  - "template":  a deterministic, offline stand-in so the whole app — agents,
    RAG, citations, guardrail, traces — demos end to end with no key/network.

The template provider still respects the grounding contract (it answers only
from the supplied context and emits [chunk N] citations), so the guardrail and
trace views behave identically in both modes.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .config import get_settings

_SENT_RE = re.compile(r"(?<=[.!?])\s+")


@dataclass
class LLMResult:
    text: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int


def _approx_tokens(text: str) -> int:
    # Rough offline estimate (~4 chars/token). Real usage comes from the API.
    return max(1, len(text) // 4)


def _build_system(agent_prompt: str, context_block: str) -> str:
    persona = agent_prompt.strip() or "You are a helpful assistant."
    return (
        f"{persona}\n\n"
        "Answer the user's question using ONLY the context below. "
        "Cite every claim with the matching [chunk N] tag. "
        "If the context does not contain the answer, say you don't know — "
        "do not use outside knowledge.\n\n"
        f"Context:\n{context_block}"
    )


def _template_answer(question: str, context_block: str) -> str:
    """Offline stand-in: stitch the most relevant context sentences together."""
    if not context_block.strip():
        return "I don't know — no knowledge base content is available for this agent."

    q_words = set(re.findall(r"[a-z0-9]+", question.lower()))
    best: list[tuple[int, str, str]] = []  # (overlap, sentence, chunk_tag)
    for line in context_block.splitlines():
        m = re.match(r"\[(chunk \d+)\]\s*(.*)", line, re.IGNORECASE)
        if not m:
            continue
        tag, body = m.group(1), m.group(2)
        for sent in _SENT_RE.split(body):
            s_words = set(re.findall(r"[a-z0-9]+", sent.lower()))
            overlap = len(q_words & s_words)
            if overlap:
                best.append((overlap, sent.strip(), tag))

    if not best:
        return "I don't know — the knowledge base does not cover that question."

    best.sort(key=lambda t: t[0], reverse=True)
    parts = [f"{sent} [{tag}]" for _, sent, tag in best[:3]]
    return " ".join(parts)


def generate(agent_prompt: str, model: str, temperature: float,
             question: str, context_block: str) -> LLMResult:
    settings = get_settings()
    system = _build_system(agent_prompt, context_block)

    if not settings.llm_enabled:
        text = _template_answer(question, context_block)
        return LLMResult(
            text=text,
            provider="template",
            model="template-fallback",
            input_tokens=_approx_tokens(system + question),
            output_tokens=_approx_tokens(text),
        )

    # Real provider. Imported lazily so the app boots without the SDK installed.
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    resp = client.messages.create(
        model=model or settings.anthropic_model,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": question}],
    )

    # Guard against a refusal stop_reason before reading content.
    if resp.stop_reason == "refusal":
        text = "I can't answer that request."
    else:
        text = "".join(
            block.text for block in resp.content if getattr(block, "type", "") == "text"
        ).strip()

    return LLMResult(
        text=text,
        provider="anthropic",
        model=resp.model,
        input_tokens=resp.usage.input_tokens,
        output_tokens=resp.usage.output_tokens,
    )
