import type { Config, Context } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';
import { callModel } from './_lib/modelAdapter';
import { buildVerdictPrompt } from './_lib/prompts';

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
    const theCase = caseRows[0];

    const judgeRows = await sql`SELECT * FROM personas WHERE id = ${trial.judge_persona_id}`;
    if (judgeRows.length === 0) {
      return errorResponse(404, `No judge persona found for id: ${trial.judge_persona_id}`);
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
        ON CONFLICT (trial_id, persona_id) DO UPDATE SET
          content = EXCLUDED.content, raw_response = EXCLUDED.raw_response, latency_ms = EXCLUDED.latency_ms, error = NULL, created_at = now()
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
        ON CONFLICT (trial_id, persona_id) DO UPDATE SET
          error = EXCLUDED.error, latency_ms = EXCLUDED.latency_ms, content = NULL, created_at = now()
      `;
      await sql`UPDATE trials SET status = 'failed', completed_at = now() WHERE id = ${trialId}`;
      return errorResponse(502, `Model call failed: ${message}`);
    }
  } catch (err) {
    return errorResponse(500, (err as Error).message);
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
