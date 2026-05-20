'use strict';

const https = require('https');

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY      = 'bb_masters_v1';

function kvCmd(...args) {
  return new Promise((resolve, reject) => {
    const url  = new URL(KV_URL);
    const body = Buffer.from(JSON.stringify(args), 'utf8');
    const req  = https.request({
      hostname: url.hostname,
      path:     '/',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': body.length,
        'Authorization':  `Bearer ${KV_TOKEN}`,
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!KV_URL || !KV_TOKEN) {
    // KV not configured — return empty list, catalog shows demo masters only
    return res.status(200).json([]);
  }

  try {
    if (req.method === 'GET') {
      const r       = await kvCmd('GET', KEY);
      const masters = r?.result ? JSON.parse(r.result) : [];
      return res.status(200).json(Array.isArray(masters) ? masters : []);
    }

    if (req.method === 'POST') {
      const m = req.body;
      if (!m?.id) return res.status(400).json({ error: 'Missing id' });

      const r       = await kvCmd('GET', KEY);
      const masters = r?.result ? JSON.parse(r.result) : [];
      const idx     = masters.findIndex(x => x.id === m.id);
      if (idx >= 0) masters[idx] = m;
      else masters.push(m);

      await kvCmd('SET', KEY, JSON.stringify(masters));
      return res.status(200).json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    console.error('masters api error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
};
