import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type {
  Agent,
  Citation,
  Conversation,
  DocumentOut,
  GuardrailStatus,
} from "../types";

// Monochrome guardrail badges: filled = grounded, outlined = ungrounded, soft = no context.
const guardStyles: Record<GuardrailStatus, string> = {
  grounded: "bg-ink text-white border-ink",
  ungrounded: "bg-white text-ink border-ink",
  no_context: "bg-soft text-muted border-line",
};

interface UiTurn {
  question: string;
  answer: string;
  guardrail: GuardrailStatus | null;
  citations: Citation[];
  tools?: string[];
  pending?: boolean;
  meta?: { provider: string; model: string; latency_ms: number };
}

export default function ChatPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [docs, setDocs] = useState<DocumentOut[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [turns, setTurns] = useState<UiTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadDocs = () => {
    if (agentId) api.listDocuments(agentId).then(setDocs);
  };
  const loadConversations = () => {
    if (agentId) api.listConversations(agentId).then(setConversations);
  };

  useEffect(() => {
    if (!agentId) return;
    api.getAgent(agentId).then(setAgent).catch((e) => setError(String(e)));
    loadDocs();
    loadConversations();
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  function newChat() {
    setCurrentId(null);
    setTurns([]);
    setError(null);
  }

  async function openConversation(id: string) {
    setError(null);
    try {
      const detail = await api.getConversation(id);
      setCurrentId(detail.id);
      setTurns(
        detail.turns.map((t) => ({
          question: t.question,
          answer: t.answer,
          guardrail: t.guardrail_status,
          citations: t.citations,
          tools: t.tools_used,
        }))
      );
    } catch (e) {
      setError(String(e));
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId || !question.trim()) return;
    const q = question.trim();
    setQuestion("");
    setBusy(true);
    setError(null);
    setTurns((t) => [
      ...t,
      { question: q, answer: "", guardrail: null, citations: [], pending: true },
    ]);
    try {
      const res = await api.chat(agentId, q, currentId ?? undefined);
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? {
                question: q,
                answer: res.answer,
                guardrail: res.guardrail_status,
                citations: res.citations,
                tools: res.tools_used,
                meta: {
                  provider: res.provider,
                  model: res.model,
                  latency_ms: res.latency_ms,
                },
              }
            : turn
        )
      );
      setCurrentId(res.conversation_id);
      loadConversations(); // refresh titles / ordering (new convo appears here)
    } catch (err) {
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? { ...turn, answer: `⚠ ${String(err)}`, pending: false }
            : turn
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !agentId) return;
    setError(null);
    try {
      await api.uploadDocument(agentId, file);
      loadDocs();
    } catch (e) {
      setError(String(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addText() {
    if (!agentId || !pasteText.trim()) return;
    setError(null);
    setPasteBusy(true);
    try {
      await api.addTextDocument(agentId, pasteText);
      setPasteText("");
      setShowPaste(false);
      loadDocs();
    } catch (e) {
      setError(String(e));
    } finally {
      setPasteBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/agents" className="text-sm text-muted hover:text-ink">
          ← Agents
        </Link>
        <h1 className="text-xl font-semibold">{agent?.name ?? "Agent"}</h1>
      </div>

      {error && <p className="mb-3 text-sm text-ink">{error}</p>}

      <div className="grid gap-6 md:grid-cols-[190px_1fr_260px]">
        {/* Conversations */}
        <aside>
          <button
            onClick={newChat}
            className="mb-3 w-full rounded-md bg-ink py-2 text-sm font-medium text-white"
          >
            + New chat
          </button>
          <div className="space-y-1">
            {conversations.length === 0 && (
              <p className="text-xs text-muted">No conversations yet.</p>
            )}
            {conversations.map((cv) => (
              <div
                key={cv.id}
                className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${
                  cv.id === currentId ? "bg-soft text-ink" : "text-muted hover:bg-soft"
                }`}
              >
                <button
                  onClick={() => openConversation(cv.id)}
                  className="flex-1 truncate text-left"
                  title={cv.title}
                >
                  {cv.title || "Untitled"}
                </button>
                <button
                  onClick={async () => {
                    await api.deleteConversation(cv.id);
                    if (cv.id === currentId) newChat();
                    loadConversations();
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-ink"
                  title="Delete conversation"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat thread */}
        <section className="flex min-h-[60vh] flex-col">
          <div className="flex-1 space-y-5">
            {turns.length === 0 && (
              <p className="mt-8 text-center text-sm text-muted">
                Ask a question to start a conversation. Follow-ups keep context.
              </p>
            )}
            {turns.map((turn, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg bg-ink px-3 py-2 text-sm text-white">
                    {turn.question}
                  </div>
                </div>
                <div className="max-w-[90%]">
                  <div className="rounded-lg border border-line p-3 text-sm leading-relaxed">
                    {turn.pending ? (
                      <span className="text-muted">thinking…</span>
                    ) : (
                      turn.answer
                    )}
                  </div>
                  {!turn.pending && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      {turn.guardrail && (
                        <span
                          className={`rounded border px-1.5 py-0.5 ${guardStyles[turn.guardrail]}`}
                        >
                          {turn.guardrail}
                        </span>
                      )}
                      {turn.tools && turn.tools.length > 0 && (
                        <span className="rounded border border-line px-1.5 py-0.5 text-muted">
                          🔧 {turn.tools.join(", ")}
                        </span>
                      )}
                      {turn.meta && (
                        <span className="text-muted">
                          {turn.meta.provider} · {turn.meta.latency_ms} ms
                        </span>
                      )}
                      {turn.citations.length > 0 && (
                        <details className="text-muted">
                          <summary className="cursor-pointer select-none">
                            {turn.citations.length} source
                            {turn.citations.length > 1 ? "s" : ""}
                          </summary>
                          <div className="mt-1 space-y-1">
                            {turn.citations.map((c) => (
                              <div
                                key={c.chunk_id}
                                className="rounded border border-line bg-soft p-2"
                              >
                                <div className="text-muted">
                                  [chunk {c.ordinal}] · {c.filename}
                                </div>
                                <p className="line-clamp-2 text-ink/80">{c.text}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={ask} className="mt-4 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask this agent something…"
              className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <button
              disabled={busy || !question.trim()}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "…" : "Send"}
            </button>
          </form>
        </section>

        {/* Knowledge base */}
        <aside>
          <div className="rounded-lg border border-line p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-medium">Knowledge base</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setShowPaste((v) => !v);
                  }}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    showPaste
                      ? "border-ink bg-ink text-white"
                      : "border-line text-muted hover:text-ink"
                  }`}
                >
                  Paste
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  Upload
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.pdf"
                onChange={upload}
                className="hidden"
              />
            </div>

            {showPaste && (
              <div className="mb-3 space-y-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={5}
                  placeholder="Paste text to add to this agent's knowledge…"
                  className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-ink"
                />
                <button
                  onClick={addText}
                  disabled={pasteBusy || !pasteText.trim()}
                  className="w-full rounded-md bg-ink py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {pasteBusy ? "Adding…" : "Add to knowledge base"}
                </button>
              </div>
            )}

            <div className="space-y-2">
              {docs.length === 0 && (
                <p className="text-xs text-muted">
                  No documents yet. <span className="text-ink">Paste</span> text or{" "}
                  <span className="text-ink">Upload</span> a .txt / .md / .pdf to build
                  its memory.
                </p>
              )}
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-md border border-line bg-soft px-3 py-2 text-xs"
                >
                  <span className="truncate text-ink/80">{d.filename}</span>
                  <button
                    onClick={() =>
                      agentId && api.deleteDocument(agentId, d.id).then(loadDocs)
                    }
                    className="text-muted hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
