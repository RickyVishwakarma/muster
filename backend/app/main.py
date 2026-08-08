"""Muster API — a self-hostable slice of an agent platform.

Surfaces: Agent Studio (agents), Knowledge base (documents), Memory & RAG +
Hallucination Manager + Orchestration (chat), Observability (traces).
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse

from .config import get_settings
from .database import init_db
from .routers import agents, auth, chat, conversations, documents, public, stats, traces

settings = get_settings()
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

app = FastAPI(
    title="Muster",
    description="A self-hostable slice of an enterprise agent platform.",
    version="0.1.0",
)

# Allow any origin: the app authenticates with bearer tokens (dashboard) and
# per-agent API keys (public), not cookies — so credential-less "*" is safe and
# lets the embeddable widget call the public API from any customer website.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {
        "status": "ok",
        "provider": settings.active_provider,
        "model": settings.active_model,
    }


@app.get("/widget.js", include_in_schema=False)
def widget_js():
    """The embeddable chat widget script."""
    return FileResponse(
        os.path.join(_STATIC_DIR, "widget.js"),
        media_type="application/javascript",
    )


@app.get("/widget-demo", include_in_schema=False, response_class=HTMLResponse)
def widget_demo(agent: str = "", key: str = ""):
    """A sample page that embeds the widget — for previewing a published agent."""
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Widget preview · Muster</title>
<style>
  body{{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0a0a0a;background:#fff}}
  .wrap{{max-width:640px;margin:0 auto;padding:80px 24px}}
  h1{{font-size:28px;margin:0 0 8px}} p{{color:#6b7280;line-height:1.6}}
  .card{{margin-top:24px;border:1px solid #e5e5e5;border-radius:12px;padding:20px}}
</style></head>
<body>
  <div class="wrap">
    <h1>Your website</h1>
    <p>This is a sample page to preview the Muster chat widget. Look for the
       chat bubble in the bottom-right corner — click it and ask your agent
       something. On your real site, the same one line of code does this.</p>
    <div class="card"><p style="margin:0">Imagine your product's content here.
       The widget floats above it and never touches your page's styles.</p></div>
  </div>
  <script src="/widget.js" data-agent="{agent}" data-key="{key}"
          data-title="Ask our assistant"></script>
</body></html>"""


app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(traces.router)
app.include_router(stats.router)
app.include_router(public.router)
