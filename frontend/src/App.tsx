import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import AgentsPage from "./pages/AgentsPage";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import TeamPage from "./pages/TeamPage";
import TracesPage from "./pages/TracesPage";

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-muted">
        Loading…
      </div>
    );
  }

  // Unauthenticated: only the login page is reachable.
  if (!user) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/agents" replace />} />
          <Route path="/login" element={<Navigate to="/agents" replace />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/:agentId/chat" element={<ChatPage />} />
          <Route path="/traces" element={<TracesPage />} />
          {user.role === "admin" && <Route path="/team" element={<TeamPage />} />}
          <Route path="*" element={<Navigate to="/agents" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const tabs = [
    { to: "/agents", label: "Agents" },
    { to: "/traces", label: "Traces" },
    ...(user?.role === "admin" ? [{ to: "/team", label: "Team" }] : []),
  ];

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">
          Mus<span className="text-muted">ter</span>
        </span>
        <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <Link to="/agents" className="underline-offset-2 hover:text-ink hover:underline">
            agent studio
          </Link>
          <span aria-hidden>·</span>
          <span title="Retrieval-Augmented Generation — seen inside an agent's chat">rag</span>
          <span aria-hidden>·</span>
          <span title="Grounding check on each answer — the badge in chat">guardrails</span>
          <span aria-hidden>·</span>
          <Link to="/traces" className="underline-offset-2 hover:text-ink hover:underline">
            traces
          </Link>
        </span>

        <nav className="ml-auto flex items-center gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm ${
                  isActive ? "bg-ink text-white" : "text-muted hover:text-ink"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
          <div className="ml-3 flex items-center gap-2 border-l border-line pl-3">
            <span className="hidden text-xs text-muted sm:inline">
              {user?.name} · {user?.role}
            </span>
            <button
              onClick={logout}
              className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
