'use strict';

// Вспомогательный модуль для запросов к Supabase REST API
// Файл начинается с _ — Vercel не создаёт для него отдельный endpoint

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supabaseRequest(method, table, { body, query } = {}) {
  return new Promise((resolve, reject) => {
    const path = `/rest/v1/${table}${query ? '?' + query : ''}`;
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const hostname = SUPABASE_URL.replace('https://', '');
    const req = https.request({ hostname, path, method, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Найти мастера по полю
async function findMaster(field, value) {
  const rows = await supabaseRequest('GET', 'masters', {
    query: `${field}=eq.${encodeURIComponent(value)}&limit=1`,
  });
  return Array.isArray(rows) ? rows[0] : null;
}

// Обновить мастера по telegram_id
async function updateMaster(telegramId, data) {
  return supabaseRequest('PATCH', 'masters', {
    body: data,
    query: `telegram_id=eq.${telegramId}`,
  });
}

// Создать мастера
async function createMaster(data) {
  return supabaseRequest('POST', 'masters', { body: data });
}

module.exports = { findMaster, updateMaster, createMaster };
