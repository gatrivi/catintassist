/**
 * Offline Deepgram health probe (key + projects + optional listen WS).
 * Usage: node scripts/dg-health-probe.js
 * Reads REACT_APP_DEEPGRAM_API_KEY from .env.local / .env — never prints the key.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');

function loadKey() {
  for (const file of ['.env.local', '.env']) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^\s*REACT_APP_DEEPGRAM_API_KEY\s*=\s*(.+)$/m);
    if (!m) continue;
    return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return null;
}

function httpsJson(method, urlPath, key, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.deepgram.com',
        path: urlPath,
        method,
        headers: {
          Authorization: `Token ${key}`,
          ...(body ? { 'Content-Type': 'audio/wav', 'Content-Length': body.length } : {}),
        },
        timeout: 20000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch (_) {}
          resolve({ status: res.statusCode, json, raw });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

function tinyWav(seconds = 0.25, sr = 16000) {
  const n = Math.floor(sr * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.sin((2 * Math.PI * 440 * i) / sr) * 8000;
    buf.writeInt16LE(s | 0, 44 + i * 2);
  }
  return buf;
}

async function probeWs(key) {
  let WS;
  let useHeaders = false;
  try {
    WS = require('ws');
    useHeaders = true;
  } catch (_) {
    WS = globalThis.WebSocket;
    if (!WS) return { ok: false, skip: true, detail: 'no WebSocket available' };
  }
  const url =
    'wss://api.deepgram.com/v1/listen?model=nova-3-general&language=en&interim_results=true&endpointing=150';
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try {
        if (typeof ws.terminate === 'function') ws.terminate();
        else ws.close();
      } catch (_) {}
      done({ ok: false, detail: opened ? 'timeout_after_open' : 'timeout_no_open' });
    }, 8000);

    let opened = false;
    const ws = useHeaders
      ? new WS(url, { headers: { Authorization: `Token ${key}` } })
      : new WS(url, ['token', key]);

    const onOpen = () => {
      opened = true;
      ws.close(1000);
    };
    const onClose = (code, reason) => {
      const r = reason && reason.toString ? reason.toString() : String(reason || '');
      done({
        ok: opened && (code === 1000 || code === 1005),
        detail: `close=${code}${r ? ` ${r}` : ''}`,
      });
    };
    const onErr = (err) => done({ ok: false, detail: (err && err.message) || 'ws_error' });

    if (typeof ws.on === 'function') {
      ws.on('open', onOpen);
      ws.on('close', onClose);
      ws.on('error', onErr);
    } else {
      ws.onopen = onOpen;
      ws.onclose = (ev) => onClose(ev.code, ev.reason);
      ws.onerror = () => onErr(null);
    }
  });
}

async function main() {
  const key = loadKey();
  const out = {
    keyPresent: Boolean(key),
    keyLen: key ? key.length : 0,
    keyTail: key && key.length > 4 ? `...${key.slice(-4)}` : '—',
  };
  if (!key) {
    console.log(JSON.stringify({ ...out, verdict: 'NO_KEY' }, null, 2));
    process.exit(2);
  }

  const projects = await httpsJson('GET', '/v1/projects', key);
  out.projectsHttp = projects.status;
  out.projectsOk = projects.status === 200;
  out.projectCount = projects.json?.projects?.length ?? 0;

  const listen = await httpsJson('POST', '/v1/listen?model=nova-3-general&language=en', key, tinyWav());
  out.listenHttp = listen.status;
  out.listenOk = listen.status === 200;

  const ws = await probeWs(key);
  out.ws = ws;

  // Keep verdict logic in sync with src/utils/deepgramDiagnostics.js classifyDeepgramHealthProbe
  const authBad =
    projects.status === 401 ||
    projects.status === 403 ||
    listen.status === 401 ||
    listen.status === 403;
  out.verdict = !key
    ? 'NO_KEY'
    : authBad
      ? 'AUTH_BAD'
      : out.projectsOk && out.listenOk && (ws.ok || ws.skip)
        ? 'OK'
        : 'DEGRADED';

  console.log(JSON.stringify(out, null, 2));
  process.exit(out.verdict === 'OK' ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({ verdict: 'ERROR', detail: err.message }, null, 2));
  process.exit(1);
});
