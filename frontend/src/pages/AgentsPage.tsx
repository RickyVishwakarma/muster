import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Agent } from "../types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("claude-opus-5");
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  const load = () =>
    api.listAgents().then(setAgents).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createAgent({ name, system_prompt: prompt, model });
      setName("");
      setPrompt("");
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  async function remove(id: string) {
    await api.deleteAgent(id);
    load();
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Agents</h1>
        {error && <p className="mb-3 text-sm text-ink">{error}</p>}
        <div className="space-y-3">
          {agents.length === 0 && (
            <p className="text-sm text-muted">No agents yet — create one on the right.</p>
          )}
          {agents.map((a) => (
            <div key={a.id} className="rounded-lg border border-line p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{a.name}</h3>
                <span className="rounded border border-line px-2 py-0.5 text-xs text-muted">
                  {a.model}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">
                {a.system_prompt || "No system prompt."}
              </p>
              {a.created_by_name && (
                <p className="mt-2 text-xs text-muted">by {a.created_by_name}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => nav(`/agents/${a.id}/chat`)}
                  className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white"
                >
                  Open
                </button>
                <button
                  onClick={() => remove(a.id)}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside>
        <form
          onSubmit={create}
          className="space-y-3 rounded-lg border border-line p-4"
        >
          <h2 className="font-medium">New agent</h2>
          <label className="block text-sm">
            <span className="text-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
              placeholder="Support agent"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">System prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
              placeholder="You answer questions about our HR policy..."
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Model</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            />
          </label>
          <button className="w-full rounded-md bg-ink py-2 text-sm font-medium text-white">
            Create agent
          </button>
        </form>
      </aside>
    </div>
  );
}
