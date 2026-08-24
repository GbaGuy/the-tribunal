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
