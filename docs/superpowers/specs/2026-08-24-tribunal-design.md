# The Tribunal — Design Spec

**Date:** 2026-08-24
**Status:** Historical — superseded by [`/specs.md`](../../../specs.md), which describes the app as built. This document is the original design and predates the two-panel-judge restructure, the in-app model switcher, response banking, and the response length limits.

## Purpose

A web app ("The Tribunal") that runs a fictional multi-agent trial. Four
character personas (two defense, two prosecution) each respond independently
to a case's facts. Once all four have responded, a user-selected judge
persona reads the four responses and renders a verdict. Every prompt/response
is persisted to a Postgres database (Neon). The site is deployed on Netlify
(static frontend + serverless Functions backend).

V1 ships with one seeded case (T-001: The Realm v. Jon Snow, from the
provided case dossier) but the data model supports adding further cases
without a rebuild.

## Non-goals

- No authentication/access control (public, no login).
- No sentencing or combining the judges' opinions into one verdict — each
  judge run is an independent opinion.
- No custom rate-limiting code beyond Netlify's built-in per-IP config.
- No E2E test suite — manual browser verification once deployed.

## Architecture

```
┌─────────────────┐        ┌───────────────────────┐        ┌────────────┐
│  Frontend (SPA)  │──────▶│  Netlify Functions      │──────▶│  Neon (PG)  │
│  Vite+React+TS   │◀──────│  (TypeScript, Node)     │◀──────│             │
└─────────────────┘        └───────────┬───────────┘        └────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │  Model adapter          │
                            │  (per-persona provider) │──▶ external free-tier
                            └───────────────────────┘     LLM APIs ("the bank")
```

Orchestration is **client-orchestrated**: the frontend drives the sequence of
function calls rather than one function doing all the work server-side. This
keeps every individual Function invocation to a single LLM call, which stays
comfortably inside Netlify's default synchronous function timeout regardless
of plan tier, and gives a natural progressive "courtroom reveal" UI (each
character's card fills in as their response lands) with no extra
infrastructure (no polling, no Background Functions).

## Data model (Neon / Postgres)

```sql
personas (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  kind           text not null check (kind in ('character', 'judge')),
  seat           text check (seat in ('defense', 'prosecution')),  -- null for judges
  description    text not null,        -- character-signal / judicial-character blurb
  system_prompt  text not null,        -- full prompt instructing the model how to act as this persona
  model_config   jsonb not null,       -- { provider, base_url, model, api_key_env }
  created_at     timestamptz not null default now()
);

cases (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  accused      text not null,
  deceased     text,
  act_alleged  text not null,
  facts_md     text not null,          -- agreed factual record, markdown
  question_md  text not null,          -- question for judgment, markdown
  created_at   timestamptz not null default now()
);

case_participants (
  case_id     uuid references cases(id),
  persona_id  uuid references personas(id),
  seat        text not null check (seat in ('defense', 'prosecution')),
  primary key (case_id, persona_id)
);

trials (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid references cases(id) not null,
  judge_persona_id  uuid references personas(id) not null,
  status            text not null check (status in ('running', 'complete', 'failed')) default 'running',
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

responses (
  id            uuid primary key default gen_random_uuid(),
  trial_id      uuid references trials(id) not null,
  persona_id    uuid references personas(id) not null,
  role          text not null check (role in ('character', 'judge')),
  content       text,                  -- null if error
  raw_request   jsonb,
  raw_response  jsonb,
  latency_ms    integer,
  error         text,                  -- set on failure, content left null
  created_at    timestamptz not null default now()
);
```

Personas and cases are decoupled: the same character/judge personas are
reusable across future cases via `case_participants`, and every model call
(success or failure) is logged in `responses`, giving a full audit trail.

## API (Netlify Functions)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/cases` | GET | List available cases (id, slug, title) |
| `/api/cases/:slug` | GET | Case facts + its assigned characters + list of available judge personas |
| `/api/trials` | POST `{caseId, judgePersonaId}` | Create a trial row (`status=running`), return `trialId` |
| `/api/trials/:trialId/respond/:personaId` | POST | Load case facts + persona's system prompt, call that persona's model via the adapter, write a `responses` row, return the response. Frontend calls this once per character, in parallel. |
| `/api/trials/:trialId/verdict` | POST | Load the trial's 4 character responses from Neon, call the judge's model, write the verdict as a `responses` row, mark trial `complete`/`failed`, return the verdict |
| `/api/trials/:trialId` | GET | Full trial transcript (for reloading/sharing a past trial) |

## Model adapter

The exact "bank" API (provider, auth, request shape) is not finalized yet.
`callModel(modelConfig, systemPrompt, userMessage): Promise<{content, raw}>`
is implemented as a single isolated module behind this interface, shipped
initially with one concrete implementation for an OpenAI-compatible
chat-completions endpoint (the shape most free-tier aggregators use). Each
persona's `model_config.provider` selects the implementation, so adding a
second provider shape later is additive, not a redesign. API keys are read
from Netlify environment variables (name given by
`model_config.api_key_env`) — never stored in the database.

## Error handling

- A character call failing (timeout, non-2xx, malformed response) writes a
  `responses` row with `error` set and `content` null; that character's card
  in the UI shows "no response" instead of blocking the other three.
- The verdict step proceeds with however many character responses exist for
  the trial (typically 4, but tolerates fewer).
- The judge call failing marks the trial `failed`; the UI surfaces an error
  state with a retry action (re-POSTs `/verdict`).

## Rate limiting

Netlify's built-in per-IP rate-limit config (`netlify.toml`) is applied to
`POST /api/trials` and the `respond`/`verdict` endpoints, since this is a
public, no-login site making paid-adjacent (free-tier-limited) LLM calls.
No custom throttling code.

## Frontend

Vite + React + TypeScript, Tailwind for styling, courtroom-themed. Key
screens/states:

1. **Case + judge picker** — case summary (from dossier), pick one of the 3
   judges.
2. **Trial in progress** — 4 character cards (Jon Snow, Tyrion, Daenerys,
   Grey Worm) that each fill in as their `/respond` call resolves; a judge
   card that activates once all 4 are in and fills in after `/verdict`
   resolves.
3. **Verdict view** — full transcript (case facts, all 4 responses, verdict),
   shareable/reloadable via `/api/trials/:trialId`.

## Testing

- Unit tests for the model adapter (mocked HTTP responses: success, error,
  malformed JSON).
- Unit tests for verdict-prompt construction (given N character responses,
  build the expected judge prompt).
- No automated E2E suite; manual verification in the browser once deployed
  to Netlify with a real Neon connection.

## Seed data (V1)

One case (`t-001-realm-v-jon-snow`) built from the provided dossier: case
facts, the 4 character personas (Jon Snow, Tyrion Lannister, Daenerys
Targaryen, Grey Worm) with their seats and character-signal blurbs as
`system_prompt` sources, and the 3 judge personas (Barak, Elon, Shamgar)
with their judicial-character blurbs as `system_prompt` sources. `model_config`
for all 7 personas is left as a placeholder (`provider: "todo"`) until the
real API details are supplied, at which point seeding is updated — the rest
of the system is unaffected.

## Deployment

- Netlify: static frontend build + `netlify/functions/*` for the API.
  `netlify.toml` holds build config and the rate-limit rules.
- Neon: one Postgres database; connection string in `DATABASE_URL` env var
  (Netlify site env, not committed).
- User already has both a Netlify and a Neon account and will connect them
  (`netlify link`, Neon connection string into Netlify env vars) themselves;
  implementation will document exactly which env vars are needed and provide
  the schema migration to run against Neon.
