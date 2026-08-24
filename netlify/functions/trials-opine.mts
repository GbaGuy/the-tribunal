import type { Config, Context } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';
import { callModel } from './_lib/modelAdapter';
import { buildVerdictPrompt } from './_lib/prompts';

export default async (_req: Request, context: Context): Promise<Response> => {
  const { trialId, judgeId } = context.params;

  try {
    const sql = getSql();

    const trialRows = await sql`SELECT * FROM trials WHERE id = ${trialId}`;
    if (trialRows.length === 0) {
      return errorResponse(404, `No trial found for id: ${trialId}`);
    }
    const trial = trialRows[0];

    if (judgeId !== trial.panel_judge_1_id && judgeId !== trial.panel_judge_2_id) {
      return errorResponse(400, `Persona ${judgeId} is not a panel judge for trial ${trialId}`);
    }

    const caseRows = await sql`SELECT * FROM cases WHERE id = ${trial.case_id}`;
    const theCase = caseRows[0];

    const judgeRows = await sql`SELECT * FROM personas WHERE id = ${judgeId}`;
    if (judgeRows.length === 0) {
      return errorResponse(404, `No persona found for id: ${judgeId}`);
    }
    const judge = judgeRows[0];

    const characterResponses = await sql`
      SELECT DISTINCT ON (r.persona_id) r.content, p.name, p.seat
      FROM responses r
      JOIN personas p ON p.id = r.persona_id
      WHERE r.trial_id = ${trialId} AND r.role = 'character' AND r.content IS NOT NULL
      ORDER BY r.persona_id, r.created_at DESC
    `;

    if (characterResponses.length === 0) {
      return errorResponse(422, 'No character responses are available for a panel judge to review');
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
        VALUES (${trialId}, ${judgeId}, 'judge', ${content}, ${JSON.stringify(raw)}, ${latencyMs})
        RETURNING id, trial_id, persona_id, role, content, latency_ms, error, created_at
      `;
      return json(rows[0]);
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const message = (err as Error).message;
      await sql`
        INSERT INTO responses (trial_id, persona_id, role, error, latency_ms)
        VALUES (${trialId}, ${judgeId}, 'judge', ${message}, ${latencyMs})
      `;
      return errorResponse(502, `Model call failed: ${message}`);
    }
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
};

export const config: Config = {
  path: '/api/trials/:trialId/opine/:judgeId',
  rateLimit: {
    windowLimit: 20,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
