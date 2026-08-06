import type {
  Agent,
  AuthResponse,
  ChatResponse,
  Conversation,
  ConversationDetail,
  DocumentOut,
  Role,
  Trace,
  User,
} from "./types";

// In dev, Vite proxies /api -> http://localhost:8000 (see vite.config.ts).
// In prod, set VITE_API_BASE to the deployed backend origin.
const BASE = import.meta.env.VITE_API_BASE ?? "/api";
const TOKEN_KEY = "muster_token";

let authToken: string | null = localStorage.getItem(TOKEN_KEY);
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return authToken;
}

/** Registered by the auth provider so a 401 anywhere clears the session. */
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers = { ...extra };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  return headers;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: authHeaders({
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    }),
  });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("Your session expired — please sign in again.");
  }
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // ---- Auth ----
  register: (email: string, name: string, password: string) =>
    req<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    }),
  login: (email: string, password: string) =>
    req<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => req<User>("/auth/me"),
  listUsers: () => req<User[]>("/auth/users"),
  setRole: (userId: string, role: Role) =>
    req<User>(`/auth/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  // ---- Agents ----
  listAgents: () => req<Agent[]>("/agents"),
  getAgent: (id: string) => req<Agent>(`/agents/${id}`),
  createAgent: (body: Partial<Agent>) =>
    req<Agent>("/agents", { method: "POST", body: JSON.stringify(body) }),
  updateAgent: (id: string, body: Partial<Agent>) =>
    req<Agent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAgent: (id: string) => req<void>(`/agents/${id}`, { method: "DELETE" }),

  // ---- Documents ----
  listDocuments: (agentId: string) =>
    req<DocumentOut[]>(`/agents/${agentId}/documents`),
  deleteDocument: (agentId: string, docId: string) =>
    req<void>(`/agents/${agentId}/documents/${docId}`, { method: "DELETE" }),
  uploadDocument: async (agentId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    // No Content-Type — the browser sets the multipart boundary itself.
    const res = await fetch(`${BASE}/agents/${agentId}/documents`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (res.status === 401) {
      onUnauthorized?.();
      throw new Error("Your session expired — please sign in again.");
    }
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  },

  // ---- Chat & conversations ----
  chat: (agentId: string, question: string, conversationId?: string, top_k = 4) =>
    req<ChatResponse>(`/agents/${agentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ question, top_k, conversation_id: conversationId ?? null }),
    }),
  listConversations: (agentId: string) =>
    req<Conversation[]>(`/agents/${agentId}/conversations`),
  getConversation: (conversationId: string) =>
    req<ConversationDetail>(`/conversations/${conversationId}`),
  deleteConversation: (conversationId: string) =>
    req<void>(`/conversations/${conversationId}`, { method: "DELETE" }),

  // ---- Traces ----
  listTraces: (agentId?: string) =>
    req<Trace[]>(`/traces${agentId ? `?agent_id=${agentId}` : ""}`),
};
