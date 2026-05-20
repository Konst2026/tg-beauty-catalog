'use strict';

const https = require('https');

const GIST_ID = 'cf2b26e11667c82f27d37636a8ee8dff';
const TOKEN   = process.env.GITHUB_TOKEN;

function ghApi(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? Buffer.from(JSON.stringify(data), 'utf8') : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'User-Agent':    'BeautyBook',
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github+json',
        ...(body ? { 'Content-Length': body.length } : {}),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function readMasters() {
  const gist = await ghApi('GET', `/gists/${GIST_ID}`);
  const raw  = gist?.files?.['masters.json']?.content || '[]';
  try { return JSON.parse(raw); } catch { return []; }
}

async function writeMasters(masters) {
  await ghApi('PATCH', `/gists/${GIST_ID}`, {
    files: { 'masters.json': { content: JSON.stringify(masters) } },
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!TOKEN) return res.status(200).json([]);  // env not set — silent fallback

  try {
    if (req.method === 'GET') {
      const masters = await readMasters();
      return res.status(200).json(masters);
    }

    if (req.method === 'POST') {
      const m = req.body;
      if (!m?.id) return res.status(400).json({ error: 'Missing id' });

      const masters = await readMasters();
      const idx     = masters.findIndex(x => x.id === m.id);
      if (idx >= 0) masters[idx] = m;
      else masters.push(m);

      await writeMasters(masters);
      return res.status(200).json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    console.error('masters api error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
};
