import type { Config } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';

export default async (req: Request): Promise<Response> => {
  let body: { caseId?: string; defensePanelJudgeId?: string; prosecutionPanelJudgeId?: string; finalJudgeId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Request body must be JSON');
  }

  const { caseId, defensePanelJudgeId, prosecutionPanelJudgeId, finalJudgeId } = body;
  if (!caseId || !defensePanelJudgeId || !prosecutionPanelJudgeId || !finalJudgeId) {
    return errorResponse(400, 'caseId, defensePanelJudgeId, prosecutionPanelJudgeId, and finalJudgeId are required');
  }
  if (new Set([defensePanelJudgeId, prosecutionPanelJudgeId, finalJudgeId]).size !== 3) {
    return errorResponse(400, 'defensePanelJudgeId, prosecutionPanelJudgeId, and finalJudgeId must all be different judges');
  }

  try {
    const sql = getSql();
    const rows = await sql`
      INSERT INTO trials (case_id, judge_persona_id, defense_panel_judge_id, prosecution_panel_judge_id, status)
      VALUES (${caseId}, ${finalJudgeId}, ${defensePanelJudgeId}, ${prosecutionPanelJudgeId}, 'running')
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
