import type { Config } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';

export default async (req: Request): Promise<Response> => {
  let body: { caseId?: string; panelJudge1Id?: string; panelJudge2Id?: string; finalJudgeId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Request body must be JSON');
  }

  const { caseId, panelJudge1Id, panelJudge2Id, finalJudgeId } = body;
  if (!caseId || !panelJudge1Id || !panelJudge2Id || !finalJudgeId) {
    return errorResponse(400, 'caseId, panelJudge1Id, panelJudge2Id, and finalJudgeId are required');
  }
  if (new Set([panelJudge1Id, panelJudge2Id, finalJudgeId]).size !== 3) {
    return errorResponse(400, 'panelJudge1Id, panelJudge2Id, and finalJudgeId must all be different judges');
  }

  try {
    const sql = getSql();
    const rows = await sql`
      INSERT INTO trials (case_id, judge_persona_id, panel_judge_1_id, panel_judge_2_id, status)
      VALUES (${caseId}, ${finalJudgeId}, ${panelJudge1Id}, ${panelJudge2Id}, 'running')
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
