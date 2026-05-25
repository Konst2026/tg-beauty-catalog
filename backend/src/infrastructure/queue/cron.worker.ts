import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { makeRedis } from '@/infrastructure/redis/redis';
import type { CronJobData } from './cron.queue';
import type { ExpireTrialsUseCase } from '@/use-cases/expire-trials/expire-trials.use-case';
import type { CleanupPendingBookingsUseCase } from '@/use-cases/cleanup-pending-bookings/cleanup-pending-bookings.use-case';

export interface CronWorkerDeps {
  expireTrials:           ExpireTrialsUseCase;
  cleanupPendingBookings: CleanupPendingBookingsUseCase;
}

export function createCronWorker(deps: CronWorkerDeps): Worker<CronJobData> {
  return new Worker<CronJobData>(
    'cron',
    async (job: Job<CronJobData>) => {
      if (job.data.name === 'expire-trials') {
        const result = await deps.expireTrials.execute();
        job.log(`expired=${result.expired} expiring=${result.notifiedExpiring}`);
      } else if (job.data.name === 'cleanup-pending-bookings') {
        const deleted = await deps.cleanupPendingBookings.execute();
        job.log(`deleted=${deleted}`);
      }
    },
    { connection: makeRedis() },
  );
}
