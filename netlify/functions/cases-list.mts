import type { Config } from '@netlify/functions';
import { getSql } from './_lib/db';
import { json, errorResponse } from './_lib/http';

export default async (): Promise<Response> => {
  try {
    const sql = getSql();
    const rows = await sql`SELECT id, slug, title FROM cases ORDER BY created_at`;
    return json(rows);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
};

export const config: Config = {
  path: '/api/cases',
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};
