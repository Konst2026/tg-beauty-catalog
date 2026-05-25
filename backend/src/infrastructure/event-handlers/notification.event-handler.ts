import type { Queue } from 'bullmq';
import type { IEventBus } from '@/domain/ports/event-bus.port';
import type { BookingCreatedEvent, BookingCancelledEvent } from '@/domain/booking/booking.events';
import type { NotificationJobData } from '@/infrastructure/queue/notification.queue';

const MS_24H = 24 * 60 * 60 * 1000;
const MS_2H  =  2 * 60 * 60 * 1000;

export function registerNotificationEventHandlers(
  eventBus: IEventBus,
  queue: Queue<NotificationJobData>,
): void {
  eventBus.subscribe<BookingCreatedEvent>('BookingCreated', async (event) => {
    const startTime = event.startTime.toISOString();
    const base: Omit<NotificationJobData, 'type'> = {
      bookingId:        event.bookingId,
      masterId:         event.masterId,
      masterTelegramId: event.masterTelegramId,
      masterName:       event.masterName,
      clientTelegramId: event.clientTelegramId,
      clientName:       event.clientName,
      startTime,
    };

    await queue.add('booking_confirmed', { ...base, type: 'booking_confirmed' });

    const now       = Date.now();
    const st        = event.startTime.getTime();
    const delay24h  = st - MS_24H - now;
    const delay2h   = st - MS_2H  - now;

    if (delay24h > 0) {
      await queue.add(
        'reminder_24h',
        { ...base, type: 'reminder_24h' },
        { jobId: `reminder_24h_${event.bookingId}`, delay: delay24h },
      );
    }

    if (delay2h > 0) {
      await queue.add(
        'reminder_2h',
        { ...base, type: 'reminder_2h' },
        { jobId: `reminder_2h_${event.bookingId}`, delay: delay2h },
      );
    }
  });

  eventBus.subscribe<BookingCancelledEvent>('BookingCancelled', async (event) => {
    const j24 = await queue.getJob(`reminder_24h_${event.bookingId}`);
    const j2  = await queue.getJob(`reminder_2h_${event.bookingId}`);
    await j24?.remove();
    await j2?.remove();
  });
}
