import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL:           z.string().min(1, 'DATABASE_URL is required'),
  BOT_TOKEN:              z.string().min(1, 'BOT_TOKEN is required'),
  PLATFORM_URL:           z.string().url('PLATFORM_URL must be a valid URL'),
  TOKEN_ENCRYPTION_KEY:   z.string().length(64, 'TOKEN_ENCRYPTION_KEY must be 64 hex chars'),
  MINI_APP_URL:           z.string().url('MINI_APP_URL must be a valid URL'),
  REDIS_URL:              z.string().default('redis://localhost:6379'),
  NODE_ENV:               z.enum(['development', 'production', 'test']).default('development'),
  PORT:                   z.string().regex(/^\d+$/).optional(),
  HOST:                   z.string().optional(),
  ALLOWED_ORIGINS:        z.string().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues
    .map(i => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Missing or invalid environment variables:\n${missing}`);
}

export const env = result.data;
