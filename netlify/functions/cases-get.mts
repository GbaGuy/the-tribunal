import type { Config, Context } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';
import { MODEL_CATALOG } from './_lib/modelCatalog';

function withModelId(rows: any[]) {
  return rows.map((row) => {
    const { base_url, ...rest } = row;
    const match = MODEL_CATALOG.find((m) => m.base_url === base_url && m.model === row.model);
    return { ...rest, modelId: match?.id ?? null };
  });
}

export default async (_req: Request, context: Context): Promise<Response> => {
  const { slug } = context.params;
  try {
    const sql = getSql();
    const caseRows = await sql`SELECT * FROM cases WHERE slug = ${slug}`;
    if (caseRows.length === 0) {
      return errorResponse(404, `No case found for slug: ${slug}`);
    }
    const theCase = caseRows[0];

    const characterRows = await sql`
      SELECT p.id, p.name, p.kind, p.seat, p.description, p.model_config->>'model' AS model, p.model_config->>'base_url' AS base_url
      FROM personas p
      JOIN case_participants cp ON cp.persona_id = p.id
      WHERE cp.case_id = ${theCase.id}
      ORDER BY cp.seat, p.name
    `;

    const judgeRows = await sql`
      SELECT id, name, kind, seat, description, model_config->>'model' AS model, model_config->>'base_url' AS base_url
      FROM personas
      WHERE kind = 'judge'
      ORDER BY name
    `;

    return json({ case: theCase, characters: withModelId(characterRows), judges: withModelId(judgeRows) });
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
