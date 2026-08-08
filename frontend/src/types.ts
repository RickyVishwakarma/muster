export type Role = "admin" | "member";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Stats {
  agents: number;
  documents: number;
  conversations: number;
  runs: number;
  members: number;
}

export interface ToolConfig {
  name: string;
  type: "builtin" | "http";
  description?: string;
  url?: string | null;
  method?: string;
}

export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  tools: ToolConfig[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface DocumentOut {
  id: string;
  agent_id: string;
  filename: string;
  created_at: string;
}

export interface Citation {
  chunk_id: string;
  ordinal: number;
  filename: string;
  score: number;
  text: string;
}

export type GuardrailStatus = "grounded" | "ungrounded" | "no_context";

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  tools_used: string[];
  guardrail_status: GuardrailStatus;
  provider: string;
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  trace_id: string;
  conversation_id: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationTurn {
  trace_id: string;
  question: string;
  answer: string;
  guardrail_status: GuardrailStatus;
  citations: Citation[];
  tools_used: string[];
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  turns: ConversationTurn[];
}

export interface Trace {
  id: string;
  agent_id: string;
  question: string;
  answer: string;
  provider: string;
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  guardrail_status: GuardrailStatus;
  tools_used: string[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}
