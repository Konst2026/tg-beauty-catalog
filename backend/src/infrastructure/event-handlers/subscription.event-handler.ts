import type { IEventBus } from '@/domain/ports/event-bus.port';
import type { INotificationPort } from '@/domain/ports/notification.port';
import type { TrialExpiredEvent, TrialExpiringEvent } from '@/domain/master/master.events';

export function registerSubscriptionEventHandlers(
  eventBus: IEventBus,
  notification: INotificationPort,
): void {
  eventBus.subscribe<TrialExpiredEvent>('TrialExpired', async event => {
    await notification.notifyMaster(
      event.masterId,
      event.masterTelegramId,
      `⚠️ Пробный период завершён\n\nДля продолжения работы и приёма новых записей оформите подписку на BeautyBook.`,
    );
  });

  eventBus.subscribe<TrialExpiringEvent>('TrialExpiring', async event => {
    await notification.notifyMaster(
      event.masterId,
      event.masterTelegramId,
      `⏰ Напоминание: ваш пробный период заканчивается через ${event.daysLeft} дней.\n\nОформите подписку заранее, чтобы не прерывать работу.`,
    );
  });
}
