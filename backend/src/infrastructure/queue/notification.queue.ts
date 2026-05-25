import { Queue } from 'bullmq';
import { makeRedis } from '@/infrastructure/redis/redis';

export interface NotificationJobData {
  type: 'booking_confirmed' | 'reminder_24h' | 'reminder_2h';
  bookingId: string;
  masterId: string;
  masterTelegramId: number;
  masterName: string;
  clientTelegramId: number;
  clientName: string;
  startTime: string;
}

export const notificationQueue = new Queue<NotificationJobData>('notifications', {
  connection: makeRedis(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
