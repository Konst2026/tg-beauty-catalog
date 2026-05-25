import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL:     z.string().min(1, 'DATABASE_URL is required'),
  BOT_TOKEN:        z.string().min(1, 'BOT_TOKEN is required'),
  NODE_ENV:         z.enum(['development', 'production', 'test']).default('development'),
  PORT:             z.string().regex(/^\d+$/).optional(),
  HOST:             z.string().optional(),
  ALLOWED_ORIGINS:  z.string().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues
    .map(i => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Missing or invalid environment variables:\n${missing}`);
}

export const env = result.data;
