"""Traces — the observability surface (latency, tokens, guardrail per run)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Trace
from ..schemas import TraceOut

router = APIRouter(prefix="/traces", tags=["traces"])


@router.get("", response_model=list[TraceOut])
def list_traces(
    agent_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(Trace).order_by(Trace.created_at.desc()).limit(limit)
    if agent_id:
        stmt = stmt.where(Trace.agent_id == agent_id)
    return db.scalars(stmt).all()


@router.get("/{trace_id}", response_model=TraceOut)
def get_trace(trace_id: str, db: Session = Depends(get_db)):
    trace = db.get(Trace, trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace
