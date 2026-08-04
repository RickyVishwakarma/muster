"""LLM provider abstraction.

Three providers behind one interface, selected by which key is configured
(Anthropic → Gemini → template; see config.active_provider):
  - "anthropic": Anthropic API (default model claude-opus-5).
  - "gemini":    Google Gemini via the REST API (stdlib only, no SDK dep).
  - "template":  a deterministic, offline stand-in so the whole app — agents,
    RAG, citations, guardrail, traces — demos end to end with no key/network.

Every provider gets the same grounding system prompt (answer only from context,
emit [chunk N] citations), so the guardrail and trace views behave identically.
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass

from .config import get_settings

_SENT_RE = re.compile(r"(?<=[.!?])\s+")
_GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)


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


def _anthropic_generate(system: str, model: str, question: str) -> LLMResult:
    import anthropic  # lazy import so the app boots without the SDK

    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    resp = client.messages.create(
        model=model or settings.anthropic_model,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": question}],
    )
    if resp.stop_reason == "refusal":
        text = "I can't answer that request."
    else:
        text = "".join(
            b.text for b in resp.content if getattr(b, "type", "") == "text"
        ).strip()
    return LLMResult(
        text=text,
        provider="anthropic",
        model=resp.model,
        input_tokens=resp.usage.input_tokens,
        output_tokens=resp.usage.output_tokens,
    )


def _gemini_generate(system: str, model: str, temperature: float, question: str) -> LLMResult:
    """Call the Gemini REST API using only the standard library."""
    settings = get_settings()
    model_id = model if (model or "").startswith("gemini") else settings.gemini_model
    url = _GEMINI_ENDPOINT.format(model=model_id)
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": question}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 1024},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": settings.gemini_api_key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode())

    candidates = data.get("candidates", [])
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        # e.g. safety block or empty candidate — surface a stable message.
        text = "I can't answer that request."

    usage = data.get("usageMetadata", {})
    return LLMResult(
        text=text,
        provider="gemini",
        model=model_id,
        input_tokens=usage.get("promptTokenCount", _approx_tokens(system + question)),
        output_tokens=usage.get("candidatesTokenCount", _approx_tokens(text)),
    )


def generate(agent_prompt: str, model: str, temperature: float,
             question: str, context_block: str) -> LLMResult:
    settings = get_settings()
    system = _build_system(agent_prompt, context_block)
    provider = settings.active_provider

    if provider == "anthropic":
        return _anthropic_generate(system, model, question)

    if provider == "gemini":
        try:
            return _gemini_generate(system, model, temperature, question)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            return LLMResult(
                text=f"[gemini error {e.code}] {detail}",
                provider="gemini",
                model=settings.gemini_model,
                input_tokens=_approx_tokens(system + question),
                output_tokens=0,
            )

    # template fallback
    text = _template_answer(question, context_block)
    return LLMResult(
        text=text,
        provider="template",
        model="template-fallback",
        input_tokens=_approx_tokens(system + question),
        output_tokens=_approx_tokens(text),
    )
