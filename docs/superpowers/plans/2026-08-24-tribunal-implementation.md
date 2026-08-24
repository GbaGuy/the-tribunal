# The Tribunal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy "The Tribunal" — a Netlify-hosted site where 4 character agents (Jon Snow, Tyrion Lannister, Daenerys Targaryen, Grey Worm) respond to a case, then a user-selected judge agent (Barak, Elon, or Shamgar) renders a verdict, with every response persisted to a Neon Postgres database.

**Architecture:** Vite + React + TypeScript static frontend, Netlify Functions v2 (TypeScript) backend, Neon Postgres via `@neondatabase/serverless`. Client-orchestrated flow: the frontend calls one short-lived function per character in parallel, then one function for the judge — no long-running server-side orchestration, no Background Functions needed.

**Tech Stack:** React 18, React Router 6, Tailwind CSS, Vite, Vitest, Netlify Functions v2 (`.mts`, path-based routing), `@neondatabase/serverless`, Netlify CLI for local dev.

**Spec:** `docs/superpowers/specs/2026-08-24-tribunal-design.md`

## Global Constraints

- Public site, no authentication (per spec).
- Netlify Functions use the v2 API: `.mts` files, `export default (req, context) => Response`, `export const config: Config = { path, rateLimit }`. Confirmed against current Netlify docs.
- Rate limiting is configured **per-function** via `config.rateLimit` (`windowLimit`, `windowSize` max 180s, `aggregateBy: ["ip"]`) — NOT via `netlify.toml` redirects, which explicitly do not apply to Functions.
- DB access only through `@neondatabase/serverless`'s `neon()` HTTP driver (no connection pooling needed/available in this driver).
- Per-persona model API keys are read from `process.env[<name in model_config.api_key_env>]` — never stored in the database, never hard-coded.
- `model_config.provider = 'todo'` is the intentional seed-data placeholder until real "bank" API details are supplied. Calls against it must fail loudly (`Unsupported model provider: todo`) and that failure must still be persisted to `responses` — this is correct, verified behavior for V1, not a bug.
- No automated E2E suite. Unit tests cover only the model adapter and prompt builders (per spec); every other task is verified manually via `netlify dev` + `curl`/browser.
- Every task ends with a commit.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `netlify.toml`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/index.css`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `test`, `typecheck`; a placeholder `App` component later replaced in Task 14.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "the-tribunal",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@netlify/functions": "^2.8.1",
    "@types/node": "^22.5.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "netlify/functions", "tests"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Write `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Write `src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>The Tribunal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Write `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Write placeholder `src/App.tsx`** (replaced in Task 14)

```tsx
export function App() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
      <p className="font-serif text-xl">The Tribunal is convening…</p>
    </div>
  );
}
```

- [ ] **Step 10: Write `.gitignore`**

```
node_modules
dist
.netlify
.env
*.local
```

- [ ] **Step 11: Write `.env.example`**

```
# Neon connection string (from the Neon dashboard, "Connection string" for the database)
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require

# Per-persona model API keys — fill in once the model "bank" API details are available.
# Until then, personas' model_config.provider stays "todo" and calls fail loudly by design.
JON_SNOW_API_KEY=
TYRION_API_KEY=
DAENERYS_API_KEY=
GREYWORM_API_KEY=
JUDGE_BARAK_API_KEY=
JUDGE_ELON_API_KEY=
JUDGE_SHAMGAR_API_KEY=
```

- [ ] **Step 12: Write `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[dev]
  command = "npm run dev"
  targetPort = 5173
  port = 8888
  publish = "dist"
  autoLaunch = false

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 13: Install dependencies and verify the build**

Run: `npm install && npm run build`
Expected: completes with no errors, produces a `dist/` directory.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html .gitignore .env.example netlify.toml src
git commit -m "Scaffold Vite+React+TS+Tailwind app with Netlify config"
```

---

### Task 2: Database schema

**Files:**
- Create: `db/schema.sql`

**Interfaces:**
- Produces: 5 tables in Neon — `personas`, `cases`, `case_participants`, `trials`, `responses` — consumed by every backend function task.

- [ ] **Step 1: Write `db/schema.sql`**

```sql
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
```

- [ ] **Step 2: Apply the schema to Neon**

Run: `psql "$DATABASE_URL" -f db/schema.sql`
(Requires `DATABASE_URL` exported in your shell, pointing at your Neon database — copy it from the Neon dashboard first: `export DATABASE_URL="postgres://..."`.)
Expected: `CREATE EXTENSION`, `CREATE TABLE` ×5, `CREATE INDEX` ×2 with no errors.

- [ ] **Step 3: Verify**

Run: `psql "$DATABASE_URL" -c "\dt"`
Expected: lists `personas`, `cases`, `case_participants`, `trials`, `responses`.

- [ ] **Step 4: Commit**

```bash
git add db/schema.sql
git commit -m "Add Neon database schema"
```

---

### Task 3: Seed data

**Files:**
- Create: `db/seed.sql`

**Interfaces:**
- Consumes: Task 2 schema.
- Produces: one case (`t-001-realm-v-jon-snow`) and 7 personas (4 characters, 3 judges) with `model_config.provider = 'todo'` placeholders, wired into `case_participants`.

- [ ] **Step 1: Write `db/seed.sql`**

```sql
WITH new_case AS (
  INSERT INTO cases (slug, title, accused, deceased, act_alleged, facts_md, question_md)
  VALUES (
    't-001-realm-v-jon-snow',
    'The Realm v. Jon Snow',
    'Jon Snow',
    'Daenerys Targaryen',
    $$Jon intentionally killed Daenerys by stabbing her during a private meeting in the throne room after the fall of King's Landing.$$,
    $$**Base premises.** The story takes place mainly in Westeros, a continent where powerful families compete for the Iron Throne. Jon Snow grows up believing he is the illegitimate son of Lord Eddard Stark. He becomes a military commander, then King in the North. He later learns that he is the lawful son of Rhaegar Targaryen and Lyanna Stark. This gives him a stronger hereditary claim to the throne than Daenerys, although he does not want to rule.

Daenerys Targaryen is the exiled heir of the dynasty that once ruled Westeros. She survives abuse, gains three dragons, frees enslaved people, and builds an army. Her victories make her both a liberator and an increasingly absolute ruler. Jon and Daenerys become allies and lovers while fighting the Night King, whose army threatens all living people. Jon pledges loyalty to her. After they defeat the dead, Daenerys turns to the Iron Throne. Jon's hidden parentage then weakens her political claim and feeds her fear of betrayal.

Daenerys attacks King's Landing, the capital held by Queen Cersei Lannister. The city surrenders, but Daenerys burns streets and civilians from her dragon, Drogon. Jon witnesses the destruction. Grey Worm, her commander, joins the killing on the ground. Afterward, Daenerys promises further campaigns of liberation. Tyrion Lannister, her chief adviser, resigns in protest and is imprisoned. He warns Jon that Daenerys will kill anyone who threatens her rule, including Jon's sisters. Jon asks Daenerys to show mercy and share moral judgment with others. She refuses. During an embrace, he stabs her to death. Her soldiers arrest him.

**Agreed factual record.**
- King's Landing had surrendered: its bells rang and organized resistance had ceased. Daenerys then used Drogon against streets and civilians, causing destruction on a vast scale.
- After the victory, Daenerys told her assembled forces that the campaign of "liberation" would continue beyond King's Landing. Jon had seen the city and heard the speech.
- Tyrion Lannister renounced his office as Hand and was imprisoned. He warned Jon that Daenerys would treat Jon's sisters, and anyone else she regarded as an obstacle, as enemies.
- Jon asked Daenerys to forgive Tyrion and to show mercy. She refused to let others choose what was good and presented her own judgment as decisive.
- Daenerys was unarmed and was not attacking Jon when he killed her. Jon used their intimacy to get close enough to strike. He had not convened a council, attempted detention, or sought a public surrender of power.$$,
    $$**Issue.** Was Jon Snow's intentional killing of Daenerys Targaryen justified as the necessary defense of others and of the realm, given what he knew, the scale of the threatened harm, the absence or presence of safer alternatives, and his lack of formal authority?

**Scope note.** Decide justified / not justified and give reasons. Do not impose a sentence.$$
  )
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
  RETURNING id
),
jon AS (
  INSERT INTO personas (name, kind, seat, description, system_prompt, model_config)
  VALUES (
    'Jon Snow',
    'character',
    'defense',
    'King in the North turned reluctant Targaryen heir. Duty and mercy over titles.',
    $$You are Jon Snow, speaking for the defense at a tribunal considering whether your killing of Daenerys Targaryen was justified.

Character: You speak plainly and rarely volunteer a long explanation. You dislike praise, titles, and arguments built on your birth. Duty, kept promises, family, and protection of people who cannot defend themselves matter to you. You accept blame quickly and can undervalue your own judgment. You answer directly, tolerate silence, admit uncertainty, and change position when honor or evidence requires it.

Simulation rule: your assigned seat (defense) fixes only your procedural role, not your opinion. Reason honestly in character - if the facts point somewhere uncomfortable, say so.

You will be given the case facts and the question for judgment. Respond in your own voice, arguing your position on whether the killing was justified. Keep your response to a few focused paragraphs - this is testimony, not a legal brief.$$,
    '{"provider":"todo","api_key_env":"JON_SNOW_API_KEY"}'::jsonb
  )
  ON CONFLICT (name, kind) DO UPDATE SET description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt
  RETURNING id
),
tyrion AS (
  INSERT INTO personas (name, kind, seat, description, system_prompt, model_config)
  VALUES (
    'Tyrion Lannister',
    'character',
    'defense',
    'Disgraced Hand of the Queen. Wit, persuasion, and a preference for plans that leave people alive.',
    $$You are Tyrion Lannister, speaking for the defense at a tribunal considering whether Jon Snow's killing of Daenerys Targaryen was justified.

Character: You are quick, ironic, and curious about motives and consequences. You prefer persuasion, negotiated limits, and plans that leave people alive. You mistrust purity, inherited greatness, and rulers who cannot hear unwelcome advice. Shame, divided family loyalty, and confidence in your own cleverness can distort your judgment. You test every side, notice contradictions, and can revise your position without losing your wit.

Simulation rule: your assigned seat (defense) fixes only your procedural role, not your opinion. Reason honestly in character - if the facts point somewhere uncomfortable, say so.

You will be given the case facts and the question for judgment. Respond in your own voice, arguing your position on whether the killing was justified. Keep your response to a few focused paragraphs - this is testimony, not a legal brief.$$,
    '{"provider":"todo","api_key_env":"TYRION_API_KEY"}'::jsonb
  )
  ON CONFLICT (name, kind) DO UPDATE SET description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt
  RETURNING id
),
daenerys AS (
  INSERT INTO personas (name, kind, seat, description, system_prompt, model_config)
  VALUES (
    'Daenerys Targaryen',
    'character',
    'prosecution',
    'Mother of Dragons and Breaker of Chains. Liberation, command, and an unforgiving view of betrayal.',
    $$You are Daenerys Targaryen. In this fictional tribunal simulation, you speak for the prosecution, arguing against the justification for your own killing by Jon Snow.

Character: You speak with command and moral intensity. You prize liberation, courage, loyalty, and action against entrenched cruelty. You want recognition as a legitimate ruler and react sharply to betrayal, condescension, or secret maneuvering. Your experience can make caution look like complicity, but you can listen when respect is genuine. You interpret the record yourself, including evidence against you.

Simulation rule: your assigned seat (prosecution) fixes only your procedural role, not your opinion. Reason honestly in character - if the facts point somewhere uncomfortable, say so.

You will be given the case facts and the question for judgment. Respond in your own voice, arguing your position on whether the killing was justified. Keep your response to a few focused paragraphs - this is testimony, not a legal brief.$$,
    '{"provider":"todo","api_key_env":"DAENERYS_API_KEY"}'::jsonb
  )
  ON CONFLICT (name, kind) DO UPDATE SET description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt
  RETURNING id
),
greyworm AS (
  INSERT INTO personas (name, kind, seat, description, system_prompt, model_config)
  VALUES (
    'Grey Worm',
    'character',
    'prosecution',
    'Commander of the Unsullied. Terse, loyal, and focused on witnessed conduct over rhetoric.',
    $$You are Grey Worm, speaking for the prosecution at a tribunal considering whether Jon Snow's killing of Daenerys Targaryen was justified.

Character: You are terse, concrete, and disciplined. You trust witnessed conduct, clear orders, earned loyalty, and comrades who shared danger. Courtly rhetoric and speculative motives interest you less than sequence: who acted, what was known, and what alternatives existed. Grief and devotion can narrow your view. You speak without flourish and alter your assessment only for strong evidence.

Simulation rule: your assigned seat (prosecution) fixes only your procedural role, not your opinion. Reason honestly in character - if the facts point somewhere uncomfortable, say so.

You will be given the case facts and the question for judgment. Respond in your own voice, arguing your position on whether the killing was justified. Keep your response to a few focused paragraphs - this is testimony, not a legal brief.$$,
    '{"provider":"todo","api_key_env":"GREYWORM_API_KEY"}'::jsonb
  )
  ON CONFLICT (name, kind) DO UPDATE SET description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt
  RETURNING id
),
barak AS (
  INSERT INTO personas (name, kind, seat, description, system_prompt, model_config)
  VALUES (
    'Judge Barak',
    'judge',
    NULL,
    'Systematic, rights-centered, confident that legal principle can discipline public power.',
    $$You are a judge modeled on the judicial method of Aharon Barak: systematic, rights-centered, and confident that legal principle can discipline public power.

Judicial character: You treat law as a coherent system whose principles reach every exercise of public authority. Democracy, in your view, includes majority rule, individual rights, and limits that bind the majority itself. You accept an active judicial role when courts must protect those limits. You favor purposive interpretation: text matters, but its language is read together with the function of the rule, the structure of the legal system, and the values of a democratic state. Rights are serious claims, not decorative language; restrictions require lawful authority, a proper purpose, rational fit, attention to less harmful means, and a defensible relation between public gain and individual cost.

Method: build an intellectual structure before resolving the dispute. Define terms, separate questions, state a general principle, divide it into tests, and apply each test in sequence. Answer counterarguments directly. Your tone is lucid, assured, and sometimes expansive.

You will be given the case facts, the question for judgment, and the arguments presented by four parties (two defense, two prosecution). Read them, then render your own judgment - justified or not justified - with reasons, following your characteristic method. This is a fictional proceeding: you are adapting a judicial method to a fictional case, not issuing a real ruling.$$,
    '{"provider":"todo","api_key_env":"JUDGE_BARAK_API_KEY"}'::jsonb
  )
  ON CONFLICT (name, kind) DO UPDATE SET description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt
  RETURNING id
),
elon AS (
  INSERT INTO personas (name, kind, seat, description, system_prompt, model_config)
  VALUES (
    'Judge Elon',
    'judge',
    NULL,
    'Learned, tradition-minded, alert to the boundary between legal judgment and political choice.',
    $$You are a judge modeled on the judicial method of Menachem Elon: learned, tradition-minded, and alert to the boundary between legal judgment and political choice.

Judicial character: You see law as an inherited conversation, not a blank page for present-day preference. You value human dignity, communal responsibility, continuity, and tolerance toward traditions that give a group its identity. At the same time, you insist that courts have limited authority - a judge may identify illegality and enforce a legal duty, but should not turn broad ideas such as fairness or reasonableness into a license to supervise every political or social choice.

Method: begin with the legal source and the court's competence, then move through the historical and moral setting of the rule before reaching practical consequences. Your tone is patient, earnest, and openly normative. You are comfortable in dissent and explain disagreement without reducing it to personality.

You will be given the case facts, the question for judgment, and the arguments presented by four parties (two defense, two prosecution). Read them, then render your own judgment - justified or not justified - with reasons, following your characteristic method. This is a fictional proceeding: you are adapting a judicial method to a fictional case, not issuing a real ruling.$$,
    '{"provider":"todo","api_key_env":"JUDGE_ELON_API_KEY"}'::jsonb
  )
  ON CONFLICT (name, kind) DO UPDATE SET description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt
  RETURNING id
),
shamgar AS (
  INSERT INTO personas (name, kind, seat, description, system_prompt, model_config)
  VALUES (
    'Judge Shamgar',
    'judge',
    NULL,
    'Sober, institutional, exact about legal powers, protective of concrete rights.',
    $$You are a judge modeled on the judicial method of Meir Shamgar: sober, institutional, exact about legal powers, and protective of concrete rights.

Judicial character: You approach law as an ordered public structure - offices, powers, duties, and remedies must be identified before moral intuition can do useful work. You value continuity, institutional competence, personal responsibility, and the rule that public ends require legal means. You are sensitive to practical consequences but do not treat social benefit as a blank cheque against an individual right.

Method: reconstruct the chronology, state the parties' positions fairly, isolate the governing principle, and map who had the authority to act and what alternatives existed. Your opinions are formal, controlled, and fact-heavy, preferring concrete nouns and restrained conclusions to moral display. You decide no more than is necessary.

You will be given the case facts, the question for judgment, and the arguments presented by four parties (two defense, two prosecution). Read them, then render your own judgment - justified or not justified - with reasons, following your characteristic method. This is a fictional proceeding: you are adapting a judicial method to a fictional case, not issuing a real ruling.$$,
    '{"provider":"todo","api_key_env":"JUDGE_SHAMGAR_API_KEY"}'::jsonb
  )
  ON CONFLICT (name, kind) DO UPDATE SET description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt
  RETURNING id
)
INSERT INTO case_participants (case_id, persona_id, seat)
SELECT new_case.id, jon.id, 'defense' FROM new_case, jon
UNION ALL
SELECT new_case.id, tyrion.id, 'defense' FROM new_case, tyrion
UNION ALL
SELECT new_case.id, daenerys.id, 'prosecution' FROM new_case, daenerys
UNION ALL
SELECT new_case.id, greyworm.id, 'prosecution' FROM new_case, greyworm
ON CONFLICT (case_id, persona_id) DO NOTHING;
```

- [ ] **Step 2: Apply the seed to Neon**

Run: `psql "$DATABASE_URL" -f db/seed.sql`
Expected: `INSERT 0 4` (the final `case_participants` insert) with no errors.

- [ ] **Step 3: Verify**

Run: `psql "$DATABASE_URL" -c "SELECT name, kind, seat FROM personas ORDER BY kind, name;"`
Expected: 7 rows — 4 `character` rows with seats, 3 `judge` rows with null seat.

Run: `psql "$DATABASE_URL" -c "SELECT slug, title FROM cases;"`
Expected: 1 row, `t-001-realm-v-jon-snow`.

- [ ] **Step 4: Commit**

```bash
git add db/seed.sql
git commit -m "Seed T-001 case and 7 personas"
```

---

### Task 4: Shared backend helpers

**Files:**
- Create: `netlify/functions/_lib/types.ts`
- Create: `netlify/functions/_lib/http.ts`
- Create: `netlify/functions/_lib/db.ts`

**Interfaces:**
- Produces: `Persona`, `Case`, `Trial`, `ResponseRow`, `ModelConfig` types; `json(data, status?)`, `errorResponse(status, message)`; `getSql()` — all consumed by every later backend task.

- [ ] **Step 1: Write `netlify/functions/_lib/types.ts`**

```ts
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
```

- [ ] **Step 2: Write `netlify/functions/_lib/http.ts`**

```ts
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message }, status);
}
```

- [ ] **Step 3: Write `netlify/functions/_lib/db.ts`**

```ts
import { neon } from '@neondatabase/serverless';

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL environment variable');
  }
  return neon(connectionString);
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/types.ts netlify/functions/_lib/http.ts netlify/functions/_lib/db.ts
git commit -m "Add shared backend types, http helpers, and db client"
```

---

### Task 5: Model adapter (TDD)

**Files:**
- Create: `netlify/functions/_lib/modelAdapter.ts`
- Test: `tests/modelAdapter.test.ts`

**Interfaces:**
- Consumes: `ModelConfig` from Task 4.
- Produces: `callModel(modelConfig: ModelConfig, systemPrompt: string, userMessage: string): Promise<{ content: string; raw: unknown }>` — consumed by Tasks 9 and 10.

- [ ] **Step 1: Write the failing test `tests/modelAdapter.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callModel } from '../netlify/functions/_lib/modelAdapter';

describe('callModel', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TEST_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('returns content from a successful openai-compatible response', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'I did what honor required.' } }] }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const result = await callModel(
      { provider: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'test-model', apiKeyEnv: 'TEST_API_KEY' },
      'You are Jon Snow.',
      'Was the killing justified?'
    );

    expect(result.content).toBe('I did what honor required.');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the API responds with a non-2xx status', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    ) as unknown as typeof fetch;

    await expect(
      callModel(
        { provider: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'test-model', apiKeyEnv: 'TEST_API_KEY' },
        'You are Jon Snow.',
        'Was the killing justified?'
      )
    ).rejects.toThrow(/429/);
  });

  it('throws when the response has no message content', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [] }), { status: 200 })
    ) as unknown as typeof fetch;

    await expect(
      callModel(
        { provider: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'test-model', apiKeyEnv: 'TEST_API_KEY' },
        'sys',
        'user'
      )
    ).rejects.toThrow(/Unexpected response shape/);
  });

  it('throws when the required env var is missing', async () => {
    delete process.env.MISSING_KEY;
    await expect(
      callModel(
        { provider: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'test-model', apiKeyEnv: 'MISSING_KEY' },
        'sys',
        'user'
      )
    ).rejects.toThrow(/MISSING_KEY/);
  });

  it('throws for an unsupported provider', async () => {
    await expect(callModel({ provider: 'todo' } as any, 'sys', 'user')).rejects.toThrow(
      /Unsupported model provider/
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run tests/modelAdapter.test.ts`
Expected: FAIL — cannot find module `../netlify/functions/_lib/modelAdapter`.

- [ ] **Step 3: Write `netlify/functions/_lib/modelAdapter.ts`**

```ts
import type { ModelConfig } from './types';

export interface ModelCallResult {
  content: string;
  raw: unknown;
}

export async function callModel(
  modelConfig: ModelConfig,
  systemPrompt: string,
  userMessage: string
): Promise<ModelCallResult> {
  if (modelConfig.provider === 'openai-compatible') {
    return callOpenAiCompatible(modelConfig, systemPrompt, userMessage);
  }
  throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
}

async function callOpenAiCompatible(
  modelConfig: ModelConfig,
  systemPrompt: string,
  userMessage: string
): Promise<ModelCallResult> {
  const { baseUrl, model, apiKeyEnv } = modelConfig;
  if (!baseUrl || !model || !apiKeyEnv) {
    throw new Error('openai-compatible model config requires baseUrl, model, and apiKeyEnv');
  }

  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing environment variable: ${apiKeyEnv}`);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  const raw = await response.json();

  if (!response.ok) {
    throw new Error(`Model call failed with status ${response.status}: ${JSON.stringify(raw)}`);
  }

  const content = (raw as any)?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error(`Unexpected response shape from model: ${JSON.stringify(raw)}`);
  }

  return { content, raw };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run tests/modelAdapter.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/modelAdapter.ts tests/modelAdapter.test.ts
git commit -m "Add pluggable model adapter with openai-compatible implementation"
```

---

### Task 6: Prompt builders (TDD)

**Files:**
- Create: `netlify/functions/_lib/prompts.ts`
- Test: `tests/verdictPrompt.test.ts`

**Interfaces:**
- Consumes: `Case` from Task 4.
- Produces: `buildCaseBriefing(theCase: Case): string`, `buildVerdictPrompt(theCase: Case, responses: NamedResponse[]): string`, `NamedResponse { name: string; seat: string; content: string }` — consumed by Tasks 9 and 10.

- [ ] **Step 1: Write the failing test `tests/verdictPrompt.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildCaseBriefing, buildVerdictPrompt } from '../netlify/functions/_lib/prompts';
import type { Case } from '../netlify/functions/_lib/types';

const sampleCase: Case = {
  id: 'case-1',
  slug: 't-001-realm-v-jon-snow',
  title: 'The Realm v. Jon Snow',
  accused: 'Jon Snow',
  deceased: 'Daenerys Targaryen',
  act_alleged: 'Jon stabbed Daenerys in the throne room.',
  facts_md: "King's Landing had surrendered.",
  question_md: 'Was the killing justified?',
};

describe('buildCaseBriefing', () => {
  it('includes the case title, accused, act alleged, facts, and question', () => {
    const briefing = buildCaseBriefing(sampleCase);
    expect(briefing).toContain('The Realm v. Jon Snow');
    expect(briefing).toContain('Jon Snow');
    expect(briefing).toContain('Daenerys Targaryen');
    expect(briefing).toContain("King's Landing had surrendered.");
    expect(briefing).toContain('Was the killing justified?');
  });

  it('omits the deceased line when there is no deceased', () => {
    const briefing = buildCaseBriefing({ ...sampleCase, deceased: null });
    expect(briefing).not.toContain('Deceased:');
  });
});

describe('buildVerdictPrompt', () => {
  it('includes the case briefing and every response with its speaker name and seat', () => {
    const prompt = buildVerdictPrompt(sampleCase, [
      { name: 'Jon Snow', seat: 'defense', content: 'I acted to protect the realm.' },
      { name: 'Grey Worm', seat: 'prosecution', content: 'He killed an unarmed queen.' },
    ]);

    expect(prompt).toContain('The Realm v. Jon Snow');
    expect(prompt).toContain('Jon Snow (defense)');
    expect(prompt).toContain('I acted to protect the realm.');
    expect(prompt).toContain('Grey Worm (prosecution)');
    expect(prompt).toContain('He killed an unarmed queen.');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run tests/verdictPrompt.test.ts`
Expected: FAIL — cannot find module `../netlify/functions/_lib/prompts`.

- [ ] **Step 3: Write `netlify/functions/_lib/prompts.ts`**

```ts
import type { Case } from './types';

export function buildCaseBriefing(theCase: Case): string {
  return [
    `Case: ${theCase.title}`,
    `Accused: ${theCase.accused}`,
    theCase.deceased ? `Deceased: ${theCase.deceased}` : null,
    `Act alleged: ${theCase.act_alleged}`,
    '',
    'Agreed factual record:',
    theCase.facts_md,
    '',
    'Question for judgment:',
    theCase.question_md,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export interface NamedResponse {
  name: string;
  seat: string;
  content: string;
}

export function buildVerdictPrompt(theCase: Case, responses: NamedResponse[]): string {
  const transcript = responses.map((r) => `${r.name} (${r.seat}):\n${r.content}`).join('\n\n');
  return [
    buildCaseBriefing(theCase),
    '',
    'Arguments presented:',
    transcript,
    '',
    'Render your judgment on the question above, with your reasoning.',
  ].join('\n');
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run tests/verdictPrompt.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/prompts.ts tests/verdictPrompt.test.ts
git commit -m "Add case briefing and verdict prompt builders"
```

---

### Task 7: Case endpoints

**Files:**
- Create: `netlify/functions/cases-list.mts`
- Create: `netlify/functions/cases-get.mts`
- Create: `.env` (local only, gitignored — copy from `.env.example` and fill in your real `DATABASE_URL`)

**Interfaces:**
- Consumes: `getSql`, `json`, `errorResponse` from Task 4; `cases`/`personas`/`case_participants` tables from Tasks 2–3.
- Produces: `GET /api/cases`, `GET /api/cases/:slug`.

- [ ] **Step 1: Write `netlify/functions/cases-list.mts`**

```ts
import type { Config } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';

export default async (): Promise<Response> => {
  try {
    const sql = getSql();
    const rows = await sql`SELECT id, slug, title FROM cases ORDER BY created_at`;
    return json(rows);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
};

export const config: Config = {
  path: '/api/cases',
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
```

- [ ] **Step 2: Write `netlify/functions/cases-get.mts`**

```ts
import type { Config, Context } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';

export default async (_req: Request, context: Context): Promise<Response> => {
  const { slug } = context.params;
  try {
    const sql = getSql();
    const caseRows = await sql`SELECT * FROM cases WHERE slug = ${slug}`;
    if (caseRows.length === 0) {
      return errorResponse(404, `No case found for slug: ${slug}`);
    }
    const theCase = caseRows[0];

    const characters = await sql`
      SELECT p.id, p.name, p.kind, p.seat, p.description
      FROM personas p
      JOIN case_participants cp ON cp.persona_id = p.id
      WHERE cp.case_id = ${theCase.id}
      ORDER BY cp.seat, p.name
    `;

    const judges = await sql`
      SELECT id, name, kind, seat, description
      FROM personas
      WHERE kind = 'judge'
      ORDER BY name
    `;

    return json({ case: theCase, characters, judges });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
};

export const config: Config = {
  path: '/api/cases/:slug',
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
```

- [ ] **Step 3: Create local `.env`**

Copy `.env.example` to `.env` and fill in your real `DATABASE_URL` (leave the API keys blank for now — this is gitignored and safe to edit).

- [ ] **Step 4: Verify manually**

Run: `npx netlify dev` (in one terminal, leave running)
Run: `curl http://localhost:8888/api/cases`
Expected: JSON array with one case (`t-001-realm-v-jon-snow`).

Run: `curl http://localhost:8888/api/cases/t-001-realm-v-jon-snow`
Expected: JSON with `case`, `characters` (4, seats `defense`/`prosecution`), `judges` (3).

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/cases-list.mts netlify/functions/cases-get.mts
git commit -m "Add case listing and case detail endpoints"
```

---

### Task 8: Trial create & fetch endpoints

**Files:**
- Create: `netlify/functions/trials-create.mts`
- Create: `netlify/functions/trials-get.mts`

**Interfaces:**
- Consumes: Task 4 helpers.
- Produces: `POST /api/trials` → `{ trialId }`; `GET /api/trials/:trialId` → `{ trial, case, responses }`. `trialId` is consumed by Tasks 9, 10, 14.

- [ ] **Step 1: Write `netlify/functions/trials-create.mts`**

```ts
import type { Config } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';

export default async (req: Request): Promise<Response> => {
  let body: { caseId?: string; judgePersonaId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Request body must be JSON');
  }

  const { caseId, judgePersonaId } = body;
  if (!caseId || !judgePersonaId) {
    return errorResponse(400, 'caseId and judgePersonaId are required');
  }

  try {
    const sql = getSql();
    const rows = await sql`
      INSERT INTO trials (case_id, judge_persona_id, status)
      VALUES (${caseId}, ${judgePersonaId}, 'running')
      RETURNING id
    `;
    return json({ trialId: rows[0].id }, 201);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
};

export const config: Config = {
  path: '/api/trials',
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
```

- [ ] **Step 2: Write `netlify/functions/trials-get.mts`**

```ts
import type { Config, Context } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';

export default async (_req: Request, context: Context): Promise<Response> => {
  const { trialId } = context.params;
  try {
    const sql = getSql();
    const trialRows = await sql`SELECT * FROM trials WHERE id = ${trialId}`;
    if (trialRows.length === 0) {
      return errorResponse(404, `No trial found for id: ${trialId}`);
    }
    const trial = trialRows[0];

    const caseRows = await sql`SELECT * FROM cases WHERE id = ${trial.case_id}`;

    const responses = await sql`
      SELECT r.*, p.name AS persona_name, p.seat AS persona_seat
      FROM responses r
      JOIN personas p ON p.id = r.persona_id
      WHERE r.trial_id = ${trialId}
      ORDER BY r.created_at
    `;

    return json({ trial, case: caseRows[0], responses });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
};

export const config: Config = {
  path: '/api/trials/:trialId',
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
```

- [ ] **Step 3: Verify manually**

With `netlify dev` still running:

Run: `curl -X POST http://localhost:8888/api/trials -H "Content-Type: application/json" -d '{"caseId":"<case id from Task 7>","judgePersonaId":"<a judge id from Task 7>"}'`
Expected: `{"trialId":"<uuid>"}`, status 201.

Run: `curl http://localhost:8888/api/trials/<trialId>`
Expected: `{"trial": {...status:"running"...}, "case": {...}, "responses": []}`.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/trials-create.mts netlify/functions/trials-get.mts
git commit -m "Add trial creation and trial fetch endpoints"
```

---

### Task 9: Trial respond endpoint

**Files:**
- Create: `netlify/functions/trials-respond.mts`

**Interfaces:**
- Consumes: `callModel` (Task 5), `buildCaseBriefing` (Task 6), Task 4 helpers.
- Produces: `POST /api/trials/:trialId/respond/:personaId` → a `responses` row (persisted regardless of success/failure), consumed by Task 11's `respondAs`.

- [ ] **Step 1: Write `netlify/functions/trials-respond.mts`**

```ts
import type { Config, Context } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';
import { callModel } from './_lib/modelAdapter';
import { buildCaseBriefing } from './_lib/prompts';

export default async (_req: Request, context: Context): Promise<Response> => {
  const { trialId, personaId } = context.params;
  const sql = getSql();

  const trialRows = await sql`SELECT * FROM trials WHERE id = ${trialId}`;
  if (trialRows.length === 0) {
    return errorResponse(404, `No trial found for id: ${trialId}`);
  }
  const trial = trialRows[0];

  const caseRows = await sql`SELECT * FROM cases WHERE id = ${trial.case_id}`;
  const theCase = caseRows[0];

  const personaRows = await sql`SELECT * FROM personas WHERE id = ${personaId}`;
  if (personaRows.length === 0) {
    return errorResponse(404, `No persona found for id: ${personaId}`);
  }
  const persona = personaRows[0];

  const userMessage = buildCaseBriefing(theCase as any);
  const startedAt = Date.now();

  try {
    const { content, raw } = await callModel(persona.model_config, persona.system_prompt, userMessage);
    const latencyMs = Date.now() - startedAt;
    const rows = await sql`
      INSERT INTO responses (trial_id, persona_id, role, content, raw_response, latency_ms)
      VALUES (${trialId}, ${personaId}, 'character', ${content}, ${JSON.stringify(raw)}, ${latencyMs})
      RETURNING id, trial_id, persona_id, role, content, latency_ms, error, created_at
    `;
    return json(rows[0]);
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = (err as Error).message;
    await sql`
      INSERT INTO responses (trial_id, persona_id, role, error, latency_ms)
      VALUES (${trialId}, ${personaId}, 'character', ${message}, ${latencyMs})
    `;
    return errorResponse(502, `Model call failed: ${message}`);
  }
};

export const config: Config = {
  path: '/api/trials/:trialId/respond/:personaId',
  rateLimit: {
    windowLimit: 40,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
```

- [ ] **Step 2: Verify manually**

With `netlify dev` running and a `trialId` + a character `personaId` (e.g. Jon Snow's, from Task 7's `/api/cases/:slug` response):

Run: `curl -X POST http://localhost:8888/api/trials/<trialId>/respond/<jonSnowPersonaId>`
Expected: status 502, body `{"error":"Model call failed: Unsupported model provider: todo"}` — this is correct: seed data ships with `provider: "todo"` until real API details are supplied.

Run: `psql "$DATABASE_URL" -c "SELECT role, content, error FROM responses WHERE trial_id = '<trialId>';"`
Expected: one row, `role=character`, `content` NULL, `error` containing "Unsupported model provider: todo" — proving the failure path persists correctly.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/trials-respond.mts
git commit -m "Add character response endpoint"
```

---

### Task 10: Trial verdict endpoint

**Files:**
- Create: `netlify/functions/trials-verdict.mts`

**Interfaces:**
- Consumes: `callModel` (Task 5), `buildVerdictPrompt` (Task 6), Task 4 helpers.
- Produces: `POST /api/trials/:trialId/verdict` → a `responses` row with `role='judge'` and updates `trials.status`, consumed by Task 11's `requestVerdict`.

- [ ] **Step 1: Write `netlify/functions/trials-verdict.mts`**

```ts
import type { Config, Context } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';
import { callModel } from './_lib/modelAdapter';
import { buildVerdictPrompt } from './_lib/prompts';

export default async (_req: Request, context: Context): Promise<Response> => {
  const { trialId } = context.params;
  const sql = getSql();

  const trialRows = await sql`SELECT * FROM trials WHERE id = ${trialId}`;
  if (trialRows.length === 0) {
    return errorResponse(404, `No trial found for id: ${trialId}`);
  }
  const trial = trialRows[0];

  const caseRows = await sql`SELECT * FROM cases WHERE id = ${trial.case_id}`;
  const theCase = caseRows[0];

  const judgeRows = await sql`SELECT * FROM personas WHERE id = ${trial.judge_persona_id}`;
  if (judgeRows.length === 0) {
    return errorResponse(404, `No judge persona found for id: ${trial.judge_persona_id}`);
  }
  const judge = judgeRows[0];

  const characterResponses = await sql`
    SELECT r.content, p.name, p.seat
    FROM responses r
    JOIN personas p ON p.id = r.persona_id
    WHERE r.trial_id = ${trialId} AND r.role = 'character' AND r.content IS NOT NULL
    ORDER BY r.created_at
  `;

  if (characterResponses.length === 0) {
    await sql`UPDATE trials SET status = 'failed', completed_at = now() WHERE id = ${trialId}`;
    return errorResponse(422, 'No character responses are available to render a verdict');
  }

  const userMessage = buildVerdictPrompt(
    theCase as any,
    characterResponses.map((r) => ({ name: r.name as string, seat: r.seat as string, content: r.content as string }))
  );
  const startedAt = Date.now();

  try {
    const { content, raw } = await callModel(judge.model_config, judge.system_prompt, userMessage);
    const latencyMs = Date.now() - startedAt;
    const rows = await sql`
      INSERT INTO responses (trial_id, persona_id, role, content, raw_response, latency_ms)
      VALUES (${trialId}, ${judge.id}, 'judge', ${content}, ${JSON.stringify(raw)}, ${latencyMs})
      RETURNING id, trial_id, persona_id, role, content, latency_ms, error, created_at
    `;
    await sql`UPDATE trials SET status = 'complete', completed_at = now() WHERE id = ${trialId}`;
    return json(rows[0]);
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = (err as Error).message;
    await sql`
      INSERT INTO responses (trial_id, persona_id, role, error, latency_ms)
      VALUES (${trialId}, ${judge.id}, 'judge', ${message}, ${latencyMs})
    `;
    await sql`UPDATE trials SET status = 'failed', completed_at = now() WHERE id = ${trialId}`;
    return errorResponse(502, `Model call failed: ${message}`);
  }
};

export const config: Config = {
  path: '/api/trials/:trialId/verdict',
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
```

- [ ] **Step 2: Verify manually — the "no responses yet" path**

Run: `curl -X POST http://localhost:8888/api/trials/<trialId>/verdict`
Expected: status 422, `{"error":"No character responses are available to render a verdict"}`.
Run: `psql "$DATABASE_URL" -c "SELECT status FROM trials WHERE id = '<trialId>';"`
Expected: `failed`.

- [ ] **Step 3: Verify manually — the "model call fails" path**

Insert a fake successful character response to get past the 422 check:

Run: `psql "$DATABASE_URL" -c "INSERT INTO responses (trial_id, persona_id, role, content, latency_ms) VALUES ('<trialId>', '<jonSnowPersonaId>', 'character', 'Test testimony content.', 100);"`

Run: `curl -X POST http://localhost:8888/api/trials/<trialId>/verdict`
Expected: status 502, `{"error":"Model call failed: Unsupported model provider: todo"}` — again correct given the `todo` placeholder provider.

Run: `psql "$DATABASE_URL" -c "SELECT role, error FROM responses WHERE trial_id = '<trialId>' AND role = 'judge';"`
Expected: one row with `error` set.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/trials-verdict.mts
git commit -m "Add judge verdict endpoint"
```

---

### Task 11: Frontend API client

**Files:**
- Create: `src/api/client.ts`

**Interfaces:**
- Consumes: response shapes from Tasks 7, 8, 9, 10.
- Produces: `fetchCases`, `fetchCase`, `createTrial`, `respondAs`, `requestVerdict`, `fetchTrial`, and types `CaseSummary`, `PersonaSummary`, `CaseDetail`, `ResponseRow`, `TrialDetail` — consumed by Tasks 13, 14.

- [ ] **Step 1: Write `src/api/client.ts`**

```ts
export interface CaseSummary {
  id: string;
  slug: string;
  title: string;
}

export interface PersonaSummary {
  id: string;
  name: string;
  kind: 'character' | 'judge';
  seat: 'defense' | 'prosecution' | null;
  description: string;
}

export interface CaseDetail {
  case: {
    id: string;
    slug: string;
    title: string;
    accused: string;
    deceased: string | null;
    act_alleged: string;
    facts_md: string;
    question_md: string;
  };
  characters: PersonaSummary[];
  judges: PersonaSummary[];
}

export interface ResponseRow {
  id: string;
  trial_id: string;
  persona_id: string;
  role: 'character' | 'judge';
  content: string | null;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
  persona_name?: string;
  persona_seat?: string | null;
}

export interface TrialDetail {
  trial: {
    id: string;
    case_id: string;
    judge_persona_id: string;
    status: 'running' | 'complete' | 'failed';
  };
  case: CaseDetail['case'];
  responses: ResponseRow[];
}

async function parseErrorBody(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return typeof body?.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchCases(): Promise<CaseSummary[]> {
  const res = await fetch('/api/cases');
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Failed to load cases'));
  return res.json();
}

export async function fetchCase(slug: string): Promise<CaseDetail> {
  const res = await fetch(`/api/cases/${slug}`);
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Failed to load case'));
  return res.json();
}

export async function createTrial(caseId: string, judgePersonaId: string): Promise<{ trialId: string }> {
  const res = await fetch('/api/trials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, judgePersonaId }),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Failed to create trial'));
  return res.json();
}

export async function respondAs(trialId: string, personaId: string): Promise<ResponseRow> {
  const res = await fetch(`/api/trials/${trialId}/respond/${personaId}`, { method: 'POST' });
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Character failed to respond'));
  return res.json();
}

export async function requestVerdict(trialId: string): Promise<ResponseRow> {
  const res = await fetch(`/api/trials/${trialId}/verdict`, { method: 'POST' });
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Judge failed to render a verdict'));
  return res.json();
}

export async function fetchTrial(trialId: string): Promise<TrialDetail> {
  const res = await fetch(`/api/trials/${trialId}`);
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Failed to load trial'));
  return res.json();
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/client.ts
git commit -m "Add frontend API client"
```

---

### Task 12: Character/judge card components

**Files:**
- Create: `src/components/cardTypes.ts`
- Create: `src/components/CharacterCard.tsx`
- Create: `src/components/JudgeCard.tsx`

**Interfaces:**
- Produces: `CardStatus`, `CardState`, `PersonaCardInfo` types; `<CharacterCard persona state />`, `<JudgeCard persona state />` — consumed by Task 14.

- [ ] **Step 1: Write `src/components/cardTypes.ts`**

```ts
export type CardStatus = 'pending' | 'loading' | 'done' | 'error';

export interface CardState {
  status: CardStatus;
  content?: string;
  error?: string;
}

export interface PersonaCardInfo {
  id: string;
  name: string;
  seat: 'defense' | 'prosecution' | null;
  description: string;
}
```

- [ ] **Step 2: Write `src/components/CharacterCard.tsx`**

```tsx
import type { CardState, PersonaCardInfo } from './cardTypes';

export function CharacterCard({ persona, state }: { persona: PersonaCardInfo; state: CardState }) {
  const seatColor = persona.seat === 'defense' ? 'border-blue-700' : 'border-red-700';
  return (
    <div className={`rounded-lg border ${seatColor} bg-stone-900 p-4`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-serif">{persona.name}</h2>
        <span className="text-xs uppercase tracking-wide text-stone-400">{persona.seat}</span>
      </div>
      <p className="text-sm text-stone-400 mb-3">{persona.description}</p>
      {state.status === 'loading' && <p className="text-stone-500 italic">…gathering testimony</p>}
      {state.status === 'error' && <p className="text-red-400">{state.error}</p>}
      {state.status === 'done' && <p className="whitespace-pre-wrap">{state.content}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/JudgeCard.tsx`**

```tsx
import type { CardState, PersonaCardInfo } from './cardTypes';

export function JudgeCard({ persona, state }: { persona: PersonaCardInfo; state: CardState }) {
  return (
    <div className="rounded-lg border border-amber-700 bg-stone-900 p-6">
      <h2 className="text-xl font-serif mb-1">{persona.name}</h2>
      <p className="text-sm text-stone-400 mb-3">{persona.description}</p>
      {state.status === 'pending' && <p className="text-stone-500 italic">Awaiting testimony…</p>}
      {state.status === 'loading' && <p className="text-stone-500 italic">…deliberating</p>}
      {state.status === 'error' && <p className="text-red-400">{state.error}</p>}
      {state.status === 'done' && <p className="whitespace-pre-wrap">{state.content}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/cardTypes.ts src/components/CharacterCard.tsx src/components/JudgeCard.tsx
git commit -m "Add character and judge card components"
```

---

### Task 13: Home page (case + judge picker)

**Files:**
- Create: `src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `fetchCases`, `fetchCase`, `createTrial` from Task 11.
- Produces: `<HomePage />`, consumed by Task 14's router.

- [ ] **Step 1: Write `src/pages/HomePage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCases, fetchCase, createTrial, type CaseDetail } from '../api/client';

export function HomePage() {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const cases = await fetchCases();
        if (cases.length === 0) throw new Error('No cases available');
        const full = await fetchCase(cases[0].slug);
        setDetail(full);
        setJudgeId(full.judges[0]?.id ?? null);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    load();
  }, []);

  async function beginTrial() {
    if (!detail || !judgeId) return;
    setStarting(true);
    try {
      const { trialId } = await createTrial(detail.case.id, judgeId);
      navigate(`/trial/${trialId}`);
    } catch (err) {
      setError((err as Error).message);
      setStarting(false);
    }
  }

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!detail) return <div className="p-8 text-stone-100">Loading case…</div>;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-serif mb-2">{detail.case.title}</h1>
      <p className="text-stone-400 mb-6">{detail.case.act_alleged}</p>
      <div className="mb-8 whitespace-pre-wrap text-stone-300">{detail.case.question_md}</div>

      <h2 className="text-xl font-serif mb-3">Choose a judge</h2>
      <div className="space-y-2 mb-8">
        {detail.judges.map((judge) => (
          <label
            key={judge.id}
            className="flex items-start gap-3 p-3 rounded border border-stone-800 cursor-pointer"
          >
            <input
              type="radio"
              name="judge"
              checked={judgeId === judge.id}
              onChange={() => setJudgeId(judge.id)}
            />
            <span>
              <span className="block font-medium">{judge.name}</span>
              <span className="block text-sm text-stone-400">{judge.description}</span>
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={beginTrial}
        disabled={starting}
        className="px-6 py-3 bg-amber-800 hover:bg-amber-700 rounded font-serif text-lg disabled:opacity-50"
      >
        {starting ? 'Convening…' : 'Begin Trial'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "Add home page with case summary and judge picker"
```

---

### Task 14: Trial page, routing, and app wiring

**Files:**
- Create: `src/pages/TrialPage.tsx`
- Modify: `src/App.tsx` (replace placeholder from Task 1 with router)

**Interfaces:**
- Consumes: `fetchTrial`, `fetchCase`, `respondAs`, `requestVerdict` (Task 11); `CharacterCard`, `JudgeCard`, `CardState` (Task 12); `HomePage` (Task 13).
- Produces: full client-orchestrated trial flow, reachable at `/` and `/trial/:trialId`.

- [ ] **Step 1: Write `src/pages/TrialPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchTrial, fetchCase, respondAs, requestVerdict, type CaseDetail, type ResponseRow } from '../api/client';
import { CharacterCard } from '../components/CharacterCard';
import { JudgeCard } from '../components/JudgeCard';
import type { CardState } from '../components/cardTypes';

export function TrialPage() {
  const { trialId } = useParams<{ trialId: string }>();
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [judgePersonaId, setJudgePersonaId] = useState<string | null>(null);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [verdict, setVerdict] = useState<CardState>({ status: 'pending' });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!trialId) return;
    let cancelled = false;

    async function run() {
      try {
        const trialData = await fetchTrial(trialId!);
        const detail = await fetchCase(trialData.case.slug);
        if (cancelled) return;
        setCaseDetail(detail);
        setJudgePersonaId(trialData.trial.judge_persona_id);

        const existingByPersona = new Map(trialData.responses.map((r) => [r.persona_id, r]));

        const initialStates: Record<string, CardState> = {};
        for (const character of detail.characters) {
          const existing = existingByPersona.get(character.id);
          initialStates[character.id] = existing
            ? existing.error
              ? { status: 'error', error: existing.error }
              : { status: 'done', content: existing.content ?? undefined }
            : { status: 'loading' };
        }
        setCardStates(initialStates);

        await Promise.all(
          detail.characters.map(async (character) => {
            if (existingByPersona.has(character.id)) return;
            try {
              const response = await respondAs(trialId!, character.id);
              if (cancelled) return;
              setCardStates((prev) => ({
                ...prev,
                [character.id]: { status: 'done', content: response.content ?? undefined },
              }));
            } catch (err) {
              if (cancelled) return;
              setCardStates((prev) => ({
                ...prev,
                [character.id]: { status: 'error', error: (err as Error).message },
              }));
            }
          })
        );

        if (cancelled) return;

        const existingVerdict = trialData.responses.find((r: ResponseRow) => r.role === 'judge');
        if (existingVerdict) {
          setVerdict(
            existingVerdict.error
              ? { status: 'error', error: existingVerdict.error }
              : { status: 'done', content: existingVerdict.content ?? undefined }
          );
        } else {
          setVerdict({ status: 'loading' });
          try {
            const response = await requestVerdict(trialId!);
            if (cancelled) return;
            setVerdict({ status: 'done', content: response.content ?? undefined });
          } catch (err) {
            if (cancelled) return;
            setVerdict({ status: 'error', error: (err as Error).message });
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [trialId]);

  if (loadError) return <div className="p-8 text-red-400">{loadError}</div>;
  if (!caseDetail) return <div className="p-8 text-stone-100">Loading trial…</div>;

  const judge = caseDetail.judges.find((j) => j.id === judgePersonaId);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-serif mb-6">{caseDetail.case.title}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {caseDetail.characters.map((character) => (
          <CharacterCard
            key={character.id}
            persona={character}
            state={cardStates[character.id] ?? { status: 'pending' }}
          />
        ))}
      </div>
      {judge && <JudgeCard persona={judge} state={verdict} />}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { TrialPage } from './pages/TrialPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trial/:trialId" element={<TrialPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/TrialPage.tsx src/App.tsx
git commit -m "Wire up trial page and client-side routing"
```

---

### Task 15: End-to-end manual verification in the browser

**Files:** none (verification only).

**Interfaces:** none — this task exercises the full stack built in Tasks 1–14.

- [ ] **Step 1: Start the full local stack**

Run: `npx netlify dev`
Expected: serves the Vite app + all Functions on `http://localhost:8888`.

- [ ] **Step 2: Walk the golden path in a browser**

Open `http://localhost:8888`. Expected:
- Case title, act alleged, and question render.
- 3 judges listed as radio options, one pre-selected.
- Click "Begin Trial" → navigates to `/trial/<uuid>`.
- 4 character cards appear, each showing "…gathering testimony" then — since `model_config.provider` is still `todo` — settling into an error state showing "Model call failed: Unsupported model provider: todo". This is the correct, expected state until Task 16b wires in the real model API.
- Judge card shows "…deliberating" then also settles into an error state (422 "No character responses are available" since no character produced usable `content`).

- [ ] **Step 3: Confirm persistence**

Run: `psql "$DATABASE_URL" -c "SELECT role, error FROM responses ORDER BY created_at DESC LIMIT 5;"`
Expected: rows corresponding to the trial just run, each with `error` populated — proving every attempted response is saved to Neon regardless of outcome.

- [ ] **Step 4: Reload the trial URL**

Refresh `/trial/<uuid>` in the browser.
Expected: cards render directly from the persisted (errored) responses without re-triggering new model calls — confirms the reload/shareable-link path works.

- [ ] **Step 5: Commit** (only if this step required any fixes)

If everything above passed with no code changes, there is nothing to commit — proceed to Task 16.

---

### Task 16: Deploy to Netlify

**Files:** none — this task is you, running commands with your own Netlify/Neon credentials (the agent implementing this plan cannot log in on your behalf).

- [ ] **Step 1: Link the local repo to your Netlify site**

Run: `npx netlify login` (opens a browser to authenticate)
Run: `npx netlify link` (choose or create the site for this project)

- [ ] **Step 2: Set environment variables on the Netlify site**

Run:
```bash
npx netlify env:set DATABASE_URL "postgres://...your Neon connection string..."
npx netlify env:set JON_SNOW_API_KEY ""
npx netlify env:set TYRION_API_KEY ""
npx netlify env:set DAENERYS_API_KEY ""
npx netlify env:set GREYWORM_API_KEY ""
npx netlify env:set JUDGE_BARAK_API_KEY ""
npx netlify env:set JUDGE_ELON_API_KEY ""
npx netlify env:set JUDGE_SHAMGAR_API_KEY ""
```
(The API key values stay blank until the model "bank" details are supplied — filling them in later is a config change, not a redeploy of code.)

- [ ] **Step 3: Deploy**

Run: `npx netlify deploy --prod`
Expected: build succeeds, prints a production URL.

- [ ] **Step 4: Smoke-test production**

Open the printed URL, repeat Task 15's golden path against production. Confirm the same expected (currently error-state, correctly persisted) behavior.

---

## After this plan

Once the real model "bank" API details are available: update each persona's `model_config` in `db/seed.sql` (and re-run it, or `UPDATE personas SET model_config = ...` directly) to `provider: "openai-compatible"` with the real `baseUrl`/`model`, and set the corresponding `*_API_KEY` env vars via `netlify env:set`. No code changes needed — this is exactly the isolation the model adapter (Task 5) was designed for.
