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
