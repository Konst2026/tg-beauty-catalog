import { Bot }                   from 'grammy';
import type { Update }           from '@grammyjs/types';
import { setupBotHandlers }      from './bot-handlers';
import type { IBotManager }      from '@/domain/ports/bot-manager.port';
import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import type { TokenCrypto }      from '@/shared/lib/token-crypto';

interface BotEntry { bot: Bot; lastUsed: number }

export class BotManager implements IBotManager {
  private readonly cache = new Map<string, BotEntry>();
  private readonly TTL   = 30 * 60 * 1000; // 30 min

  constructor(
    private readonly mastersRepo: IMasterRepository,
    private readonly crypto:      TokenCrypto,
    private readonly miniAppUrl:  string,
  ) {}

  async handleUpdate(masterId: string, update: unknown): Promise<void> {
    const bot = await this.getOrCreate(masterId);
    await bot.handleUpdate(update as Update);
  }

  invalidateBot(masterId: string): void {
    this.cache.delete(masterId);
  }

  private async getOrCreate(masterId: string): Promise<Bot> {
    const entry = this.cache.get(masterId);
    if (entry && Date.now() - entry.lastUsed < this.TTL) {
      entry.lastUsed = Date.now();
      return entry.bot;
    }

    const creds = await this.mastersRepo.findBotCredentials(masterId);
    if (!creds?.bot_token) throw new Error('Bot not configured for master ' + masterId);

    const token = this.crypto.decrypt(creds.bot_token);
    const bot   = new Bot(token);
    setupBotHandlers(bot, this.miniAppUrl);

    this.cache.set(masterId, { bot, lastUsed: Date.now() });
    return bot;
  }
}
