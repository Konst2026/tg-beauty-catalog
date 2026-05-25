import { createHash, randomBytes } from 'crypto';
import type { IMasterRepository }    from '@/domain/ports/master.repo.port';
import type { ITelegramBotApiPort }  from '@/domain/ports/telegram-bot-api.port';
import type { TokenCrypto }          from '@/shared/lib/token-crypto';
import { DomainError }               from '@/shared/errors/domain-error';

export class ConnectBotUseCase {
  constructor(
    private readonly mastersRepo:  IMasterRepository,
    private readonly botApi:       ITelegramBotApiPort,
    private readonly tokenCrypto:  TokenCrypto,
    private readonly platformUrl:  string,
  ) {}

  async execute(masterId: string, token: string): Promise<{ botUsername: string }> {
    const master = await this.mastersRepo.findById(masterId);
    if (!master) throw new DomainError('Master not found', 'MASTER_NOT_FOUND');

    const botInfo = await this.botApi.getMe(token);

    const tokenHash    = createHash('sha256').update(token).digest('hex');
    const webhookSecret = randomBytes(32).toString('hex');
    const webhookUrl    = `${this.platformUrl}/webhook/tg/${tokenHash}`;

    await this.botApi.setWebhook(token, webhookUrl, webhookSecret);

    const encryptedToken = this.tokenCrypto.encrypt(token);
    await this.mastersRepo.updateBotInfo(masterId, {
      bot_token:          encryptedToken,
      bot_token_hash:     tokenHash,
      bot_username:       botInfo.username,
      bot_webhook_secret: webhookSecret,
    });

    return { botUsername: botInfo.username };
  }
}
