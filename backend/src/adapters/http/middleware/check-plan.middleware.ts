import type { FastifyRequest, FastifyReply } from 'fastify';
import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import { verifyInitData } from '@/shared/lib/telegram-auth';
import { PaymentRequiredError } from '@/shared/errors/payment-required-error';
import { env } from '@/shared/config/env';

export function makeCheckPlan(mastersRepo: IMasterRepository) {
  return async function checkPlan(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const initData = req.headers['x-init-data'];
    if (!initData || typeof initData !== 'string') return;

    const user = verifyInitData(initData, env.BOT_TOKEN);
    if (!user) return;

    const master = await mastersRepo.findByTelegramId(user.id);
    if (!master) return;

    if (master.plan === 'expired') {
      throw new PaymentRequiredError('MASTER_SUBSCRIPTION_EXPIRED');
    }
  };
}
