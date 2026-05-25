import { Bot }                       from 'grammy';
import type { BotInfo, ITelegramBotApiPort } from '@/domain/ports/telegram-bot-api.port';

export class GrammyBotApiAdapter implements ITelegramBotApiPort {
  async getMe(token: string): Promise<BotInfo> {
    const bot = new Bot(token);
    const me  = await bot.api.getMe();
    return { id: me.id, username: me.username ?? '', first_name: me.first_name };
  }

  async setWebhook(token: string, url: string, secretToken: string): Promise<void> {
    const bot = new Bot(token);
    await bot.api.setWebhook(url, { secret_token: secretToken });
  }

  async deleteWebhook(token: string): Promise<void> {
    const bot = new Bot(token);
    await bot.api.deleteWebhook({ drop_pending_updates: true });
  }
}
