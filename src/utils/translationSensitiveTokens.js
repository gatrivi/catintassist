/**
 * Sensitive-token extract / diff for translation reliability (v4.82.0).
 * Digit-normalized compare: 5551234567 ≡ 555-123-4567 (not missing).
 * v4.93.0: the visible `[⚠ Check: …]` salvage markers are GONE (user request —
 * they made transcripts unreadable and fired on ordinary words like "7 minutes").
 * Digit loss is still tracked via entry.warning/missingTokens and the
 * preserve-previous-good rule; nothing is injected into visible text.
 */
import { copyableDigits } from './sensitiveDataProtector';

const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b|\b\d{10,11}\b/g;
const DOB_RE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g;
const DOSAGE_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|cc|iu|units?|mEq|milligrams?|micrograms?|grams?|milliliters?|miligramos?|microgramos?|gramos?|mililitros?|unidades?|tablets?|tabletas?|pills?|pastillas?|capsules?|c[aá]psulas?|drops?|gotas?|puffs?|sprays?|tsp|tbsp|oz|%)\b/gi;
// v4.93.0: street suffix is REQUIRED — "7 minutes" / "1 of" / "5 to" are not addresses.
const ADDRESS_RE =
  /\b\d{1,6}\s+(?:[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9.'-]*\s+){0,3}?(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Ct|Court|Way|Calle|Avenida|Carrera)\.?\b/gi;
const ID_RE = /\b(?:SSN|ID|MRN|member\s*#?)\s*[:#]?\s*[\dA-Za-z-]{4,}\b|\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b|\b(?:mrn|chart)[\s:#]*[\dA-Za-z-]{4,}\b/gi;
// v4.114.0: clerk slot times — "1:00, 1:30" must survive translation (digit-loss safety).
// v4.115.0: 24h "14:30" + bare "3pm".
const TIMES_RE = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:[1-9]|1[0-2])\s*(?:am|pm|a\.m\.|p\.m\.)/gi;
// v4.115.0: money amounts must survive translation too.
const MONEY_TR_RE = /(?:[$€£]\s*\d+(?:[.,]\d{3})*(?:[.,]\d{2})?|\b\d+(?:(?:[.,]\d{3})+)?(?:[.,]\d{2})?\s*(?:dollars?|pesos?|usd|ars|copay|co-pay|copago|coaseguro)\b)/gi;
// v4.116.0: ZIPs were never extracted — short digit typos were invisible.
const ZIP_TR_RE = /\b\d{5}(?:-\d{4})?\b/g;

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const collect = (text, re) => {
  if (!text) return [];
  const out = [];
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m;
  while ((m = r.exec(text)) !== null) out.push(m[0].trim());
  return uniq(out);
};

/** @returns {{ phones: string[], dobs: string[], dosages: string[], addresses: string[], ids: string[], times: string[], money: string[], zips: string[] }} */
export function extractSensitiveTokens(text) {
  const src = String(text || '');
  return {
    phones: collect(src, PHONE_RE),
    dobs: collect(src, DOB_RE),
    dosages: collect(src, DOSAGE_RE),
    addresses: collect(src, ADDRESS_RE),
    ids: collect(src, ID_RE),
    times: collect(src, TIMES_RE),
    money: collect(src, MONEY_TR_RE),
    zips: collect(src, ZIP_TR_RE),
  };
}

/** Normalize for equality — digits-only when both have digits; else lower trim. */
export function normalizeTokenForCompare(token) {
  const raw = String(token || '').trim();
  // v4.116.0: pure-digit tokens compare EXACT at any length — "10027" vs
  // "10072" is a typo (missing), "5" vs "5" is fine. Never fuzzy on numbers.
  if (/^\d+$/.test(raw)) return `d:${raw}`;
  const digits = copyableDigits(raw);
  if (digits && /\d/.test(raw) && digits.length >= 7) return `d:${digits}`;
  // dosages: collapse spaces + lower unit (v4.115.0: same extended unit list)
  const dosage = raw.match(
    /^(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|ml|cc|iu|units?|meq|milligrams?|micrograms?|grams?|milliliters?|miligramos?|microgramos?|gramos?|mililitros?|unidades?|tablets?|tabletas?|pills?|pastillas?|capsules?|c[aá]psulas?|drops?|gotas?|puffs?|sprays?|tsp|tbsp|oz|%)$/i,
  );
  if (dosage) return `dose:${dosage[1].replace(',', '.')}:${dosage[2].toLowerCase()}`;
  return `t:${raw.toLowerCase().replace(/\s+/g, ' ')}`;
}

const flattenTokens = (bag) => {
  if (!bag) return [];
  return [
    ...(bag.phones || []),
    ...(bag.dobs || []),
    ...(bag.dosages || []),
    ...(bag.addresses || []),
    ...(bag.ids || []),
    ...(bag.times || []),
    ...(bag.money || []),
    ...(bag.zips || []),
  ];
};

/** @returns {string[]} display forms from source that are missing */
export function diffSensitiveTokens(beforeText, afterText) {
  const before = flattenTokens(
    typeof beforeText === 'string' ? extractSensitiveTokens(beforeText) : beforeText,
  );
  const after = flattenTokens(
    typeof afterText === 'string' ? extractSensitiveTokens(afterText) : afterText,
  );
  const afterNorm = new Set(after.map(normalizeTokenForCompare));
  return before.filter((tok) => !afterNorm.has(normalizeTokenForCompare(tok)));
}
