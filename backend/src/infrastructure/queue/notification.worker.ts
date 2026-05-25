import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { makeRedis } from '@/infrastructure/redis/redis';
import type { NotificationJobData } from './notification.queue';
import type { INotificationPort } from '@/domain/ports/notification.port';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export function createNotificationWorker(port: INotificationPort): Worker<NotificationJobData> {
  return new Worker<NotificationJobData>(
    'notifications',
    async (job: Job<NotificationJobData>) => {
      const { type, masterId, masterTelegramId, masterName, clientTelegramId, clientName, startTime } = job.data;
      const dt = formatDateTime(startTime);

      if (type === 'booking_confirmed') {
        await port.notifyMaster(
          masterId,
          masterTelegramId,
          `Новая запись!\nКлиент: ${clientName}\nВремя: ${dt}`,
        );
      } else if (type === 'reminder_24h') {
        await port.notifyClient(
          clientTelegramId,
          `Напоминание: запись к мастеру ${masterName} завтра в ${dt}`,
        );
      } else if (type === 'reminder_2h') {
        await port.notifyClient(
          clientTelegramId,
          `Напоминание: запись к мастеру ${masterName} через 2 часа — ${dt}`,
        );
      }
    },
    { connection: makeRedis() },
  );
}
