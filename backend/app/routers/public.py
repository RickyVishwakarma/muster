"""Public agent API.

The endpoint external apps call to use a published agent. Authenticated by the
agent's own API key (header `X-Agent-Key`) — no user login. This is what makes
Muster an agent *backend*: build an agent in the studio, publish it, then call
this from your product's code or a website widget.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import rag
from ..database import get_db
from ..models import Agent
from ..schemas import PublicAskRequest, PublicAskResponse

router = APIRouter(prefix="/public", tags=["public"])


def _agent_from_key(agent_id: str, key: str | None, db: Session) -> Agent:
    agent = db.get(Agent, agent_id)
    if agent is None or not agent.api_key:
        # Don't reveal whether the agent exists — just "not published/unauthorized".
        raise HTTPException(status_code=404, detail="Agent not found or not published")
    if not key or key != agent.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Agent-Key")
    return agent


@router.post("/agents/{agent_id}/ask", response_model=PublicAskResponse)
def ask(
    agent_id: str,
    body: PublicAskRequest,
    db: Session = Depends(get_db),
    x_agent_key: str | None = Header(default=None, alias="X-Agent-Key"),
):
    agent = _agent_from_key(agent_id, x_agent_key, db)
    payload, _trace = rag.run_chat(
        db, agent, body.question, body.top_k, created_by=None,
        conversation_id=None, history=[],
    )
    return PublicAskResponse(
        answer=payload["answer"],
        citations=payload["citations"],
        tools_used=payload["tools_used"],
        guardrail_status=payload["guardrail_status"],
        model=payload["model"],
    )
