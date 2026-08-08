"""Pydantic request/response models."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---- Auth / users ---------------------------------------------------------
class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=6, max_length=200)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: str
    created_at: datetime


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|member)$")


# ---- Agents ---------------------------------------------------------------
class ToolConfig(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    type: str = Field(default="builtin", pattern="^(builtin|http)$")
    description: str = ""
    url: str | None = None
    method: str = "GET"


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    system_prompt: str = ""
    model: str = "claude-opus-5"
    temperature: float = 0.0
    tools: list[ToolConfig] = []


class AgentUpdate(BaseModel):
    name: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    temperature: float | None = None
    tools: list[ToolConfig] | None = None


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    system_prompt: str
    model: str
    temperature: float
    tools: list[ToolConfig] = []
    created_by: str | None = None
    created_by_name: str | None = None
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


class TextDocumentIn(BaseModel):
    text: str = Field(min_length=1)
    title: str | None = Field(default=None, max_length=255)


# ---- Chat -----------------------------------------------------------------
class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=10)
    # Omit to start a new conversation; pass one to continue it.
    conversation_id: str | None = None


class Citation(BaseModel):
    chunk_id: str
    ordinal: int
    filename: str
    score: float
    text: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    tools_used: list[str] = []
    guardrail_status: str
    provider: str
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    trace_id: str
    conversation_id: str


# ---- Conversations --------------------------------------------------------
class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_id: str
    title: str
    created_by: str | None = None
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ConversationTurn(BaseModel):
    """One question/answer exchange in a conversation (a Trace, chat-shaped)."""

    trace_id: str
    question: str
    answer: str
    guardrail_status: str
    citations: list[Citation] = []
    tools_used: list[str] = []
    created_at: datetime


class ConversationDetail(ConversationOut):
    turns: list[ConversationTurn] = []


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
    tools_used: list[str] = []
    created_by: str | None = None
    created_by_name: str | None = None
    created_at: datetime
