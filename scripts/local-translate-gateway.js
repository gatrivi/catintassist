/**
 * Local translation gateway (v4.86.1) — dev only.
 * Runs api/translate.js (the Vercel serverless handler) as a plain Node server
 * so `npm start` can reach /api/translate locally instead of 404ing.
 * Keys come from .env (AZURE_TRANSLATOR_KEY, DEEPL_API_KEY, ...) — never bundled.
 *
 * Usage: npm run gateway  →  http://127.0.0.1:59210/api/translate
 */
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = Number(process.env.TRANSLATE_GATEWAY_PORT || 59210);

// Minimal .env loader (no dotenv dependency).
const envPath = path.join(__dirname, '..', '.env');
try {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch (_) { /* no .env — providers without keys are skipped */ }

const handler = require('../api/translate');

// Express-like res shim for the Vercel handler.
const shim = (res) => {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
};

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/api/translate')) {
    return shim(res).status(404).json({ error: 'not_found' });
  }
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
  req.on('end', () => {
    try { req.body = JSON.parse(body || '{}'); } catch (_) { req.body = {}; }
    handler(req, shim(res));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[translate-gateway] listening on http://127.0.0.1:${PORT}/api/translate`);
});
