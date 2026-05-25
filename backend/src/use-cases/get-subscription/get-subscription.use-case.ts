import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import { DomainError } from '@/shared/errors/domain-error';

export interface SubscriptionInfo {
  plan: 'trial' | 'active' | 'expired';
  trial_ends_at: Date;
  plan_paid_until: Date | null;
  subscription_price: number;
}

export class GetSubscriptionUseCase {
  constructor(private readonly mastersRepo: IMasterRepository) {}

  async execute(masterId: string): Promise<SubscriptionInfo> {
    const master = await this.mastersRepo.findById(masterId);
    if (!master) throw new DomainError('Master not found', 'MASTER_NOT_FOUND');

    return {
      plan:               master.plan,
      trial_ends_at:      master.trial_ends_at,
      plan_paid_until:    master.plan_paid_until,
      subscription_price: master.subscription_price,
    };
  }
}
