import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { Agent, ChatResponse, DocumentOut, GuardrailStatus } from "../types";

const guardStyles: Record<GuardrailStatus, string> = {
  grounded: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  ungrounded: "bg-red-500/15 text-red-300 border-red-500/30",
  no_context: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

export default function ChatPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [docs, setDocs] = useState<DocumentOut[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ChatResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = () => {
    if (agentId) api.listDocuments(agentId).then(setDocs);
  };

  useEffect(() => {
    if (!agentId) return;
    api.getAgent(agentId).then(setAgent).catch((e) => setError(String(e)));
    loadDocs();
  }, [agentId]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId) return;
    setBusy(true);
    setError(null);
    try {
      setAnswer(await api.chat(agentId, question));
    } catch (e) {
      setError(String(e));
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

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/agents" className="text-sm text-white/50 hover:text-white">
          ← Agents
        </Link>
        <h1 className="text-xl font-semibold">{agent?.name ?? "Agent"}</h1>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <section>
          <form onSubmit={ask} className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask this agent something..."
              className="flex-1 rounded-md border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              disabled={busy || !question}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
            >
              {busy ? "..." : "Ask"}
            </button>
          </form>

          {answer && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded border px-2 py-0.5 ${guardStyles[answer.guardrail_status]}`}
                >
                  guardrail: {answer.guardrail_status}
                </span>
                <span className="rounded bg-white/5 px-2 py-0.5 text-white/50">
                  {answer.provider} · {answer.model}
                </span>
                <span className="rounded bg-white/5 px-2 py-0.5 text-white/50">
                  {answer.latency_ms} ms
                </span>
                <span className="rounded bg-white/5 px-2 py-0.5 text-white/50">
                  {answer.input_tokens}→{answer.output_tokens} tok
                </span>
              </div>

              <div className="rounded-lg border border-edge bg-panel p-4 text-sm leading-relaxed">
                {answer.answer}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-white/70">
                  Citations ({answer.citations.length})
                </h3>
                <div className="space-y-2">
                  {answer.citations.map((c) => (
                    <div
                      key={c.chunk_id}
                      className="rounded-md border border-edge bg-ink p-3 text-xs"
                    >
                      <div className="mb-1 flex items-center justify-between text-white/40">
                        <span>
                          [chunk {c.ordinal}] · {c.filename}
                        </span>
                        <span>score {c.score.toFixed(3)}</span>
                      </div>
                      <p className="line-clamp-3 text-white/70">{c.text}</p>
                    </div>
                  ))}
                  {answer.citations.length === 0 && (
                    <p className="text-xs text-white/40">
                      No chunks retrieved — upload a document to give the agent memory.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside>
          <div className="rounded-lg border border-edge bg-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Knowledge base</h2>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-edge px-2 py-1 text-xs text-white/60 hover:text-white"
              >
                + Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.pdf"
                onChange={upload}
                className="hidden"
              />
            </div>
            <div className="space-y-2">
              {docs.length === 0 && (
                <p className="text-xs text-white/40">
                  No documents. Upload .txt / .md / .pdf to build memory.
                </p>
              )}
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-md border border-edge bg-ink px-3 py-2 text-xs"
                >
                  <span className="truncate text-white/70">{d.filename}</span>
                  <button
                    onClick={() =>
                      agentId &&
                      api.deleteDocument(agentId, d.id).then(loadDocs)
                    }
                    className="text-white/40 hover:text-red-400"
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
