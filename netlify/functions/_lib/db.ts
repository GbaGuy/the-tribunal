import { neon } from '@neondatabase/serverless';

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL environment variable');
  }
  return neon(connectionString);
}
