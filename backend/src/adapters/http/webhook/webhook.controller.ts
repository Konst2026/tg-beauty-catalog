import type { FastifyInstance } from 'fastify';
import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import type { IBotManager }       from '@/domain/ports/bot-manager.port';

export interface WebhookDeps {
  mastersRepo: IMasterRepository;
  botManager:  IBotManager;
}

export function makeWebhookRoutes(deps: WebhookDeps) {
  return async function webhookRoutes(app: FastifyInstance) {

    // POST /webhook/tg/:token_hash  — Telegram webhook for each master's bot
    app.post<{ Params: { token_hash: string } }>('/tg/:token_hash', {
      config: { rateLimit: false },
    }, async (req, reply) => {
      const master = await deps.mastersRepo.findByTokenHash(req.params.token_hash);
      if (!master) return reply.status(200).send(); // 200 even if unknown — don't leak 404

      // Constant-time comparison is not needed here since the secret is already in the URL path
      const secret = req.headers['x-telegram-bot-api-secret-token'];
      if (master.bot_webhook_secret && secret !== master.bot_webhook_secret) {
        return reply.status(200).send();
      }

      try {
        await deps.botManager.handleUpdate(master.id, req.body);
      } catch (err) {
        app.log.error(err, 'bot-manager handleUpdate failed');
      }
      return reply.status(200).send('ok');
    });
  };
}
