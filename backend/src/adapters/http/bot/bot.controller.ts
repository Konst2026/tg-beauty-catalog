import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z }                            from 'zod';
import type { ConnectBotUseCase }       from '@/use-cases/connect-bot/connect-bot.use-case';
import type { DisconnectBotUseCase }    from '@/use-cases/disconnect-bot/disconnect-bot.use-case';
import type { IMasterRepository }       from '@/domain/ports/master.repo.port';
import { verifyInitData }               from '@/shared/lib/telegram-auth';
import { env }                          from '@/shared/config/env';

const connectBotSchema = z.object({
  token: z.string().regex(/^\d+:[A-Za-z0-9_-]{35}$/, 'Invalid bot token format'),
});

export interface BotDeps {
  connectBot:    ConnectBotUseCase;
  disconnectBot: DisconnectBotUseCase;
  mastersRepo:   IMasterRepository;
}

async function resolveMaster(req: FastifyRequest, mastersRepo: IMasterRepository) {
  const initData = req.headers['x-init-data'];
  if (!initData || typeof initData !== 'string') return null;
  const user = verifyInitData(initData, env.BOT_TOKEN);
  if (!user) return null;
  return mastersRepo.findByTelegramId(user.id);
}

export function makeBotRoutes(deps: BotDeps) {
  return async function botRoutes(app: FastifyInstance) {

    // POST /api/v1/me/bot/connect
    app.post('/connect', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      const result = connectBotSchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ error: result.error.flatten() });

      const { botUsername } = await deps.connectBot.execute(master.id, result.data.token);
      return { botUsername };
    });

    // DELETE /api/v1/me/bot/disconnect
    app.delete('/disconnect', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      await deps.disconnectBot.execute(master.id);
      return reply.status(204).send();
    });
  };
}
