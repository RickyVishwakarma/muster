"""End-to-end smoke test of the Muster pipeline (template/offline mode).

Verifies: auth (register→admin, protected routes reject anon), agent CRUD,
document ingest+embed, chat with RAG + citations + grounding guardrail, and
trace persistence with creator attribution. Uses a fresh temp DB.
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

    # Protected routes must reject anonymous callers.
    assert c.get("/agents").status_code == 401, "agents must require auth"
    print("anonymous access blocked: 401")

    # First registered user becomes the admin.
    reg = c.post(
        "/auth/register",
        json={"email": "founder@acme.com", "name": "Founder", "password": "secret123"},
    )
    assert reg.status_code == 201, reg.text
    body = reg.json()
    assert body["user"]["role"] == "admin", body
    token = body["token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    print("registered admin:", body["user"]["email"], "| role:", body["user"]["role"])

    agent = c.post(
        "/agents", json={"name": "Policy Bot", "system_prompt": "Answer HR questions."}
    ).json()
    aid = agent["id"]
    assert agent["created_by_name"] == "Founder", agent
    print("agent:", agent["name"], "| by:", agent["created_by_name"])

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
    assert traces[0]["created_by_name"] == "Founder", traces[0]
    print("trace:", traces[0]["guardrail_status"], "| asked by:", traces[0]["created_by_name"])

    # Multi-turn: the first chat opened a conversation; continue it.
    cid = r["conversation_id"]
    assert cid, r
    follow = c.post(
        f"/agents/{aid}/chat",
        json={"question": "and how many vacation days?", "conversation_id": cid},
    ).json()
    assert follow["conversation_id"] == cid, follow
    detail = c.get(f"/conversations/{cid}").json()
    assert len(detail["turns"]) == 2, detail
    convs = c.get(f"/agents/{aid}/conversations").json()
    assert any(cv["id"] == cid for cv in convs), convs
    print("conversation:", cid, "| turns:", len(detail["turns"]))

    # Second user registers as a plain member and cannot list the team.
    reg2 = c.post(
        "/auth/register",
        json={"email": "member@acme.com", "name": "Member", "password": "secret123"},
    ).json()
    assert reg2["user"]["role"] == "member", reg2
    member_headers = {"Authorization": f"Bearer {reg2['token']}"}
    assert c.get("/auth/users", headers=member_headers).status_code == 403
    assert c.get("/auth/users").status_code == 200  # admin still set on client
    print("second user is member; admin-only route blocked for member")

print("\nALL CHECKS PASSED")
