create extension if not exists pgcrypto;

create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('character', 'judge')),
  seat text check (seat in ('defense', 'prosecution')),
  description text not null,
  system_prompt text not null,
  model_config jsonb not null,
  created_at timestamptz not null default now(),
  unique (name, kind)
);

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  accused text not null,
  deceased text,
  act_alleged text not null,
  facts_md text not null,
  question_md text not null,
  created_at timestamptz not null default now()
);

create table if not exists case_participants (
  case_id uuid not null references cases(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  seat text not null check (seat in ('defense', 'prosecution')),
  primary key (case_id, persona_id)
);

create table if not exists trials (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  judge_persona_id uuid not null references personas(id),
  panel_judge_1_id uuid not null references personas(id),
  panel_judge_2_id uuid not null references personas(id),
  status text not null check (status in ('running', 'complete', 'failed')) default 'running',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references trials(id) on delete cascade,
  persona_id uuid not null references personas(id),
  role text not null check (role in ('character', 'judge')),
  content text,
  raw_request jsonb,
  raw_response jsonb,
  latency_ms integer,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists responses_trial_id_idx on responses (trial_id);
create index if not exists case_participants_case_id_idx on case_participants (case_id);
