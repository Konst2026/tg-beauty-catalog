'use strict';

// POST /api/webhook/[hash]
// Принимает обновления от Telegram для любого бота мастера.
// hash = sha256(bot_token) — так мы находим нужного мастера без раскрытия токена.

const https  = require('https');
const { findMaster } = require('../_supabase');

const APP_URL = process.env.APP_URL || 'https://tg-app-mu-two.vercel.app';

function send(token, chatId, text, extra = {}) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify({
      chat_id: chatId, text, parse_mode: 'HTML', ...extra,
    }), 'utf8');
    const req = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${token}/sendMessage`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, res => { res.resume(); resolve(); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // Telegram требует ответ 200 даже при ошибке — иначе будет повторять запросы
  res.status(200).send('ok');

  if (req.method !== 'POST') return;

  const { hash } = req.query;
  const msg = req.body?.message;
  if (!hash || !msg) return;

  try {
    // Находим мастера по hash токена
    const master = await findMaster('bot_token_hash', hash);
    if (!master || !master.bot_token) return;

    const chatId    = msg.chat.id;
    const text      = msg.text || '';
    const senderId  = msg.from?.id;
    const firstName = msg.from?.first_name || 'друг';

    const isMaster = String(senderId) === String(master.telegram_id);

    if (text.startsWith('/start')) {
      if (isMaster) {
        // Мастер открывает своего бота → показываем кабинет
        await send(master.bot_token, chatId,
          `👋 Привет, ${firstName}! Это твой личный бот.\n\nОткрой кабинет для управления профилем, услугами и записями.`,
          {
            reply_markup: {
              inline_keyboard: [[{
                text: '⚙️ Открыть кабинет мастера',
                web_app: { url: `${APP_URL}?role=master&m=${master.id}` },
              }]],
            },
          }
        );
      } else {
        // Клиент открывает бота мастера → показываем каталог конкретного мастера
        const masterName = master.full_name || 'мастер';
        await send(master.bot_token, chatId,
          `👋 Привет, ${firstName}!\n\nДобро пожаловать к мастеру <b>${masterName}</b>.\n\nЗдесь вы можете посмотреть услуги, портфолио и записаться онлайн.`,
          {
            reply_markup: {
              inline_keyboard: [[{
                text: `💅 Открыть каталог ${masterName}`,
                web_app: { url: `${APP_URL}?m=${master.id}` },
              }]],
            },
          }
        );
      }
    } else if (text.startsWith('/help')) {
      await send(master.bot_token, chatId,
        `ℹ️ Этот бот принадлежит мастеру <b>${master.full_name || ''}</b>.\n\n/start — открыть приложение`
      );
    } else {
      // Любое другое сообщение — предлагаем открыть приложение
      await send(master.bot_token, chatId,
        `Нажмите /start чтобы открыть каталог 💅`
      );
    }
  } catch (e) {
    console.error('webhook error:', e.message);
  }
};
