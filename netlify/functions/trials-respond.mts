import type { Config, Context } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';
import { callModel } from './_lib/modelAdapter';
import { buildCaseBriefing } from './_lib/prompts';

export default async (_req: Request, context: Context): Promise<Response> => {
  const { trialId, personaId } = context.params;

  try {
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
  } catch (err) {
    return errorResponse(500, (err as Error).message);
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
