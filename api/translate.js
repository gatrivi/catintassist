/* Vercel translation gateway (v4.85.0). Keys never enter the browser bundle. */
const crypto = require('crypto');
const env = (name) => (process.env[name] || '').trim();
const fail = (provider, error) => ({ provider, error: `${error || 'failed'}`.slice(0, 40) });

const timedFetch = async (url, options, ms = 1800) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
};

const azure = async (text, from, to) => {
  const key = env('AZURE_TRANSLATOR_KEY');
  if (!key) return null;
  const region = env('AZURE_TRANSLATOR_REGION') || 'brazilsouth';
  const r = await timedFetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${from}&to=${to}`, {
    method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Ocp-Apim-Subscription-Region': region, 'Content-Type': 'application/json' }, body: JSON.stringify([{ Text: text }]),
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return (await r.json())?.[0]?.translations?.[0]?.text || '';
};

const deepl = async (text, from, to) => {
  const key = env('DEEPL_API_KEY');
  if (!key) return null;
  const r = await timedFetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST', headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: [text], source_lang: from.toUpperCase(), target_lang: to.toUpperCase() }),
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return (await r.json())?.translations?.[0]?.text || '';
};

const google = async (text, from, to) => {
  const key = env('GOOGLE_TRANSLATE_API_KEY');
  if (!key) return null;
  const r = await timedFetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return (await r.json())?.data?.translations?.[0]?.translatedText || '';
};

const hmac = (key, data, encoding) => crypto.createHmac('sha256', key).update(data, 'utf8').digest(encoding);
const sha256 = (data) => crypto.createHash('sha256').update(data, 'utf8').digest('hex');
const aws = async (text, from, to) => {
  const accessKey = env('AWS_ACCESS_KEY_ID');
  const secret = env('AWS_SECRET_ACCESS_KEY');
  if (!accessKey || !secret) return null;
  const region = env('AWS_REGION') || 'us-east-1';
  const host = `translate.${region}.amazonaws.com`;
  const body = JSON.stringify({ SourceLanguageCode: from, TargetLanguageCode: to, Text: text });
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const headers = { 'content-type': 'application/x-amz-json-1.1', host, 'x-amz-date': amzDate, 'x-amz-target': 'AWSShineFrontendService_20170701.TranslateText' };
  if (env('AWS_SESSION_TOKEN')) headers['x-amz-security-token'] = env('AWS_SESSION_TOKEN');
  const signed = Object.keys(headers).sort();
  const canonicalHeaders = signed.map((k) => `${k}:${headers[k]}\n`).join('');
  const canonical = `POST\n/\n\n${canonicalHeaders}\n${signed.join(';')}\n${sha256(body)}`;
  const scope = `${date}/${region}/translate/aws4_request`;
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 'translate');
  const signature = hmac(hmac(kService, 'aws4_request'), `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonical)}`, 'hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${signature}`;
  const r = await timedFetch(`https://${host}/`, { method: 'POST', headers, body });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return (await r.json())?.TranslatedText || '';
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { text, sourceLang, targetLang } = req.body || {};
  if (typeof text !== 'string' || !text.trim() || text.length > 5000) return res.status(400).json({ error: 'invalid_text' });
  if (!['en', 'es'].includes(sourceLang) || !['en', 'es'].includes(targetLang) || sourceLang === targetLang) return res.status(400).json({ error: 'invalid_language_pair' });
  const failures = [];
  for (const [id, translate] of [['azure', azure], ['deepl', deepl], ['google_cloud', google], ['aws', aws]]) {
    try {
      const translation = await translate(text.trim(), sourceLang, targetLang);
      if (translation) return res.status(200).json({ translation, engineId: id });
    } catch (error) { failures.push(fail(id, error.message)); }
  }
  return res.status(503).json({ error: 'no_provider_available', failures });
};
