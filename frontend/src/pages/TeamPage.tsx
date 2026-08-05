import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Role, User } from "../types";

export default function TeamPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.listUsers().then(setUsers).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  async function toggleRole(u: User) {
    const next: Role = u.role === "admin" ? "member" : "admin";
    try {
      await api.setRole(u.id, next);
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Team</h1>
      <p className="mb-4 text-sm text-muted">
        Everyone here shares the same agents, knowledge base, and traces.
      </p>
      {error && <p className="mb-3 text-sm text-ink">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-soft text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Joined</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-2">
                  {u.name}
                  {u.id === me?.id && <span className="text-muted"> (you)</span>}
                </td>
                <td className="px-4 py-2 text-muted">{u.email}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs ${
                      u.role === "admin"
                        ? "border-ink bg-ink text-white"
                        : "border-line text-muted"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  {u.id !== me?.id && (
                    <button
                      onClick={() => toggleRole(u)}
                      className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
                    >
                      {u.role === "admin" ? "Make member" : "Make admin"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
