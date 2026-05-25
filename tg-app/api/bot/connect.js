'use strict';

// POST /api/bot/connect
// Мастер подключает своего бота: передаёт токен → мы верифицируем и сохраняем в Supabase

const https  = require('https');
const crypto = require('crypto');
const { findMaster, updateMaster, createMaster } = require('../_supabase');

const APP_URL = process.env.APP_URL || 'https://tg-app-mu-two.vercel.app';

function tgCall(token, method, data = {}) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(data), 'utf8');
    const req = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${token}/${method}`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).end(); return; }

  const { token, telegram_id, full_name } = req.body || {};
  if (!token || !telegram_id) {
    return res.status(400).json({ error: 'token и telegram_id обязательны' });
  }

  // 1. Проверяем что токен валидный через Telegram API
  const meRes = await tgCall(token, 'getMe');
  if (!meRes.ok) {
    return res.status(400).json({ error: 'Неверный токен бота. Проверь и попробуй снова.' });
  }
  const botInfo = meRes.result;

  // 2. Вычисляем hash токена для URL вебхука (токен в URL не раскрываем)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // 3. Регистрируем webhook у Telegram
  const webhookUrl = `${APP_URL}/api/webhook/${tokenHash}`;
  await tgCall(token, 'setWebhook', { url: webhookUrl });

  // 4. Сохраняем в Supabase — обновляем или создаём запись мастера
  let master = await findMaster('telegram_id', telegram_id);

  const masterData = {
    bot_token:      token,
    bot_token_hash: tokenHash,
    bot_username:   botInfo.username,
    telegram_id:    Number(telegram_id),
    full_name:      full_name || botInfo.first_name || 'Мастер',
    updated_at:     new Date().toISOString(),
  };

  if (master) {
    await updateMaster(telegram_id, masterData);
  } else {
    await createMaster(masterData);
    master = await findMaster('telegram_id', telegram_id);
  }

  return res.status(200).json({
    ok:           true,
    bot_username: botInfo.username,
    webhook_url:  webhookUrl,
    master_id:    master?.id,
  });
};
