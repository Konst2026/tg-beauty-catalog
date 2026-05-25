import type { Bot } from 'grammy';

export function setupBotHandlers(bot: Bot, miniAppUrl: string): void {
  bot.command('start', async (ctx) => {
    await ctx.reply('Записаться можно через приложение:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '📅 Записаться', web_app: { url: miniAppUrl } },
        ]],
      },
    });
  });

  // Suppress unhandled-update errors (no-op for unknown update types)
  bot.catch((err) => {
    console.error('[bot-handler] unhandled error:', err.message);
  });
}
