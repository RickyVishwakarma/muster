# Muster

A self-hostable slice of an **enterprise agent platform** — define an agent,
give it a knowledge base, chat with it, and see every run traced. Built on the
same stack an agent-infra team runs in production: **FastAPI + React + TypeScript
+ Tailwind**, SQLite locally and **Supabase / pgvector**-ready.

> Built as a focused demonstration of the core primitives behind a platform like
> Lyzr Agent Studio — **memory & RAG, a hallucination guardrail, orchestration,
> and per-run observability** — on the exact stack the Full Stack Builder role uses.

**Stack:** FastAPI · React · TypeScript · Tailwind · SQLAlchemy · SQLite→Supabase/pgvector

---

## What it demonstrates

| Platform primitive | In this app |
| --- | --- |
| **Agent Studio** | CRUD UI to define an agent (name, system prompt, model) |
| **Memory & RAG** | Upload docs → chunk → embed → retrieve top-K per question |
| **Hallucination Manager** | A grounding guardrail that verifies the answer cites retrieved context, flagging `ungrounded` answers |
| **Orchestration** | The retrieve → generate → ground-check → trace pipeline (`rag.py`) |
| **Observability** | Per-run traces: latency, token usage, provider/model, guardrail verdict |
| **Provider pipeline** | Anthropic (`claude-opus-5`) with a deterministic offline fallback |

---

## Architecture

```
Frontend (React + TS + Tailwind, Vite)
  Agents page ──┐
  Chat page  ───┼──▶  api.ts  ──HTTP/JSON──▶  FastAPI backend
  Traces page ──┘                              ├─ /agents      (Agent Studio)
                                               ├─ /documents   (Knowledge base)
                                               ├─ /chat  ──▶ rag.py
                                               │              ├─ embeddings.py  (retrieve)
                                               │              ├─ llm.py         (generate: Anthropic | template)
                                               │              └─ guardrail      (ground-check)
                                               └─ /traces      (Observability)
                                                     │
                                          SQLAlchemy: agents · documents · chunks(+vector) · traces
                                          (SQLite by default → point DATABASE_URL at Supabase/pgvector)
```

**The chat path:** embed the question → cosine-rank the agent's chunks → inject
top-K into a system prompt that forces `[chunk N]` citations → generate → verify
the answer cites retrieved chunks (guardrail) → persist a trace → return answer +
citations + metrics.

---

## Run it locally

Runs end to end **with no API key** — the LLM layer falls back to a deterministic
template provider so you can demo the whole flow offline.

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash;  use .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # optional: add ANTHROPIC_API_KEY for real generation
uvicorn app.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs.

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the backend on port 8000.

### 3. Try it

1. Create an agent on the **Agents** tab.
2. Open it, upload a `.txt` / `.md` / `.pdf` to its knowledge base.
3. Ask a question — see the answer, its citations, and the guardrail badge.
4. Check the **Traces** tab for latency, tokens, and the grounding verdict.

---

## Configuration

| Env var (backend) | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | _(empty)_ | When set, real generation via Anthropic; otherwise offline template mode |
| `ANTHROPIC_MODEL` | `claude-opus-5` | Chat model (`claude-haiku-4-5` for a cheaper demo) |
| `DATABASE_URL` | `sqlite:///./muster.db` | Swap to `postgresql+psycopg://…` for Supabase/Postgres |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins |

---

## Production path (unchanged interfaces)

- **Database** → set `DATABASE_URL` to a Supabase connection string. Retrieval is
  isolated in `embeddings.py`; move it into a pgvector `ORDER BY embedding <=> q`
  query without touching the routers.
- **Embeddings** → the offline hashing embedding lives behind `embed()`; swap in a
  real embedding model via the same function.
- **Observability** → `traces` mirrors an OpenTelemetry span; export to an OTel
  collector by emitting a span alongside each trace insert.

---

## Roadmap (stretch primitives)

- Multi-agent **SuperFlow** (researcher → writer with a human-approval step)
- **Simulation Engine** — batch-run an agent against N test questions, pass/fail
- **Policy Engine** — role-based access (admin vs viewer) on agents
