"""Document ingestion — the knowledge base / memory surface.

Add source material either by uploading a .txt/.md/.pdf file or by pasting text
directly. Either way it's split into chunks, embedded, and stored for retrieval.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import embeddings
from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, Chunk, Document, User
from ..schemas import DocumentIngestResult, DocumentOut, TextDocumentIn

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


def _ingest_text(db: Session, agent_id: str, filename: str, text: str) -> DocumentIngestResult:
    """Chunk, embed, and store `text` as a document under `agent_id`."""
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text to add")

    doc = Document(agent_id=agent_id, filename=filename or "pasted-text")
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
    return DocumentIngestResult(
        document=DocumentOut.model_validate(doc), chunks_created=len(pieces)
    )


@router.get("", response_model=list[DocumentOut])
def list_documents(
    agent_id: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)
):
    if db.get(Agent, agent_id) is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return db.scalars(
        select(Document).where(Document.agent_id == agent_id).order_by(Document.created_at.desc())
    ).all()


@router.post("", response_model=DocumentIngestResult, status_code=201)
async def ingest_document(
    agent_id: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Add a document from an uploaded file (.txt / .md / .pdf)."""
    if db.get(Agent, agent_id) is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    raw = await file.read()
    text = _extract_text(file, raw)
    if not text.strip():
        raise HTTPException(status_code=400, detail="No extractable text in file")
    return _ingest_text(db, agent_id, file.filename or "untitled", text)


@router.post("/text", response_model=DocumentIngestResult, status_code=201)
def ingest_text(
    agent_id: str,
    body: TextDocumentIn,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Add a document by pasting text directly (no file needed)."""
    if db.get(Agent, agent_id) is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _ingest_text(db, agent_id, body.title or "pasted-text", body.text)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    agent_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if doc is None or doc.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
