"""ORM models — the four primitives of a mini agent platform.

agents    → Agent Studio (a configured agent)
documents → Knowledge base (uploaded source material)
chunks    → Memory & RAG (embedded, retrievable slices; pgvector in prod)
traces    → Observability + Hallucination Manager (one row per agent run)
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    model: Mapped[str] = mapped_column(String(80), default="claude-opus-5")
    temperature: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    documents: Mapped[list[Document]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )
    traces: Mapped[list[Trace]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    agent: Mapped[Agent] = relationship(back_populates="documents")
    chunks: Mapped[list[Chunk]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    ordinal: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text)
    # Embedding stored as JSON for portability. In Postgres this becomes a
    # pgvector column and retrieval moves into the DB (ORDER BY embedding <=> q).
    embedding_json: Mapped[str] = mapped_column(Text, default="[]")

    document: Mapped[Document] = relationship(back_populates="chunks")

    @property
    def embedding(self) -> list[float]:
        return json.loads(self.embedding_json)

    @embedding.setter
    def embedding(self, value: list[float]) -> None:
        self.embedding_json = json.dumps(value)


class Trace(Base):
    __tablename__ = "traces"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text, default="")
    provider: Mapped[str] = mapped_column(String(40), default="template")
    model: Mapped[str] = mapped_column(String(80), default="")
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    retrieved_chunk_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    # Guardrail verdict: "grounded" | "ungrounded" | "no_context"
    guardrail_status: Mapped[str] = mapped_column(String(20), default="no_context")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)

    agent: Mapped[Agent] = relationship(back_populates="traces")

    @property
    def retrieved_chunk_ids(self) -> list[str]:
        return json.loads(self.retrieved_chunk_ids_json)

    @retrieved_chunk_ids.setter
    def retrieved_chunk_ids(self, value: list[str]) -> None:
        self.retrieved_chunk_ids_json = json.dumps(value)
