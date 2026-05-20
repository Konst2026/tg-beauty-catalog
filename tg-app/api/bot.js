'use strict';

const https = require('https');

const TOKEN  = process.env.BOT_TOKEN;
const APP_URL = 'https://tg-app-mu-two.vercel.app';

function apiCall(method, data) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(data), 'utf8');
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function send(chatId, text, extra = {}) {
  return apiCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

const OPEN_BTN = {
  reply_markup: {
    inline_keyboard: [[{ text: '💅 Открыть BeautyBook', web_app: { url: APP_URL } }]],
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(200).send('BeautyBook Bot OK'); return; }

  try {
    const msg = req.body?.message;
    if (!msg) { res.status(200).send('ok'); return; }

    const chatId    = msg.chat.id;
    const text      = msg.text || '';
    const firstName = msg.from?.first_name || 'друг';

    if (text.startsWith('/start')) {
      await send(chatId,
        `👋 Привет, ${firstName}!\n\n` +
        `BeautyBook — маркетплейс бьюти-мастеров прямо в Telegram.\n\n` +
        `💅 Маникюр, ресницы, брови, волосы — всё в одном месте\n` +
        `📅 Портфолио мастеров и онлайн-запись за минуту\n` +
        `⭐ Только проверенные мастера с отзывами\n\n` +
        `Нажмите кнопку ниже, чтобы начать 👇`,
        OPEN_BTN
      );
      await send(chatId,
        `🎁 <b>Подарок для новых клиентов!</b>\n\n` +
        `Скидка <b>15%</b> на первую запись к любому мастеру.\n\n` +
        `Промокод: <code>BEAUTY15</code>\n\n` +
        `Введите его при записи и сэкономьте 💸`
      );
      await send(chatId,
        `💼 <b>Вы Бьюти Мастер?</b>\n\n` +
        `Настройте свой профиль — добавьте фото портфолио, укажите услуги и расписание.\n\n` +
        `Клиенты найдут вас и запишутся онлайн 📲`,
        {
          reply_markup: {
            inline_keyboard: [[{
              text: '✏️ Настроить профиль Бьюти Мастера',
              web_app: { url: APP_URL + '?role=master' },
            }]],
          },
        }
      );
    } else if (text.startsWith('/help')) {
      await send(chatId,
        `ℹ️ <b>Как пользоваться BeautyBook</b>\n\n` +
        `1️⃣ Нажмите «Открыть BeautyBook»\n` +
        `2️⃣ Выберите роль: Клиент или Мастер\n` +
        `3️⃣ Клиент: найдите мастера, выберите услугу и время\n` +
        `4️⃣ Мастер: ведите кабинет и принимайте записи\n\n` +
        `<b>Команды:</b>\n` +
        `/start — открыть приложение\n` +
        `/help — эта справка\n` +
        `/contact — написать нам`,
        OPEN_BTN
      );
    } else if (text.startsWith('/contact')) {
      await send(chatId,
        `📬 <b>Связь с поддержкой</b>\n\n` +
        `Есть вопросы или предложения?\n\n` +
        `👉 Напишите нам: @Konst2026\n\n` +
        `Отвечаем в течение 24 часов 🕐`
      );
    } else {
      await send(chatId, `Нажмите /start чтобы открыть BeautyBook 💅`, OPEN_BTN);
    }
  } catch (e) {
    console.error('bot error:', e);
  }

  res.status(200).send('ok');
};
