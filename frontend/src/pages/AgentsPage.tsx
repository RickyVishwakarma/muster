import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Agent, ToolConfig } from "../types";

// Turn '403: {"detail":"..."}' into just the message for display.
function cleanError(raw: string): string {
  const m = raw.match(/"detail":"([^"]+)"/);
  return m ? m[1] : raw.replace(/^Error:\s*/, "");
}

const BUILTINS: { name: string; label: string; hint: string }[] = [
  { name: "calculator", label: "Calculator", hint: "do exact math" },
  { name: "current_datetime", label: "Current date & time", hint: "knows 'today'" },
  { name: "web_search", label: "Web search", hint: "look things up online" },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("claude-opus-5");
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [httpName, setHttpName] = useState("");
  const [httpUrl, setHttpUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const nav = useNavigate();

  const load = () =>
    api.listAgents().then(setAgents).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  const hasTool = (n: string) => tools.some((t) => t.name === n);
  const toggleBuiltin = (n: string) =>
    setTools((ts) =>
      ts.some((t) => t.name === n)
        ? ts.filter((t) => t.name !== n)
        : [...ts, { name: n, type: "builtin" }]
    );
  const removeTool = (n: string) => setTools((ts) => ts.filter((t) => t.name !== n));

  function addHttpTool() {
    const n = httpName.trim();
    const u = httpUrl.trim();
    if (!n || !u) return;
    setTools((ts) => [
      ...ts.filter((t) => t.name !== n),
      { name: n, type: "http", url: u, method: "GET" },
    ]);
    setHttpName("");
    setHttpUrl("");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createAgent({ name, system_prompt: prompt, model, tools });
      setName("");
      setPrompt("");
      setTools([]);
      load();
    } catch (e) {
      setError(String(e));
    }
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

  const customTools = tools.filter((t) => t.type === "http");

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
                  onClick={() => remove(a)}
                  disabled={deletingId === a.id}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-40"
                >
                  {deletingId === a.id ? "Deleting…" : "Delete"}
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

          {/* Tools */}
          <div className="text-sm">
            <span className="text-muted">Tools</span>
            <div className="mt-1 space-y-1.5">
              {BUILTINS.map((b) => (
                <label
                  key={b.name}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-2.5 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={hasTool(b.name)}
                    onChange={() => toggleBuiltin(b.name)}
                    className="accent-ink"
                  />
                  <span>{b.label}</span>
                  <span className="ml-auto text-[11px] text-muted">{b.hint}</span>
                </label>
              ))}
            </div>

            {/* Custom HTTP tool */}
            <div className="mt-2 rounded-md border border-line p-2">
              <p className="mb-1 text-xs text-muted">Custom API tool (calls your URL)</p>
              <input
                value={httpName}
                onChange={(e) => setHttpName(e.target.value)}
                placeholder="tool name, e.g. crm_lookup"
                className="mb-1 w-full rounded border border-line bg-white px-2 py-1 text-xs outline-none focus:border-ink"
              />
              <input
                value={httpUrl}
                onChange={(e) => setHttpUrl(e.target.value)}
                placeholder="https://api.example.com/lookup"
                className="mb-1 w-full rounded border border-line bg-white px-2 py-1 text-xs outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={addHttpTool}
                className="w-full rounded border border-line py-1 text-xs text-muted hover:text-ink"
              >
                + Add API tool
              </button>
              {customTools.map((t) => (
                <div
                  key={t.name}
                  className="mt-1 flex items-center justify-between rounded bg-soft px-2 py-1 text-xs"
                >
                  <span className="truncate text-ink/80" title={t.url ?? ""}>
                    🔧 {t.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTool(t.name)}
                    className="text-muted hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button className="w-full rounded-md bg-ink py-2 text-sm font-medium text-white">
            Create agent
          </button>
        </form>
      </aside>
    </div>
  );
}
