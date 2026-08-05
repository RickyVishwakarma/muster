"""Agent CRUD — the Agent Studio surface. Agents are shared across the team."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, User
from ..schemas import AgentCreate, AgentOut, AgentUpdate

router = APIRouter(prefix="/agents", tags=["agents"])


def _get_or_404(db: Session, agent_id: str) -> Agent:
    agent = db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.get("", response_model=list[AgentOut])
def list_agents(
    db: Session = Depends(get_db), _user: User = Depends(get_current_user)
):
    return db.scalars(select(Agent).order_by(Agent.created_at.desc())).all()


@router.post("", response_model=AgentOut, status_code=201)
def create_agent(
    body: AgentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agent = Agent(**body.model_dump(), created_by=user.id)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(
    agent_id: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)
):
    return _get_or_404(db, agent_id)


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: str,
    body: AgentUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    agent = _get_or_404(db, agent_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=204)
def delete_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agent = _get_or_404(db, agent_id)
    # Only an admin or the agent's creator may delete it.
    if user.role != "admin" and agent.created_by not in (None, user.id):
        raise HTTPException(
            status_code=403, detail="Only an admin or the creator can delete this agent"
        )
    db.delete(agent)
    db.commit()
