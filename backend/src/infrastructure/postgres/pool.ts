import { Pool } from 'pg';
import { env } from '@/shared/config/env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle pg client:', err);
  process.exit(1);
});
