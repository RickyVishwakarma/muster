"""Muster API — a self-hostable slice of an agent platform.

Surfaces: Agent Studio (agents), Knowledge base (documents), Memory & RAG +
Hallucination Manager + Orchestration (chat), Observability (traces).
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import agents, chat, documents, traces

settings = get_settings()

app = FastAPI(
    title="Muster",
    description="A self-hostable slice of an enterprise agent platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {
        "status": "ok",
        "provider": "anthropic" if settings.llm_enabled else "template",
        "model": settings.anthropic_model if settings.llm_enabled else "template-fallback",
    }


app.include_router(agents.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(traces.router)
