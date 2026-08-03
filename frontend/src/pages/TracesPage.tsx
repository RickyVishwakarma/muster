import { useEffect, useState } from "react";
import { api } from "../api";
import type { GuardrailStatus, Trace } from "../types";

// Monochrome: grounded = bold, ungrounded = dotted underline, no_context = muted.
const guardStyles: Record<GuardrailStatus, string> = {
  grounded: "font-medium text-ink",
  ungrounded: "text-ink underline decoration-dotted underline-offset-2",
  no_context: "text-muted",
};

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listTraces().then(setTraces).catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Traces</h1>
      <p className="mb-4 text-sm text-muted">
        One row per agent run — latency, token usage, and the guardrail verdict.
      </p>
      {error && <p className="mb-3 text-sm text-ink">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-soft text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Question</th>
              <th className="px-4 py-2">Guardrail</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Latency</th>
              <th className="px-4 py-2">Tokens</th>
              <th className="px-4 py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="max-w-[260px] truncate px-4 py-2 text-ink/80">
                  {t.question}
                </td>
                <td className={`px-4 py-2 ${guardStyles[t.guardrail_status]}`}>
                  {t.guardrail_status}
                </td>
                <td className="px-4 py-2 text-muted">{t.provider}</td>
                <td className="px-4 py-2 text-muted">{t.latency_ms} ms</td>
                <td className="px-4 py-2 text-muted">
                  {t.input_tokens}→{t.output_tokens}
                </td>
                <td className="px-4 py-2 text-muted">
                  {new Date(t.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {traces.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No runs yet. Ask an agent something to generate a trace.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
