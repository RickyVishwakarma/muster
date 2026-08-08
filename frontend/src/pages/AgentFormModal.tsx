import { useEffect, useState } from "react";
import { api } from "../api";
import type { Agent, ToolConfig } from "../types";

const BUILTINS: { name: string; label: string; hint: string }[] = [
  { name: "calculator", label: "Calculator", hint: "do exact math" },
  { name: "current_datetime", label: "Current date & time", hint: "knows “today”" },
  { name: "web_search", label: "Web search", hint: "look things up online" },
];

interface Props {
  open: boolean;
  agent?: Agent | null; // present = edit mode
  onClose: () => void;
  onSaved: () => void;
}

export default function AgentFormModal({ open, agent, onClose, onSaved }: Props) {
  const editing = !!agent;
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("claude-opus-5");
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [httpName, setHttpName] = useState("");
  const [httpUrl, setHttpUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // (Re)initialise the form whenever it opens.
  useEffect(() => {
    if (!open) return;
    setName(agent?.name ?? "");
    setPrompt(agent?.system_prompt ?? "");
    setModel(agent?.model ?? "claude-opus-5");
    setTools(agent?.tools ?? []);
    setHttpName("");
    setHttpUrl("");
    setError(null);
  }, [open, agent]);

  if (!open) return null;

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editing && agent) {
        await api.updateAgent(agent.id, { name, system_prompt: prompt, model, tools });
      } else {
        await api.createAgent({ name, system_prompt: prompt, model, tools });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const customTools = tools.filter((t) => t.type === "http");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 sm:p-8"
      onMouseDown={onClose}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-line bg-paper shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">{editing ? "Configure agent" : "New agent"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 py-5">
          {/* Basics */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Basics
            </h3>
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
                placeholder="You answer questions about our HR policy…"
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
          </section>

          {/* Tools */}
          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                Tools
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                Let the agent take actions, not just answer.
              </p>
            </div>
            <div className="space-y-1.5">
              {BUILTINS.map((b) => (
                <label
                  key={b.name}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"
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

            {/* Custom API tool */}
            <div className="rounded-md border border-line p-3">
              <p className="mb-2 text-xs font-medium">Custom API tool</p>
              <p className="mb-2 text-[11px] text-muted">
                The agent calls your URL with its input as <code>?input=…</code>.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={httpName}
                  onChange={(e) => setHttpName(e.target.value)}
                  placeholder="name (crm_lookup)"
                  className="rounded border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-ink"
                />
                <input
                  value={httpUrl}
                  onChange={(e) => setHttpUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className="rounded border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-ink"
                />
              </div>
              <button
                type="button"
                onClick={addHttpTool}
                className="mt-2 w-full rounded border border-line py-1.5 text-xs text-muted hover:text-ink"
              >
                + Add API tool
              </button>
              {customTools.length > 0 && (
                <div className="mt-2 space-y-1">
                  {customTools.map((t) => (
                    <div
                      key={t.name}
                      className="flex items-center justify-between rounded bg-soft px-2 py-1 text-xs"
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
              )}
            </div>
          </section>

          {error && <p className="text-sm text-ink">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            disabled={busy || !name.trim()}
            className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Create agent"}
          </button>
        </div>
      </form>
    </div>
  );
}
