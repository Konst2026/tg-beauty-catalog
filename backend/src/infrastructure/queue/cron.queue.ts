import { Queue } from 'bullmq';
import { makeRedis } from '@/infrastructure/redis/redis';

export type CronJobName = 'expire-trials' | 'cleanup-pending-bookings';

export interface CronJobData {
  name: CronJobName;
}

export const cronQueue = new Queue<CronJobData>('cron', {
  connection: makeRedis(),
  defaultJobOptions: { removeOnComplete: 10, removeOnFail: 10 },
});

export async function scheduleCronJobs(): Promise<void> {
  // Daily at 09:00 UTC — expire overdue trials + send 7-day warnings
  await cronQueue.upsertJobScheduler(
    'expire-trials',
    { pattern: '0 9 * * *', tz: 'UTC' },
    { name: 'expire-trials', data: { name: 'expire-trials' } },
  );

  // Every 5 minutes — delete pending bookings past expires_at
  await cronQueue.upsertJobScheduler(
    'cleanup-pending-bookings',
    { every: 5 * 60 * 1000 },
    { name: 'cleanup-pending-bookings', data: { name: 'cleanup-pending-bookings' } },
  );
}
