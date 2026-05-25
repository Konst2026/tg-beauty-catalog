import { Bot } from 'grammy';
import type { INotificationPort } from '@/domain/ports/notification.port';
import type { IBotManager } from '@/domain/ports/bot-manager.port';
import { env } from '@/shared/config/env';

export class TelegramNotificationAdapter implements INotificationPort {
  private readonly platformBot: Bot;

  constructor(private readonly botManager: IBotManager) {
    this.platformBot = new Bot(env.BOT_TOKEN);
  }

  async notifyMaster(masterId: string, masterTelegramId: number, text: string): Promise<void> {
    try {
      await this.botManager.sendMessage(masterId, masterTelegramId, text);
    } catch {
      await this.platformBot.api.sendMessage(masterTelegramId, text).catch(() => {});
    }
  }

  async notifyClient(clientTelegramId: number, text: string): Promise<void> {
    await this.platformBot.api.sendMessage(clientTelegramId, text).catch(() => {});
  }
}
