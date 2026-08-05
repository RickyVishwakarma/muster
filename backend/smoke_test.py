"""End-to-end smoke test of the Muster pipeline (template/offline mode).

Verifies: health, agent CRUD, document ingest+embed, chat with RAG + citations
+ grounding guardrail, and trace persistence. Uses a fresh temp DB.
"""
import os
import tempfile

# Force offline template mode + throwaway DB before importing the app.
# LLM_PROVIDER=template overrides any real key in .env so the test is hermetic
# (env vars take priority over the .env file in pydantic-settings).
os.environ["LLM_PROVIDER"] = "template"
os.environ["ANTHROPIC_API_KEY"] = ""
_db = os.path.join(tempfile.gettempdir(), "muster_smoke.db")
if os.path.exists(_db):
    os.remove(_db)
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

# Context manager fires the startup event (init_db). Plain TestClient(app) won't.
with TestClient(app) as c:
    h = c.get("/health").json()
    assert h["status"] == "ok", h
    print("health:", h)

    agent = c.post(
        "/agents", json={"name": "Policy Bot", "system_prompt": "Answer HR questions."}
    ).json()
    aid = agent["id"]
    print("agent:", agent["name"], aid)

    doc = (
        "The parental leave policy grants 26 weeks of paid leave. "
        "Employees accrue 20 vacation days per year."
    )
    files = {"file": ("policy.txt", doc, "text/plain")}
    ing = c.post(f"/agents/{aid}/documents", files=files).json()
    assert ing["chunks_created"] >= 1, ing
    print("ingested chunks:", ing["chunks_created"])

    r = c.post(
        f"/agents/{aid}/chat", json={"question": "How many weeks of parental leave?"}
    ).json()
    print("answer:", r["answer"])
    print("guardrail:", r["guardrail_status"], "| citations:", len(r["citations"]))
    assert r["citations"], "expected at least one citation"
    assert r["guardrail_status"] in {"grounded", "ungrounded"}, r

    traces = c.get("/traces").json()
    assert len(traces) == 1, traces
    print("trace:", traces[0]["guardrail_status"], traces[0]["latency_ms"], "ms")

    r2 = c.post(
        f"/agents/{aid}/chat", json={"question": "What is the stock price of Tesla?"}
    ).json()
    print("off-topic answer:", r2["answer"][:80])

print("\nALL CHECKS PASSED")
