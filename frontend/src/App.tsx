import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import AgentsPage from "./pages/AgentsPage";
import ChatPage from "./pages/ChatPage";
import HomePage from "./pages/HomePage";
import LandingPage from "./pages/LandingPage";
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-muted">
        Loading…
      </div>
    );
  }

  // Logged out: public marketing site + auth.
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Logged in: the app shell.
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/:agentId/chat" element={<ChatPage />} />
          <Route path="/traces" element={<TracesPage />} />
          {user.role === "admin" && <Route path="/team" element={<TeamPage />} />}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const tabs = [
    { to: "/", label: "Home", end: true },
    { to: "/agents", label: "Agents", end: false },
    { to: "/traces", label: "Traces", end: false },
    ...(user?.role === "admin" ? [{ to: "/team", label: "Team", end: false }] : []),
  ];
  const initial = (user?.name?.[0] ?? "?").toUpperCase();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <NavLink to="/" end className="text-lg font-semibold tracking-tight">
          Mus<span className="text-muted">ter</span>
        </NavLink>

        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm ${
                  isActive ? "bg-ink text-white" : "text-muted hover:text-ink"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-medium text-white">
              {initial}
            </div>
            <div className="leading-tight">
              <div className="text-sm">{user?.name}</div>
              <div className="text-[11px] text-muted">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
