import type { Config, Context } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';
import { MODEL_CATALOG } from './_lib/modelCatalog';

export default async (req: Request, context: Context): Promise<Response> => {
  const { personaId } = context.params;

  let body: { modelId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Request body must be JSON');
  }

  const entry = MODEL_CATALOG.find((m) => m.id === body.modelId);
  if (!entry) {
    return errorResponse(400, `Unknown modelId: ${body.modelId}`);
  }

  try {
    const sql = getSql();
    const modelConfig = JSON.stringify({
      provider: entry.provider,
      base_url: entry.base_url,
      model: entry.model,
      api_key_env: entry.api_key_env,
    });

    const rows = await sql`
      UPDATE personas
      SET model_config = ${modelConfig}::jsonb
      WHERE id = ${personaId}
      RETURNING id
    `;
    if (rows.length === 0) {
      return errorResponse(404, `No persona found for id: ${personaId}`);
    }

    return json({ id: personaId, model: entry.model, modelId: entry.id });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
};

export const config: Config = {
  path: '/api/personas/:personaId/model',
  rateLimit: {
    windowLimit: 20,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
