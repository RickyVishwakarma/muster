import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function LoginPage() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, name, password);
      nav("/agents", { replace: true });
    } catch (err) {
      setError(cleanError(String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-8 text-center">
        <div className="text-2xl font-semibold tracking-tight">
          Mus<span className="text-muted">ter</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {mode === "login" ? "Sign in to your team" : "Create your account"}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-lg border border-line p-6">
        {mode === "register" && (
          <label className="block text-sm">
            <span className="text-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
              placeholder="Jane Doe"
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            placeholder="you@company.com"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            placeholder="at least 6 characters"
          />
        </label>

        {error && <p className="text-sm text-ink">{error}</p>}

        <button
          disabled={busy}
          className="w-full rounded-md bg-ink py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? "New here?" : "Already have an account?"}{" "}
        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
          className="text-ink underline underline-offset-2"
        >
          {mode === "login" ? "Create an account" : "Sign in"}
        </button>
      </p>
      {mode === "register" && (
        <p className="mt-2 text-center text-xs text-muted">
          The first account to register becomes the workspace admin.
        </p>
      )}
    </div>
  );
}

// Turn "409: {"detail":"Email already registered"}" into a readable message.
function cleanError(raw: string): string {
  const m = raw.match(/"detail":"([^"]+)"/);
  if (m) return m[1];
  return raw.replace(/^Error:\s*/, "");
}
