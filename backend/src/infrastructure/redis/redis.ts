import { Redis } from 'ioredis';
import { env } from '@/shared/config/env';

export const makeRedis = (): Redis =>
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
