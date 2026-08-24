export type PersonaKind = 'character' | 'judge';
export type Seat = 'defense' | 'prosecution';

export interface ModelConfig {
  provider: 'openai-compatible' | 'todo';
  baseUrl?: string;
  model?: string;
  apiKeyEnv?: string;
}

export interface Persona {
  id: string;
  name: string;
  kind: PersonaKind;
  seat: Seat | null;
  description: string;
  system_prompt: string;
  model_config: ModelConfig;
}

export interface Case {
  id: string;
  slug: string;
  title: string;
  accused: string;
  deceased: string | null;
  act_alleged: string;
  facts_md: string;
  question_md: string;
}

export interface Trial {
  id: string;
  case_id: string;
  judge_persona_id: string;
  status: 'running' | 'complete' | 'failed';
  created_at: string;
  completed_at: string | null;
}

export interface ResponseRow {
  id: string;
  trial_id: string;
  persona_id: string;
  role: 'character' | 'judge';
  content: string | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}
