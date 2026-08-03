"""Document ingestion — the knowledge base / memory surface.

Accepts a .txt/.md/.pdf upload, splits it into overlapping chunks, embeds each,
and stores them for retrieval. This is the "add to memory" step.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import embeddings
from ..database import get_db
from ..models import Agent, Chunk, Document
from ..schemas import DocumentIngestResult, DocumentOut

router = APIRouter(prefix="/agents/{agent_id}/documents", tags=["documents"])


def _extract_text(file: UploadFile, raw: bytes) -> str:
    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        import io

        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(raw))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    # Treat everything else as UTF-8 text (.txt, .md, ...).
    return raw.decode("utf-8", errors="replace")


@router.get("", response_model=list[DocumentOut])
def list_documents(agent_id: str, db: Session = Depends(get_db)):
    if db.get(Agent, agent_id) is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return db.scalars(
        select(Document).where(Document.agent_id == agent_id).order_by(Document.created_at.desc())
    ).all()


@router.post("", response_model=DocumentIngestResult, status_code=201)
async def ingest_document(
    agent_id: str, file: UploadFile, db: Session = Depends(get_db)
):
    if db.get(Agent, agent_id) is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    raw = await file.read()
    text = _extract_text(file, raw).strip()
    if not text:
        raise HTTPException(status_code=400, detail="No extractable text in file")

    doc = Document(agent_id=agent_id, filename=file.filename or "untitled")
    db.add(doc)
    db.flush()  # assign doc.id before creating chunks

    # Continue ordinal numbering across the agent's existing chunks so [chunk N]
    # tags stay unique per agent.
    existing = db.scalars(select(Chunk).where(Chunk.agent_id == agent_id)).all()
    next_ordinal = (max((c.ordinal for c in existing), default=0)) + 1

    pieces = embeddings.chunk_text(text)
    for i, piece in enumerate(pieces):
        chunk = Chunk(
            document_id=doc.id,
            agent_id=agent_id,
            ordinal=next_ordinal + i,
            text=piece,
        )
        chunk.embedding = embeddings.embed(piece)
        db.add(chunk)

    db.commit()
    db.refresh(doc)
    return DocumentIngestResult(document=DocumentOut.model_validate(doc), chunks_created=len(pieces))


@router.delete("/{document_id}", status_code=204)
def delete_document(agent_id: str, document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if doc is None or doc.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
