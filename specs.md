# The Tribunal — Specification

**Status:** Living document — describes the app as currently built.
**Supersedes:** `docs/superpowers/specs/2026-08-24-tribunal-design.md` (the original design, written before the two-panel-judge restructure, the in-app model switcher, response banking, and the response length limits).

---

## 1. Overview

The Tribunal is a public, no-login web app that runs a fictional multi-agent trial. For a given case, four character personas argue their positions, two panel judges each write an opinion from one side's testimony only, and a final judge synthesises everything into a verdict. Every model call — success or failure — is persisted to Postgres, so any trial can be reloaded and shared by URL.

One case ships seeded: **T-001, *The Realm v. Jon Snow*** (was Jon Snow's killing of Daenerys Targaryen justified as defence of others and of the realm?). The data model supports further cases without a code change.

The app is **client-orchestrated**: there is no backend orchestrator. `src/pages/TrialPage.tsx` drives the entire sequence of API calls, and each Netlify Function makes at most one LLM call, so every invocation stays well inside Netlify's synchronous function timeout on any plan tier. The progressive "courtroom reveal" UI (each card fills in as its call lands) falls out of this for free — no polling, no Background Functions.

## 2. Non-goals

- No authentication or access control — the site is fully public.
- No backend orchestrator, job queue, or Background Functions.
- No custom rate-limiting code beyond Netlify's built-in per-function config.
- No sentencing — judges decide *justified / not justified* with reasons only.
- No automated end-to-end test suite — manual browser verification after deploy.

## 3. Architecture

```
┌──────────────────┐        ┌─────────────────────────┐        ┌────────────┐
│  Frontend (SPA)   │──────▶│  Netlify Functions v2     │──────▶│  Neon (PG)  │
│  Vite+React+TS    │◀──────│  netlify/functions/*.mts  │◀──────│  HTTP driver │
│  Tailwind         │        └────────────┬────────────┘        └────────────┘
│  TrialPage.tsx    │                     │
│  orchestrates ────┼─────────────────────┘
└──────────────────┘                     ▼
                              ┌─────────────────────────┐
                              │  Model adapter (_lib)     │──▶ OpenAI-compatible
                              │  callModel(cfg, sys, usr) │     chat-completions APIs
                              └─────────────────────────┘     (free-tier providers)
```

**Stack**

| Layer | Choice |
|---|---|
| Frontend | React 18, React Router 6, Tailwind CSS 3, built with Vite 5 |
| Backend | Netlify Functions v2 (`.mts`, `export default (req, context) => Response` + `export const config`) |
| Database | Neon Postgres, accessed **only** via `@neondatabase/serverless`'s `neon()` HTTP driver (not swappable for a generic PG connection without changing `_lib/db.ts`) |
| Tests | Vitest |
| Package registry | `registry.npmmirror.com` (see `.npmrc`) |

## 4. Trial flow

A trial runs in three stages. `TrialPage.tsx` executes them in order, each stage gating the next.

### Stage 1 — Character testimony (parallel)

The frontend calls `POST /api/trials/:trialId/respond/:personaId` once per character, in parallel. Each call (`trials-respond.mts`) loads the case, builds the case briefing prompt (`buildCaseBriefing`), calls that persona's model, and `INSERT`s a `responses` row (`role='character'`).

A single character's failure does not block the others — the error is banked as a row with `error` set and `content` NULL, and that card shows the error with a Retry button.

### Stage 2 — Panel opinions (parallel, split by side)

Once all four character calls have settled, the frontend calls `POST /api/trials/:trialId/opine/:judgeId` for each of the two panel judges, in parallel. `trials-opine.mts`:

- Determines the judge's side by matching `judgeId` against `trials.defense_panel_judge_id` or `trials.prosecution_panel_judge_id` (a non-panel `judgeId` is rejected with 400).
- Loads **only that side's** character testimony (`WHERE p.seat = <side>`), so the defence panel judge never sees prosecution testimony and vice versa.
- Builds a verdict-shaped prompt (`buildVerdictPrompt`) and calls the judge's model.
- `INSERT`s a `responses` row with `role='judge'`.

### Stage 3 — Final verdict

Once both panel opinions exist, the frontend calls `POST /api/trials/:trialId/verdict`. `trials-verdict.mts`:

- Loads **all** character testimony (both sides) plus the two panel opinions.
- Requires both panel opinions to be present — otherwise it marks the trial `failed` and returns 422.
- Builds `buildFinalVerdictPrompt` (case briefing + all testimony + both panel opinions) and calls the final judge's model — the persona in `trials.judge_persona_id`.
- `INSERT`s the verdict as a `responses` row, then sets the trial `status='complete'` (or `'failed'` on model error).

### Reload / resume behaviour

`responses` is **append-only** — nothing is ever overwritten. On load, `TrialPage.tsx` fetches the full trial via `GET /api/trials/:trialId` (responses ordered by `created_at` ascending), collapses them with `new Map(responses.map(r => [r.persona_id, r]))` so each persona resolves to its **latest** attempt, and only fires calls for personas that have no banked response yet. A fully-run trial therefore renders entirely from stored data with no new model calls. Retrying a persona or switching its model simply appends another attempt.

## 5. Data model

Defined in `db/schema.sql`. Five tables.

```
personas ─┬─< case_participants >─┬─ cases
          │                       │
          └──< responses >────────┴─< trials
```

### `personas`
Reusable characters and judges, decoupled from any specific case.

| Column | Notes |
|---|---|
| `id` uuid PK | |
| `name` text | unique together with `kind` |
| `kind` text | `'character'` \| `'judge'` |
| `seat` text | `'defense'` \| `'prosecution'`; NULL for judges |
| `description` text | short blurb shown on the card |
| `system_prompt` text | full instruction to the model for acting as this persona |
| `model_config` jsonb | `{provider, base_url, model, api_key_env}` — **snake_case** (see §7) |
| `created_at` timestamptz | |

### `cases`
A fictional trial's facts and question.

`id` · `slug` (unique) · `title` · `accused` · `deceased` (nullable) · `act_alleged` · `facts_md` · `question_md` · `created_at`

### `case_participants`
Which characters belong to which case, with their seat. PK `(case_id, persona_id)`; both FKs `ON DELETE CASCADE`. (Judges are *not* joined to cases here — every judge persona is selectable for every case.)

### `trials`
One run of a case with a specific bench assignment.

| Column | Notes |
|---|---|
| `id` uuid PK | |
| `case_id` uuid | FK → `cases` |
| `judge_persona_id` uuid | **the final judge.** Column name predates the panel restructure. |
| `defense_panel_judge_id` uuid | panel judge who sees defence testimony only |
| `prosecution_panel_judge_id` uuid | panel judge who sees prosecution testimony only |
| `status` text | `'running'` \| `'complete'` \| `'failed'`, default `'running'` |
| `created_at` / `completed_at` | |

### `responses`
Every attempted model call, success or failure, append-only.

| Column | Notes |
|---|---|
| `id` uuid PK | |
| `trial_id` uuid | FK → `trials`, `ON DELETE CASCADE` |
| `persona_id` uuid | FK → `personas` |
| `role` text | `'character'` \| `'judge'` — all three judges (both panel + final) write `'judge'` rows; they are told apart only by which `trials` column their `persona_id` matches. There is no separate "opinion" vs "verdict" role. |
| `content` text | NULL on failure |
| `raw_request` / `raw_response` jsonb | `raw_response` stores the provider's raw JSON on success |
| `latency_ms` integer | |
| `error` text | set on failure, `content` left NULL |
| `created_at` timestamptz | |

Indexes: `responses(trial_id)`, `case_participants(case_id)`.

### The "latest attempt" query pattern

Anywhere a judge step needs the current answer for each persona, use:

```sql
SELECT DISTINCT ON (r.persona_id) ...
FROM responses r
WHERE r.trial_id = $1 AND r.content IS NOT NULL AND ...
ORDER BY r.persona_id, r.created_at DESC
```

(see `trials-opine.mts`, `trials-verdict.mts`). The frontend does the equivalent with a `Map` keyed by `persona_id` over `created_at`-ascending rows.

## 6. HTTP API

All endpoints are Netlify Functions v2. Path and rate limit are declared in each function file's `export const config`. Rate limits are per-IP (`aggregateBy: ['ip']`); the table gives `windowLimit` requests per `windowSize` seconds. Error responses are `{ "error": "<message>" }` with an appropriate status.

| Method & path | Function | Purpose | Rate limit |
|---|---|---|---|
| `GET /api/cases` | `cases-list.mts` | List cases (`id`, `slug`, `title`), oldest first | 60 / 60s |
| `GET /api/cases/:slug` | `cases-get.mts` | Case row + its characters (via `case_participants`) + **all** judge personas. Each persona carries `model` and a resolved `modelId` (matched against the catalog by `base_url`+`model`). | 60 / 60s |
| `POST /api/trials` | `trials-create.mts` | Body `{caseId, defensePanelJudgeId, prosecutionPanelJudgeId, finalJudgeId}` — all required, and all three judges must be distinct. Creates a `running` trial, returns `{trialId}` with 201. | 10 / 60s |
| `POST /api/trials/:trialId/respond/:personaId` | `trials-respond.mts` | Run one character. Appends a `responses` row; returns it. Model failure → error row + 502. | 40 / 60s |
| `POST /api/trials/:trialId/opine/:judgeId` | `trials-opine.mts` | Run one panel judge over its own side's testimony. 400 if `judgeId` isn't a panel judge for the trial; 422 if that side has no testimony. Model failure → error row + 502. | 20 / 60s |
| `POST /api/trials/:trialId/verdict` | `trials-verdict.mts` | Run the final judge over all testimony + both panel opinions. 422 (+ trial `failed`) if no testimony or fewer than two panel opinions. Marks trial `complete`/`failed`. | 10 / 60s |
| `GET /api/trials/:trialId` | `trials-get.mts` | Full transcript: `{trial, case, responses}`, responses ordered `created_at` ascending, each joined with `persona_name` and `persona_seat`. | 60 / 60s |
| `GET /api/models` | `models-list.mts` | The model catalog as `{id, label}[]` for the switcher dropdown. | 60 / 60s |
| `PATCH /api/personas/:personaId/model` | `personas-set-model.mts` | Body `{modelId}` from the catalog. Rewrites that persona's `model_config`. Returns `{id, model, modelId}`. 400 for an unknown `modelId`. | 20 / 60s |

## 7. Model layer

### `model_config` shape

`personas.model_config` is **snake_case** JSONB matching `_lib/types.ts` and `_lib/modelAdapter.ts` field-for-field:

```json
{ "provider": "openai-compatible", "base_url": "https://…/v1", "model": "…", "api_key_env": "GROQ_API_KEY" }
```

Do not rename these fields — a past camelCase/snake_case mismatch went undetected because the `"todo"` provider short-circuits before the other fields are read.

### `callModel(modelConfig, systemPrompt, userMessage)` — `_lib/modelAdapter.ts`

- Only `provider: 'openai-compatible'` is implemented. It `POST`s to `${base_url}/chat/completions` with a two-message (`system`, `user`) body, adds `Authorization: Bearer $<api_key_env>` **only if** `api_key_env` is set (some providers need no key), and reads `choices[0].message.content`.
- Any other provider — including the intentional `'todo'` placeholder — throws `Unsupported model provider: <provider>`. This is deliberate: seeded personas start as `todo` and fail loudly until a real model is assigned, and that failure is still persisted to `responses`.
- Non-2xx responses, missing env vars, and unexpected response shapes all throw with a descriptive message.
- **300-word truncation backstop:** on success, `content` is trimmed to 300 words (with a trailing `…`) before being returned. This complements the "under 300 words" instruction already in every persona `system_prompt`.

### Model catalog & switcher — `_lib/modelCatalog.ts`

`MODEL_CATALOG` is a small hardcoded array of `{id, label, provider, base_url, model, api_key_env?}`. Adding a model means adding one entry. Current entries span Groq (`GROQ_API_KEY`), OpenRouter free models (`OPENROUTER_API_KEY`), and OVHcloud AI Endpoints + Kilo Code (no key required).

Real models are wired **without touching code**, two ways:
1. Edit `db/seed.sql` and re-run it, or
2. Use the in-app dropdown on each card → `PATCH /api/personas/:id/model`, which copies the catalog entry into `model_config`.

API keys live in Netlify environment variables, named by `api_key_env` — never in the database.

## 8. Prompt construction — `_lib/prompts.ts`

| Builder | Used by | Contents |
|---|---|---|
| `buildCaseBriefing(case)` | character responses | title, accused, deceased (omitted if null), act alleged, agreed factual record, question for judgment |
| `buildVerdictPrompt(case, responses)` | panel opinions | case briefing + `Name (seat):\n<content>` per argument + "Render your judgment…" |
| `buildFinalVerdictPrompt(case, responses, panelOpinions)` | final verdict | case briefing + all arguments + `Name:\n<content>` per panel opinion + "Considering both the arguments presented and your fellow judges' opinions, render your own final judgment…" |

Each persona's own voice/method comes from its `system_prompt`; these builders only assemble the user message.

## 9. Frontend

Routes (`src/App.tsx`, `BrowserRouter`):

| Route | Component | |
|---|---|---|
| `/` | `HomePage` | Loads the first case, shows title / act alleged / question, three `JudgeSelect` dropdowns (Defence Panel, Prosecution Panel, Final — defaulted to `judges[0..2]`), validates the three are distinct, then `POST /api/trials` and navigates to the trial. |
| `/trial/:trialId` | `TrialPage` | Renders case facts, four `CharacterCard`s, two panel `JudgeCard`s, one final `JudgeCard`; orchestrates the three stages (§4); handles model switching via `handleChangeModel`. |

**Card state** (`components/cardTypes.ts`): `pending` → `loading` → `done` | `error`. `CharacterCard` (seat-coloured border, blue/red) and `JudgeCard` (amber, optional `roleLabel`) both show a model-picker `<select>`, a Retry button in the `error` state, and `whitespace-pre-wrap` content when `done`.

The client API wrapper is `src/api/client.ts` (`fetchCases`, `fetchCase`, `createTrial`, `respondAs`, `opineAsJudge`, `requestVerdict`, `fetchTrial`, `fetchModels`, `setPersonaModel`), each unwrapping `{error}` bodies into thrown `Error`s.

## 10. Personas & seed data — `db/seed.sql`

One idempotent script (upserts via `ON CONFLICT`), seeding:

**Case** `t-001-realm-v-jon-snow` — *The Realm v. Jon Snow*, with the agreed factual record and the "justified / not justified, no sentence" question.

**Characters** (4), each with a character-signal `system_prompt` and a "seat fixes only your procedural role, not your opinion" simulation rule:

| Persona | Seat |
|---|---|
| Jon Snow | defense |
| Tyrion Lannister | defense |
| Daenerys Targaryen | prosecution |
| Grey Worm | prosecution |

**Judges** (3), each modelled on a real judicial method, with prompts that adapt to whether the judge is acting as a panel judge (one side's testimony) or the final judge (all testimony + fellow judges' opinions):

| Persona | Method after |
|---|---|
| Judge Barak | Aharon Barak — systematic, rights-centred, purposive |
| Judge Elon | Menachem Elon — tradition-minded, limited judicial competence |
| Judge Shamgar | Meir Shamgar — institutional, powers-and-authority first |

All seven personas seed with `model_config` `{"provider":"todo", "api_key_env":"…"}` — no working model until one is assigned via seed edit or the in-app switcher. Every `system_prompt` instructs "under 300 words — this is testimony, not a legal brief" (characters) / "in under 300 words" (judges).

## 11. Error handling

- **Character call fails** → `responses` row with `error` set, `content` NULL; that card shows the message + Retry; the other three characters and both panels proceed.
- **Panel call fails** → error row + 502; that panel card shows Retry. The final verdict is blocked until both panel opinions exist (`content IS NOT NULL`).
- **Verdict call fails** → error row, trial `status='failed'`, 502; the final card shows Retry (`runVerdict`).
- **Missing prerequisites** → `trials-verdict.mts` returns 422 and marks the trial `failed` if there is no testimony or fewer than two panel opinions.
- Retry and model-switch both **append** new attempts; the "latest attempt" query/Map (§5) always reflects the newest.

## 12. Rate limiting

Per-function `config.rateLimit`, per-IP, `windowSize` 60s throughout. Limits: `respond` 40 · `cases` / `cases/:slug` / `trials/:trialId` / `models` 60 · `opine` / `personas/:id/model` 20 · `trials` (create) / `verdict` 10. Netlify's redirect-based rate limiting does **not** apply to Functions, so this is the only throttle.

## 13. Deployment & environment

**Targets:** Netlify (static `dist/` + `netlify/functions`) and Neon (one Postgres database).

**`netlify.toml`:** `npm run build` → publish `dist`, functions dir `netlify/functions`, SPA fallback redirect `/* → /index.html`. Local dev proxy on port 8888 → Vite 5173.

**Required environment variables:**

| Var | For |
|---|---|
| `DATABASE_URL` | Neon connection string (HTTP driver) |
| `GROQ_API_KEY` | Groq catalog models |
| `OPENROUTER_API_KEY` | OpenRouter catalog models |

(OVHcloud and Kilo Code catalog entries need no key. The per-persona `*_API_KEY` names in `.env.example` are placeholders from the seed's `todo` configs.)

**Commands:**

```bash
npm install
npx netlify-cli dev                 # Vite + Functions together (needs a real DATABASE_URL)
npm run build                       # tsc --noEmit && vite build
npm test                            # vitest run
npx netlify-cli deploy --prod --build
```

Schema/seed can be applied with a short Node one-liner using `@neondatabase/serverless`'s `Client` when `psql` is unavailable.

## 14. Testing

Vitest, unit-level only:

- **`tests/modelAdapter.test.ts`** — `callModel`: successful `openai-compatible` response, non-2xx (JSON and non-JSON body), missing message content, missing env var, unsupported provider, 300-word truncation vs. pass-through, and the no-`api_key_env` (no `Authorization` header) path.
- **`tests/verdictPrompt.test.ts`** — `buildCaseBriefing` (includes all fields, omits deceased when null), `buildVerdictPrompt` (speaker name + seat per argument), `buildFinalVerdictPrompt` (case briefing + arguments + both panel opinions).

No automated E2E — verify in the browser against a real Neon connection after deploy.
