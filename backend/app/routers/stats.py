"""Workspace stats for the dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, Conversation, Document, Trace, User

router = APIRouter(tags=["stats"])


@router.get("/stats")
def stats(db: Session = Depends(get_db), _user: User = Depends(get_current_user)) -> dict:
    def count(model) -> int:
        return db.scalar(select(func.count()).select_from(model)) or 0

    return {
        "agents": count(Agent),
        "documents": count(Document),
        "conversations": count(Conversation),
        "runs": count(Trace),
        "members": count(User),
    }
