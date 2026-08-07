import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Agent, GuardrailStatus, Stats, Trace } from "../types";

const guardDot: Record<GuardrailStatus, string> = {
  grounded: "bg-ink",
  ungrounded: "bg-ink/40",
  no_context: "bg-line",
};

export default function HomePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    api.listAgents().then(setAgents).catch(() => {});
    api.listTraces().then((t) => setTraces(t.slice(0, 6))).catch(() => {});
  }, []);

  const cards = [
    { label: "Agents", value: stats?.agents },
    { label: "Documents", value: stats?.documents },
    { label: "Conversations", value: stats?.conversations },
    { label: "Runs", value: stats?.runs },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user?.name?.split(" ")[0] ?? "there"}.
        </h1>
        <p className="mt-1 text-sm text-muted">
          Here's what's happening in your workspace.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-line p-5">
            <div className="text-3xl font-semibold tabular-nums">
              {c.value ?? "—"}
            </div>
            <div className="mt-1 text-sm text-muted">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/agents"
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white"
        >
          + New agent
        </Link>
        <Link
          to="/traces"
          className="rounded-md border border-line px-4 py-2 text-sm hover:bg-soft"
        >
          View traces
        </Link>
        {user?.role === "admin" && (
          <Link
            to="/team"
            className="rounded-md border border-line px-4 py-2 text-sm hover:bg-soft"
          >
            Manage team
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Your agents */}
        <section className="rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-medium">Your agents</h2>
            <Link to="/agents" className="text-xs text-muted hover:text-ink">
              View all
            </Link>
          </div>
          <div className="divide-y divide-line">
            {agents.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted">
                No agents yet.{" "}
                <Link to="/agents" className="text-ink underline underline-offset-2">
                  Create your first one
                </Link>
                .
              </p>
            )}
            {agents.slice(0, 5).map((a) => (
              <button
                key={a.id}
                onClick={() => nav(`/agents/${a.id}/chat`)}
                className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-soft"
              >
                <div>
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted">
                    {a.created_by_name ? `by ${a.created_by_name}` : a.model}
                  </div>
                </div>
                <span className="text-muted">→</span>
              </button>
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section className="rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-medium">Recent activity</h2>
            <Link to="/traces" className="text-xs text-muted hover:text-ink">
              All traces
            </Link>
          </div>
          <div className="divide-y divide-line">
            {traces.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted">
                No runs yet — ask an agent something.
              </p>
            )}
            {traces.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${guardDot[t.guardrail_status]}`}
                  title={t.guardrail_status}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{t.question}</div>
                  <div className="text-xs text-muted">
                    {t.created_by_name ?? "someone"} ·{" "}
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
