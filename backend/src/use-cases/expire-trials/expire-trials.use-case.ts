import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import type { IEventBus } from '@/domain/ports/event-bus.port';
import type { TrialExpiredEvent, TrialExpiringEvent } from '@/domain/master/master.events';

export class ExpireTrialsUseCase {
  constructor(
    private readonly mastersRepo: IMasterRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(): Promise<{ expired: number; notifiedExpiring: number }> {
    const [expiredMasters, expiringIn7] = await Promise.all([
      this.mastersRepo.findExpiredTrials(),
      this.mastersRepo.findExpiringTrials(7),
    ]);

    await Promise.all(
      expiredMasters.map(async master => {
        await this.mastersRepo.updatePlan(master.id, 'expired');
        const event: TrialExpiredEvent = {
          type:             'TrialExpired',
          masterId:         master.id,
          masterTelegramId: master.telegram_id,
          masterName:       master.full_name,
        };
        await this.eventBus.publish(event);
      }),
    );

    await Promise.all(
      expiringIn7.map(async master => {
        const event: TrialExpiringEvent = {
          type:             'TrialExpiring',
          masterId:         master.id,
          masterTelegramId: master.telegram_id,
          masterName:       master.full_name,
          daysLeft:         7,
        };
        await this.eventBus.publish(event);
      }),
    );

    return { expired: expiredMasters.length, notifiedExpiring: expiringIn7.length };
  }
}
