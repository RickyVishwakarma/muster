"""Chat — run an agent against its knowledge base, within a conversation."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import rag
from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, Conversation, Trace, User
from ..schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/agents/{agent_id}/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(
    agent_id: str,
    body: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agent = db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Resolve the conversation: continue an existing one, or start a new one.
    if body.conversation_id:
        conv = db.get(Conversation, body.conversation_id)
        if conv is None or conv.agent_id != agent_id:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = Conversation(
            agent_id=agent_id, created_by=user.id, title=body.question[:200]
        )
        db.add(conv)
        db.flush()  # assign conv.id before we reference it

    # Prior turns in this conversation become the model's history.
    prior = db.scalars(
        select(Trace)
        .where(Trace.conversation_id == conv.id)
        .order_by(Trace.created_at)
    ).all()
    history = [(t.question, t.answer) for t in prior]

    payload, _trace = rag.run_chat(
        db,
        agent,
        body.question,
        body.top_k,
        created_by=user.id,
        conversation_id=conv.id,
        history=history,
    )

    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    return payload
