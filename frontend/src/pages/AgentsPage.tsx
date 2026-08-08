import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Agent } from "../types";
import AgentFormModal from "./AgentFormModal";

function cleanError(raw: string): string {
  const m = raw.match(/"detail":"([^"]+)"/);
  return m ? m[1] : raw.replace(/^Error:\s*/, "");
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const nav = useNavigate();

  const load = () =>
    api.listAgents().then(setAgents).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(agent: Agent) {
    setEditing(agent);
    setModalOpen(true);
  }

  async function remove(agent: Agent) {
    const ok = window.confirm(
      `Delete "${agent.name}"? This also removes its documents and chat history.`
    );
    if (!ok) return;
    setError(null);
    setDeletingId(agent.id);
    try {
      await api.deleteAgent(agent.id);
      await load();
    } catch (e) {
      setError(`Couldn't delete "${agent.name}": ${cleanError(String(e))}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Agents</h1>
          <p className="text-sm text-muted">
            Build, configure, and open your team's agents.
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white"
        >
          + New agent
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-ink">{error}</p>}

      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-16 text-center">
          <p className="text-sm text-muted">No agents yet.</p>
          <button
            onClick={openNew}
            className="mt-3 rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
          >
            Create your first agent
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <div
              key={a.id}
              className="flex flex-col rounded-lg border border-line p-4"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="font-medium leading-tight">{a.name}</h3>
                <span className="shrink-0 rounded border border-line px-2 py-0.5 text-[11px] text-muted">
                  {a.model}
                </span>
              </div>
              <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted">
                {a.system_prompt || "No system prompt."}
              </p>

              {a.tools?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.tools.map((t) => (
                    <span
                      key={t.name}
                      className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted"
                    >
                      🔧 {t.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-auto flex items-center gap-2 pt-3">
                <button
                  onClick={() => nav(`/agents/${a.id}/chat`)}
                  className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white"
                >
                  Open
                </button>
                <button
                  onClick={() => openEdit(a)}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
                >
                  Configure
                </button>
                <button
                  onClick={() => remove(a)}
                  disabled={deletingId === a.id}
                  className="ml-auto text-sm text-muted hover:text-ink disabled:opacity-40"
                  title="Delete agent"
                >
                  {deletingId === a.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AgentFormModal
        open={modalOpen}
        agent={editing}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
