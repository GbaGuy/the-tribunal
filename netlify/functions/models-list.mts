import type { Config } from '@netlify/functions';
import { json } from './_lib/http';
import { MODEL_CATALOG } from './_lib/modelCatalog';

export default async (): Promise<Response> => {
  return json(MODEL_CATALOG.map(({ id, label }) => ({ id, label })));
};

export const config: Config = {
  path: '/api/models',
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
