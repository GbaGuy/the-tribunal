# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                                   # install deps (uses registry.npmmirror.com, see .npmrc)
npx netlify-cli dev                           # full local dev: Vite frontend + Netlify Functions together
npm run dev                                   # frontend only (Vite) — /api/* calls will 404, use netlify-cli dev instead
npm run build                                 # tsc --noEmit && vite build
npm run typecheck                             # tsc --noEmit
npm test                                      # vitest run (all tests)
npx vitest run tests/modelAdapter.test.ts     # single test file
npx vitest run -t "throws when the API responds with a non-2xx status"   # single test by name
npx netlify-cli login && npx netlify-cli link # one-time: authenticate + link this checkout to the Netlify site
npx netlify-cli deploy --prod --build         # deploy
```

Local dev needs a `.env` with a real Neon `DATABASE_URL` (see `.env.example`). `psql` is not assumed to be available in every environment — DB migrations/inspection can be done with a short Node one-liner via `@neondatabase/serverless`'s `Client` class instead.

## Architecture

Client-orchestrated multi-agent app: React frontend, Netlify Functions v2 backend, Neon Postgres via `@neondatabase/serverless`. There is no backend orchestrator — `src/pages/TrialPage.tsx` itself drives the entire sequence of API calls.

**Trial flow (must be understood across `TrialPage.tsx` + the endpoint files together):**
1. 4 character personas respond in parallel (`POST /api/trials/:id/respond/:personaId`, `trials-respond.mts`).
2. Once all 4 have settled, 2 panel judges each independently opine in parallel (`POST /api/trials/:id/opine/:judgeId`, `trials-opine.mts`), using the same prompt shape as a verdict (`buildVerdictPrompt`).
3. Once both panel opinions exist, the final judge renders the actual verdict (`POST /api/trials/:id/verdict`, `trials-verdict.mts`), using `buildFinalVerdictPrompt`, which includes both the character testimony *and* the two panel opinions.

`trials.judge_persona_id` holds the **final** judge (column name predates the panel restructure); `trials.panel_judge_1_id` / `panel_judge_2_id` hold the two panel judges. All three judges' responses live in the same `responses` table with `role='judge'`, distinguished only by which trial column their `persona_id` matches — there's no separate "opinion" vs "verdict" role.

**Responses are append-only, never overwritten.** Every respond/opine/verdict call always `INSERT`s a new row — retrying a persona or switching its model adds a new attempt rather than replacing the last one, so full history is preserved. Anywhere a judge needs "the current answer" for a persona (building a verdict prompt, or the frontend deciding whether to auto-fire on load), use `SELECT DISTINCT ON (persona_id) ... ORDER BY persona_id, created_at DESC` (see `trials-verdict.mts`, `trials-opine.mts`) — the frontend does the equivalent by building `new Map(responses.map(r => [r.persona_id, r]))`, since `trials-get.mts` returns responses ordered by `created_at` ascending and later map entries overwrite earlier ones.

**`personas.model_config` is snake_case JSONB**: `{provider, base_url, model, api_key_env}`, matching `netlify/functions/_lib/types.ts` and `modelAdapter.ts` field-for-field. This isn't a TS-style choice — a prior mismatch (seed used snake_case, adapter read camelCase) went undetected for a while because the `"todo"` placeholder provider short-circuited before those fields were ever read. Don't rename these fields.

**The `"todo"` provider is an intentional placeholder**, not incomplete work — `callModel()` throws immediately and clearly for it. Real models are wired in one of two ways, both of which only touch data, never code: editing `db/seed.sql` and re-running it, or via the in-app model switcher (dropdown on each card → `PATCH /api/personas/:id/model`), which picks from the small hardcoded catalog in `netlify/functions/_lib/modelCatalog.ts`. Adding a provider/model means adding one entry to that catalog.

**Netlify Functions v2, not v1**: every file in `netlify/functions/*.mts` uses `export default (req, context) => Response` plus `export const config: Config = { path, rateLimit }` — routing and per-endpoint rate limits are declared in the function file itself, not in `netlify.toml`. (Netlify's redirect-based rate limiting explicitly does not apply to Functions.)

## Data model

- `personas` — reusable characters/judges (4 `character`, 3 `judge`), decoupled from any specific case
- `cases` — a fictional trial's facts and question; currently one seeded case (`t-001-realm-v-jon-snow`)
- `case_participants` — which characters belong to which case, with their seat (`defense`/`prosecution`)
- `trials` — one run of a case with a specific panel/final judge assignment
- `responses` — every attempted model call, success or failure, append-only, tied to `trial_id` + `persona_id`

## Deploy target

Netlify (frontend + Functions) and Neon (Postgres, via the HTTP driver specifically — not swappable for a generic Postgres connection without changing `netlify/functions/_lib/db.ts`). Required environment variables: `DATABASE_URL` plus one API key env var per provider referenced in `modelCatalog.ts` (currently `GROQ_API_KEY`, `OPENROUTER_API_KEY`).
