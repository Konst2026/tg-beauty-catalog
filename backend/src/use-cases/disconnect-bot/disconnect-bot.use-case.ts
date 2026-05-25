import type { IMasterRepository }   from '@/domain/ports/master.repo.port';
import type { ITelegramBotApiPort } from '@/domain/ports/telegram-bot-api.port';
import type { IBotManager }         from '@/domain/ports/bot-manager.port';
import type { TokenCrypto }         from '@/shared/lib/token-crypto';

export class DisconnectBotUseCase {
  constructor(
    private readonly mastersRepo:  IMasterRepository,
    private readonly botApi:       ITelegramBotApiPort,
    private readonly tokenCrypto:  TokenCrypto,
    private readonly botManager:   IBotManager,
  ) {}

  async execute(masterId: string): Promise<void> {
    const creds = await this.mastersRepo.findBotCredentials(masterId);
    if (creds?.bot_token) {
      try {
        const token = this.tokenCrypto.decrypt(creds.bot_token);
        await this.botApi.deleteWebhook(token);
      } catch {
        // Token may be revoked; proceed to clear DB anyway
      }
    }

    this.botManager.invalidateBot(masterId);

    await this.mastersRepo.updateBotInfo(masterId, {
      bot_token:          null,
      bot_token_hash:     null,
      bot_username:       null,
      bot_webhook_secret: null,
    });
  }
}
