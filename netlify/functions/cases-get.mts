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
      SELECT p.id, p.name, p.kind, p.seat, p.description, p.model_config->>'model' AS model
      FROM personas p
      JOIN case_participants cp ON cp.persona_id = p.id
      WHERE cp.case_id = ${theCase.id}
      ORDER BY cp.seat, p.name
    `;

    const judges = await sql`
      SELECT id, name, kind, seat, description, model_config->>'model' AS model
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
