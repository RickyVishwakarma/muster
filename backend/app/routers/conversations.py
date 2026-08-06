"""Conversations — list chats per agent and replay a chat's turns."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, Chunk, Conversation, Document, Trace, User
from ..schemas import (
    Citation,
    ConversationDetail,
    ConversationOut,
    ConversationTurn,
)

router = APIRouter(tags=["conversations"])


def _turn_from_trace(db: Session, trace: Trace) -> ConversationTurn:
    """Rebuild a turn (with its citations) from a persisted Trace."""
    chunk_ids = trace.retrieved_chunk_ids
    citations: list[Citation] = []
    if chunk_ids:
        chunks = {
            c.id: c
            for c in db.scalars(select(Chunk).where(Chunk.id.in_(chunk_ids))).all()
        }
        doc_names = {
            d.id: d.filename
            for d in db.scalars(
                select(Document).where(Document.agent_id == trace.agent_id)
            ).all()
        }
        for cid in chunk_ids:  # stored in ranked order
            c = chunks.get(cid)
            if c is None:
                continue
            citations.append(
                Citation(
                    chunk_id=c.id,
                    ordinal=c.ordinal,
                    filename=doc_names.get(c.document_id, "unknown"),
                    score=0.0,  # per-turn scores aren't persisted; order is preserved
                    text=c.text,
                )
            )
    return ConversationTurn(
        trace_id=trace.id,
        question=trace.question,
        answer=trace.answer,
        guardrail_status=trace.guardrail_status,
        citations=citations,
        created_at=trace.created_at,
    )


@router.get("/agents/{agent_id}/conversations", response_model=list[ConversationOut])
def list_conversations(
    agent_id: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)
):
    if db.get(Agent, agent_id) is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return db.scalars(
        select(Conversation)
        .where(Conversation.agent_id == agent_id)
        .order_by(Conversation.updated_at.desc())
    ).all()


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    traces = db.scalars(
        select(Trace)
        .where(Trace.conversation_id == conv.id)
        .order_by(Trace.created_at)
    ).all()
    detail = ConversationDetail.model_validate(conv)
    detail.turns = [_turn_from_trace(db, t) for t in traces]
    return detail


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # Keep the traces (they're the audit log) but unlink them from the conversation.
    db.execute(
        update(Trace)
        .where(Trace.conversation_id == conv.id)
        .values(conversation_id=None)
    )
    db.delete(conv)
    db.commit()
