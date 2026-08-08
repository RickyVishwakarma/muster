import { useState } from "react";
import { api, API_ORIGIN } from "../api";
import type { Agent } from "../types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md border border-line bg-soft px-3 py-2 text-xs">
          {value}
        </code>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function Snippet({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-muted">{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto rounded-md border border-line bg-soft p-3 text-xs leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

export default function IntegratePanel({
  agent,
  onChange,
}: {
  agent: Agent;
  onChange: (a: Agent) => void;
}) {
  const [busy, setBusy] = useState(false);
  const key = agent.api_key;
  const endpoint = `${API_ORIGIN}/public/agents/${agent.id}/ask`;

  async function publish() {
    setBusy(true);
    try {
      onChange(await api.publishAgent(agent.id));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!window.confirm("Revoke the API key? Apps using it will stop working."))
      return;
    setBusy(true);
    try {
      onChange(await api.revokeAgent(agent.id));
    } finally {
      setBusy(false);
    }
  }

  if (!key) {
    return (
      <div className="rounded-lg border border-line p-8 text-center">
        <h2 className="text-lg font-medium">Ship this agent</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Publish to get an API key and a public endpoint you can call from your
          own product — no login required. Build the agent here, run it anywhere.
        </p>
        <button
          onClick={publish}
          disabled={busy}
          className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Publishing…" : "Publish agent"}
        </button>
      </div>
    );
  }

  const q = "How many days of leave do I get?";
  const curl = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Key: ${key}" \\
  -d '{"question": "${q}"}'`;
  const py = `import requests

r = requests.post(
    "${endpoint}",
    headers={"X-Agent-Key": "${key}"},
    json={"question": "${q}"},
)
print(r.json()["answer"])`;
  const js = `const res = await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Agent-Key": "${key}" },
  body: JSON.stringify({ question: "${q}" }),
});
const { answer } = await res.json();
console.log(answer);`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-line p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-ink" />
            <span className="text-sm font-medium">Published</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Live and callable with the key below. Keep it secret.
          </p>
        </div>
        <button
          onClick={revoke}
          disabled={busy}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-40"
        >
          Revoke
        </button>
      </div>

      <Field label="Endpoint" value={endpoint} />
      <Field label="API key" value={key} />

      <Snippet title="cURL" code={curl} />
      <Snippet title="Python" code={py} />
      <Snippet title="JavaScript (server-side)" code={js} />
    </div>
  );
}
