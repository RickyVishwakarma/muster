import { NavLink, Navigate, Route, Routes } from "react-router-dom";
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
          <span className="hidden text-xs text-muted sm:inline">
            agent studio · rag · guardrails · traces
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
