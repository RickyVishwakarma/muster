"""Chat — run an agent against its knowledge base."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import rag
from ..database import get_db
from ..models import Agent
from ..schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/agents/{agent_id}/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(agent_id: str, body: ChatRequest, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    payload, _trace = rag.run_chat(db, agent, body.question, body.top_k)
    return payload
