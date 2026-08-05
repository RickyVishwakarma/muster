import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import AgentsPage from "./pages/AgentsPage";
import ChatPage from "./pages/ChatPage";
import TracesPage from "./pages/TracesPage";

const tabs = [
  { to: "/agents", label: "Agents" },
  { to: "/traces", label: "Traces" },
];

export default function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">
            Mus<span className="text-muted">ter</span>
          </span>
          {/* Tagline: "agent studio" and "traces" map to pages, so they're
              links; "rag" and "guardrails" are in-chat features, not pages. */}
          <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
            <Link to="/agents" className="underline-offset-2 hover:text-ink hover:underline">
              agent studio
            </Link>
            <span aria-hidden>·</span>
            <span title="Retrieval-Augmented Generation — seen inside an agent's chat">
              rag
            </span>
            <span aria-hidden>·</span>
            <span title="Grounding check on each answer — the badge in chat">
              guardrails
            </span>
            <span aria-hidden>·</span>
            <Link to="/traces" className="underline-offset-2 hover:text-ink hover:underline">
              traces
            </Link>
          </span>
          <nav className="ml-auto flex gap-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm ${
                    isActive
                      ? "bg-ink text-white"
                      : "text-muted hover:text-ink"
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/agents" replace />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/:agentId/chat" element={<ChatPage />} />
          <Route path="/traces" element={<TracesPage />} />
        </Routes>
      </main>
    </div>
  );
}
