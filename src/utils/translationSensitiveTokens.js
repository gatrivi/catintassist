/**
 * Sensitive-token extract / diff / salvage for translation reliability (v4.82.0).
 * Digit-normalized compare: 5551234567 ≡ 555-123-4567 (not missing).
 */
import { copyableDigits } from './sensitiveDataProtector';

const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b|\b\d{10,11}\b/g;
const DOB_RE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g;
const DOSAGE_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|cc|iu|units?|mEq|milligrams?|micrograms?|gramos?|miligramos?|mililitros?|unidades?)\b/gi;
const ADDRESS_RE =
  /\b\d{1,6}\s+[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9.'-]*(?:\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Ct|Court|Way|Calle|Avenida|Carrera)\.?)?\b/gi;
const ID_RE = /\b(?:SSN|ID|MRN|member\s*#?)\s*[:#]?\s*[\dA-Za-z-]{4,}\b|\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/gi;

const SALVAGE_PREFIX = ' [⚠ Check: ';
const SALVAGE_SUFFIX = ']';

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const collect = (text, re) => {
  if (!text) return [];
  const out = [];
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m;
  while ((m = r.exec(text)) !== null) out.push(m[0].trim());
  return uniq(out);
};

/** @returns {{ phones: string[], dobs: string[], dosages: string[], addresses: string[], ids: string[] }} */
export function extractSensitiveTokens(text) {
  const src = String(text || '');
  return {
    phones: collect(src, PHONE_RE),
    dobs: collect(src, DOB_RE),
    dosages: collect(src, DOSAGE_RE),
    addresses: collect(src, ADDRESS_RE),
    ids: collect(src, ID_RE),
  };
}

/** Normalize for equality — digits-only when both have digits; else lower trim. */
export function normalizeTokenForCompare(token) {
  const raw = String(token || '').trim();
  const digits = copyableDigits(raw);
  if (digits && /\d/.test(raw) && digits.length >= 7) return `d:${digits}`;
  // dosages: collapse spaces + lower unit
  const dosage = raw.match(
    /^(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|ml|cc|iu|units?|meq|milligrams?|micrograms?|gramos?|miligramos?|mililitros?|unidades?)$/i,
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
  ];
};

/**
 * Tokens in `before` not present in `after` (digit-normalized).
 * @returns {string[]} display forms from source that are missing
 */
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

/** Append explicit salvage markers: ` [⚠ Check: TOKEN]` */
export function salvageSensitiveTokens(translated, missing) {
  const base = String(translated || '').trim();
  const list = (missing || []).map((t) => String(t).trim()).filter(Boolean);
  if (!list.length) return base;
  const markers = list.map((t) => `${SALVAGE_PREFIX}${t}${SALVAGE_SUFFIX}`).join('');
  return `${base}${markers}`.trim();
}

export const SENSITIVE_SALVAGE_MARKER_RE = /\[⚠ Check:\s*([^\]]+)\]/g;
