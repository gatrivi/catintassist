#!/usr/bin/env node
/**
 * Audio eval — the only step that talks to Deepgram (v4.161.0).
 *
 * Reads src/fixtures/audio/manifest.json, POSTs each clip to /v1/listen once per
 * config under test, and writes the provider text to provider-text.json. Nothing
 * is scored here: scoring is pure and lives in jest (npm run eval:audio), because
 * src/ is ESM inside a CJS package and a node CLI cannot import it without a
 * build step.
 *
 * Usage:
 *   node scripts/eval-audio.js                 # every config
 *   node scripts/eval-audio.js general medical # only these configs
 *   node scripts/eval-audio.js --dry           # list what it would do, no network
 *
 * The key is read from .env.local/.env by the same code dg-health-probe.js uses,
 * and is never printed. Clips are WAV (ffmpeg converts anything else):
 *   ffmpeg -i my.m4a -ar 16000 -ac 1 -c:a pcm_s16le src/fixtures/audio/clips/x.wav
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const FIX = path.join(root, 'src', 'fixtures', 'audio');
const CLIPS = path.join(FIX, 'clips');
const OUT = path.join(FIX, 'provider-text.json');

// A hand-rolled mirror of buildListenUrl, deliberately NOT importing src/.
// If the app's URL ever changes, change this too — and the doc says so.
const CONFIGS = {
  general: (lang) => ({ model: 'nova-3-general', language: lang }),
  medical: (lang) => ({ model: 'nova-3-medical', language: lang }),
  keyterm: (lang) => ({ model: 'nova-3-general', language: lang, keyterm: '1' }),
};

function loadKey() {
  for (const file of ['.env.local', '.env']) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^\s*REACT_APP_DEEPGRAM_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return null;
}

function postAudio(query, key, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.deepgram.com',
        path: `/v1/listen?${query}`,
        method: 'POST',
        headers: {
          Authorization: `Token ${key}`,
          'Content-Type': 'audio/wav',
          'Content-Length': body.length,
        },
        timeout: 30000,
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
    req.write(body);
    req.end();
  });
}

const buildQuery = (cfg, lang) => {
  const parts = [
    `model=${cfg.model}`,
    'smart_format=true',
    'numerals=true',
    'filler_words=true',
    'words=true',
    `language=${lang}`,
    `keyterm=${cfg.keyterm === '1' ? 'albuterol' : ''}`,
  ];
  return parts.filter((p) => !p.endsWith('=')).join('&');
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry');
  const wanted = argv.filter((a) => !a.startsWith('--'));
  const configs = wanted.length ? wanted : Object.keys(CONFIGS);

  if (!fs.existsSync(FIX)) {
    console.error('No audio corpus yet. See docs/development/audio-eval.md');
    process.exit(1);
  }
  const manifest = readJson(path.join(FIX, 'manifest.json'));
  const missing = manifest.filter((c) => !fs.existsSync(path.join(CLIPS, c.file)));

  console.log(`Audio eval — ${manifest.length} clips, ${missing.length} not recorded yet`);
  if (missing.length) {
    console.log(`\nStill to record (${missing.length}):`);
    missing.slice(0, 30).forEach((c) => console.log(`  ${c.id}  —  ${c.reference}`));
    console.log('\nSave as .wav in src\\fixtures\\audio\\clips\\ (ffmpeg command in the doc).');
  }
  const ready = manifest.filter((c) => !missing.includes(c));
  if (!ready.length) {
    console.log('\nNothing recorded yet — stopping before spending anything.');
    process.exit(0);
  }
  if (dry) {
    console.log(`\n--dry: would send ${ready.length} clips x ${configs.length} config(s).`);
    process.exit(0);
  }

  const key = loadKey();
  if (!key) {
    console.error('No REACT_APP_DEEPGRAM_API_KEY in .env.local or .env — stopping.');
    process.exit(1);
  }

  const results = { generatedAt: new Date().toISOString(), configs, runs: {} };
  for (const name of configs) {
    const cfg = CONFIGS[name];
    if (!cfg) {
      console.error(`unknown config "${name}" (have: ${Object.keys(CONFIGS).join(', ')})`);
      process.exit(1);
    }
    results.runs[name] = {};
    console.log(`\n=== ${name} ===`);
    for (const clip of ready) {
      const body = fs.readFileSync(path.join(CLIPS, clip.file));
      try {
        const res = await postAudio(buildQuery(cfg, clip.lang), key, body);
        const alt = res.json?.results?.channels?.[0]?.alternatives?.[0];
        const text = alt?.transcript || '';
        results.runs[name][clip.id] = {
          transcript: text,
          confidence: alt?.confidence ?? null,
          status: res.status,
        };
        console.log(`  ${clip.id}: "${text}"`);
      } catch (e) {
        results.runs[name][clip.id] = { transcript: '', confidence: null, error: String(e.message || e) };
        console.log(`  ${clip.id}: ERROR ${e.message || e}`);
      }
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${path.relative(root, OUT)} — now run:  npm run eval:audio`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
