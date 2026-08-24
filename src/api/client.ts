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
  model: string | null;
  modelId: string | null;
}

export interface ModelOption {
  id: string;
  label: string;
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

export async function fetchModels(): Promise<ModelOption[]> {
  const res = await fetch('/api/models');
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Failed to load models'));
  return res.json();
}

export async function setPersonaModel(
  personaId: string,
  modelId: string
): Promise<{ id: string; model: string; modelId: string }> {
  const res = await fetch(`/api/personas/${personaId}/model`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId }),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Failed to set model'));
  return res.json();
}
