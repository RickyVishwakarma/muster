import type { Agent, ChatResponse, DocumentOut, Trace } from "./types";

// In dev, Vite proxies /api -> http://localhost:8000 (see vite.config.ts).
// In prod, set VITE_API_BASE to the deployed backend origin.
const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listAgents: () => req<Agent[]>("/agents"),
  getAgent: (id: string) => req<Agent>(`/agents/${id}`),
  createAgent: (body: Partial<Agent>) =>
    req<Agent>("/agents", { method: "POST", body: JSON.stringify(body) }),
  updateAgent: (id: string, body: Partial<Agent>) =>
    req<Agent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAgent: (id: string) => req<void>(`/agents/${id}`, { method: "DELETE" }),

  listDocuments: (agentId: string) =>
    req<DocumentOut[]>(`/agents/${agentId}/documents`),
  deleteDocument: (agentId: string, docId: string) =>
    req<void>(`/agents/${agentId}/documents/${docId}`, { method: "DELETE" }),
  uploadDocument: async (agentId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/agents/${agentId}/documents`, {
      method: "POST",
      body: form, // let the browser set multipart boundaries
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  },

  chat: (agentId: string, question: string, top_k = 4) =>
    req<ChatResponse>(`/agents/${agentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ question, top_k }),
    }),

  listTraces: (agentId?: string) =>
    req<Trace[]>(`/traces${agentId ? `?agent_id=${agentId}` : ""}`),
};
