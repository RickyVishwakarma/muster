"""Pydantic request/response models."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---- Agents ---------------------------------------------------------------
class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    system_prompt: str = ""
    model: str = "claude-opus-5"
    temperature: float = 0.0


class AgentUpdate(BaseModel):
    name: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    temperature: float | None = None


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    system_prompt: str
    model: str
    temperature: float
    created_at: datetime


# ---- Documents ------------------------------------------------------------
class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_id: str
    filename: str
    created_at: datetime


class DocumentIngestResult(BaseModel):
    document: DocumentOut
    chunks_created: int


# ---- Chat -----------------------------------------------------------------
class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=10)


class Citation(BaseModel):
    chunk_id: str
    ordinal: int
    filename: str
    score: float
    text: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    guardrail_status: str
    provider: str
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    trace_id: str


# ---- Traces ---------------------------------------------------------------
class TraceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_id: str
    question: str
    answer: str
    provider: str
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    guardrail_status: str
    created_at: datetime
