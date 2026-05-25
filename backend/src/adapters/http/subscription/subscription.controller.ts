import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { GetSubscriptionUseCase } from '@/use-cases/get-subscription/get-subscription.use-case';
import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import { verifyInitData } from '@/shared/lib/telegram-auth';
import { env } from '@/shared/config/env';

export interface SubscriptionDeps {
  getSubscription: GetSubscriptionUseCase;
  mastersRepo:     IMasterRepository;
}

export function makeSubscriptionRoutes(deps: SubscriptionDeps) {
  return async function subscriptionRoutes(app: FastifyInstance) {
    app.get('/', async (req: FastifyRequest, reply) => {
      const initData = req.headers['x-init-data'];
      if (!initData || typeof initData !== 'string') {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const user = verifyInitData(initData, env.BOT_TOKEN);
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      const master = await deps.mastersRepo.findByTelegramId(user.id);
      if (!master) return reply.status(404).send({ error: 'Master not found' });

      const info = await deps.getSubscription.execute(master.id);
      return { subscription: info };
    });
  };
}
