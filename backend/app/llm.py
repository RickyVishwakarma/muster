"""LLM provider abstraction.

Four providers behind one interface, selected by config.active_provider (an
explicit LLM_PROVIDER override, else auto by key: Anthropic → Gemini →
OpenRouter → template):
  - "anthropic":  Anthropic API (default model claude-opus-5).
  - "gemini":     Google Gemini via the REST API (stdlib only, no SDK dep).
  - "openrouter": OpenRouter's OpenAI-compatible endpoint (stdlib only) — gives
    access to many models, including free ones.
  - "template":   a deterministic, offline stand-in so the whole app — agents,
    RAG, citations, guardrail, traces — demos end to end with no key/network.

Every provider gets the same grounding system prompt (answer only from context,
emit [chunk N] citations) plus any prior conversation turns as `history`, so
follow-up questions keep context.
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass

from .config import get_settings

# A conversation history: list of (user_question, assistant_answer) prior turns.
History = list[tuple[str, str]]

_SENT_RE = re.compile(r"(?<=[.!?])\s+")
_GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)
_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


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
        "do not use outside knowledge. Prior turns are for continuity; still "
        "ground each answer in the context.\n\n"
        f"Context:\n{context_block}"
    )


def _openai_messages(system: str, history: History, question: str) -> list[dict]:
    """OpenAI/OpenRouter-style message list with a system turn + history."""
    messages: list[dict] = [{"role": "system", "content": system}]
    for user_q, assistant_a in history:
        messages.append({"role": "user", "content": user_q})
        messages.append({"role": "assistant", "content": assistant_a})
    messages.append({"role": "user", "content": question})
    return messages


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


def _anthropic_generate(system: str, model: str, question: str, history: History) -> LLMResult:
    import anthropic  # lazy import so the app boots without the SDK

    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    messages: list[dict] = []
    for user_q, assistant_a in history:
        messages.append({"role": "user", "content": user_q})
        messages.append({"role": "assistant", "content": assistant_a})
    messages.append({"role": "user", "content": question})

    resp = client.messages.create(
        model=model or settings.anthropic_model,
        max_tokens=1024,
        system=system,
        messages=messages,
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


def _gemini_generate(
    system: str, model: str, temperature: float, question: str, history: History
) -> LLMResult:
    """Call the Gemini REST API using only the standard library."""
    settings = get_settings()
    model_id = model if (model or "").startswith("gemini") else settings.gemini_model
    url = _GEMINI_ENDPOINT.format(model=model_id)
    contents: list[dict] = []
    for user_q, assistant_a in history:
        contents.append({"role": "user", "parts": [{"text": user_q}]})
        contents.append({"role": "model", "parts": [{"text": assistant_a}]})
    contents.append({"role": "user", "parts": [{"text": question}]})

    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": contents,
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


def _openrouter_generate(
    system: str, model: str, temperature: float, question: str, history: History
) -> LLMResult:
    """Call OpenRouter's OpenAI-compatible chat endpoint using only the stdlib."""
    settings = get_settings()
    model_id = model if "/" in (model or "") else settings.openrouter_model
    body = {
        "model": model_id,
        "messages": _openai_messages(system, history, question),
        "temperature": temperature,
        "max_tokens": 1024,
    }
    req = urllib.request.Request(
        _OPENROUTER_ENDPOINT,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            # Optional attribution headers OpenRouter recommends.
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Muster",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode())

    choices = data.get("choices", [])
    text = (choices[0].get("message", {}).get("content", "") if choices else "").strip()
    if not text:
        text = "I can't answer that request."

    usage = data.get("usage", {})
    return LLMResult(
        text=text,
        provider="openrouter",
        model=data.get("model", model_id),
        input_tokens=usage.get("prompt_tokens", _approx_tokens(system + question)),
        output_tokens=usage.get("completion_tokens", _approx_tokens(text)),
    )


def generate(agent_prompt: str, model: str, temperature: float,
             question: str, context_block: str,
             history: History | None = None) -> LLMResult:
    settings = get_settings()
    system = _build_system(agent_prompt, context_block)
    history = history or []
    provider = settings.active_provider

    if provider == "anthropic":
        return _anthropic_generate(system, model, question, history)

    if provider == "gemini":
        try:
            return _gemini_generate(system, model, temperature, question, history)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            return LLMResult(
                text=f"[gemini error {e.code}] {detail}",
                provider="gemini",
                model=settings.gemini_model,
                input_tokens=_approx_tokens(system + question),
                output_tokens=0,
            )

    if provider == "openrouter":
        try:
            return _openrouter_generate(system, model, temperature, question, history)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            return LLMResult(
                text=f"[openrouter error {e.code}] {detail}",
                provider="openrouter",
                model=settings.openrouter_model,
                input_tokens=_approx_tokens(system + question),
                output_tokens=0,
            )

    # template fallback (history not needed — answers purely from context)
    text = _template_answer(question, context_block)
    return LLMResult(
        text=text,
        provider="template",
        model="template-fallback",
        input_tokens=_approx_tokens(system + question),
        output_tokens=_approx_tokens(text),
    )
