// Sensitive-data protector helpers (pure functions).
// Goal: keep phone/SSN-like digit formatting and STT safeguards reusable for
// other models/agents without dragging UI/context into prompts.
// v4.28.0

import { flagVanish } from './vanishTrace';

// ------------------------------
// Display-time helpers (UI)
// ------------------------------

export const normalizeAccents = (str) =>
  (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ---------------------------------------------------------------------------
// LANE-AWARE number-word conversion
// ---------------------------------------------------------------------------
// BREAKING BUG (v4.27): convertEnglishNumberWords ran the SAME map on BOTH
// panes, so Spanish words like "once" (eleven in ES) were converted in English
// text (where "once" means "at one time"), and vice-versa English words like
// "two" were converted inside Spanish sentences.
//
// FIX: Accept an optional `lang` parameter ('en' | 'es', default 'en').
//   - 'en' → only English number words; Spanish words are untouched.
//   - 'es' → only Spanish number words; English words are untouched.
//
// The signature is backward-compatible: existing callers that omit `lang`
// continue to get English-only behaviour.
//
// SECONDARY BUG: the old regex replaced words in-place inside sentences,
// which caused the replaced digit to absorb surrounding whitespace when the
// word was followed by punctuation or a newline, creating run-on text.
// FIX: the replacement preserves any trailing punctuation found after the
// matched word.
// ---------------------------------------------------------------------------

const EN_NUMBER_MAP = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14',
  fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19',
  twenty: '20', thirty: '30', forty: '40', fifty: '50',
  sixty: '60', seventy: '70', eighty: '80', ninety: '90',
};

const ES_NUMBER_MAP = {
  cero: '0', uno: '1', dos: '2', tres: '3', cuatro: '4',
  cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
  diez: '10', once: '11', doce: '12', trece: '13', catorce: '14',
  quince: '15', dieciseis: '16', diecisiete: '17', dieciocho: '18', diecinueve: '19',
  veinte: '20', veintiuno: '21', veintidos: '22', veintitres: '23',
  veinticuatro: '24', veinticinco: '25', veintiseis: '26', veintisiete: '27',
  veintiocho: '28', veintinueve: '29',
  treinta: '30', cuarenta: '40', cincuenta: '50', sesenta: '60',
  setenta: '70', ochenta: '80', noventa: '90',
};

export const convertEnglishNumberWords = (text, lang = 'en') => {
  const map = lang === 'es' ? ES_NUMBER_MAP : EN_NUMBER_MAP;
  const keys = Object.keys(map).join('|');
  // Capture optional trailing punctuation so it doesn't get swallowed.
  const re = new RegExp(`\\b(${keys})\\b([,.]?)`, 'gi');
  return (text || '').replace(re, (_, matched, punct) => {
    const digit = map[normalizeAccents(matched)];
    return digit !== undefined ? digit + punct : matched + punct;
  });
};

// ---------------------------------------------------------------------------
// PHONE vs SSN formatting
// ---------------------------------------------------------------------------
// v4.27 always formatted 9-digit runs as phone numbers, turning SSNs
// (NNN-NN-NNNN) into phone-style (NNN-NNN-NNN).
// FIX: 9 digits → SSN format (NNN-NN-NNNN).
//      10 digits → standard US phone (NNN-NNN-NNNN).
//      11 digits starting with 1 → +1 NNN-NNN-NNNN.
//      Other lengths → digit groups of 3 with dashes (unchanged).
// ---------------------------------------------------------------------------

export const formatPhoneAndSSNDigits = (text) => {
  if (!text) return text;
  return text.replace(/\b(?:\d[\s.,-:]*){7,15}\d\b/g, (m, offset, full) => {
    const before = full.slice(Math.max(0, offset - 40), offset);
    const after = full.slice(offset + m.length, offset + m.length + 40);
    if (looksLikeAddressFragment(before, after)) return m;
    if (looksLikeDateFragment(before, after)) return m;

    const digitsOnly = m.replace(/\D/g, '');
    if (digitsOnly.length === 9) {
      // SSN: NNN-NN-NNNN
      return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 5)}-${digitsOnly.slice(5)}`;
    }
    if (digitsOnly.length === 10) {
      // US phone: NNN-NNN-NNNN
      return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      // US phone with country code
      return `+1 ${digitsOnly.slice(1, 4)}-${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }
    return digitsOnly.replace(/(\d{3})(?=\d)/g, '$1-');
  });
};

// ---------------------------------------------------------------------------
// Stitch back-to-back single-digit tokens (phone/SSN dictation)
// ---------------------------------------------------------------------------
// Industry pattern: collapse "5 5 5 1 2 3 4" → "5551234" BEFORE phone grouping.
// Only joins tokens that are exactly one digit; skips address-like context.
// ---------------------------------------------------------------------------

const SINGLE_DIGIT_RUN_RE = /\b\d(?:[\s,.-]+\d)+\b/g;

/** Month token → 1–12 (EN + ES). */
const MONTH_TO_NUM = {
  jan: 1, january: 1, enero: 1,
  feb: 2, february: 2, febrero: 2,
  mar: 3, march: 3, marzo: 3,
  apr: 4, april: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, june: 6, junio: 6,
  jul: 7, july: 7, julio: 7,
  aug: 8, august: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, septiembre: 9, setiembre: 9,
  oct: 10, october: 10, octubre: 10,
  nov: 11, november: 11, noviembre: 11,
  dec: 12, december: 12, diciembre: 12,
};

const MONTH_ALT = Object.keys(MONTH_TO_NUM).sort((a, b) => b.length - a.length).join('|');

const ORDINAL_TO_DAY = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
  fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20, 'twenty-first': 21, 'twenty first': 21,
  'twenty-second': 22, 'twenty second': 22, 'twenty-third': 23, 'twenty third': 23,
  thirtieth: 30, 'thirty-first': 31, 'thirty first': 31,
  primero: 1, primera: 1, segundo: 2, segunda: 2, tercero: 3, tercera: 3,
  cuarto: 4, cuarta: 4, quinto: 5, quinta: 5, sexto: 6, sexta: 6,
  septimo: 7, séptimo: 7, octavo: 8, noveno: 9, decimo: 10, décimo: 10,
};

const pad2 = (n) => String(n).padStart(2, '0');

const normalizeYear = (yRaw) => {
  const y = parseInt(String(yRaw).replace(/\D/g, ''), 10);
  if (!Number.isFinite(y)) return null;
  if (y >= 1000 && y <= 2100) return y;
  if (y >= 0 && y <= 99) return y >= 30 ? 1900 + y : 2000 + y;
  return null;
};

const monthNumFromToken = (tok) => {
  const k = (tok || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return MONTH_TO_NUM[k] || null;
};

const dayFromToken = (tok) => {
  const t = (tok || '').toLowerCase().replace(/,/g, '').trim();
  if (/^\d{1,2}(st|nd|rd|th)?$/i.test(t)) {
    const d = parseInt(t, 10);
    return d >= 1 && d <= 31 ? d : null;
  }
  const ord = ORDINAL_TO_DAY[t] || ORDINAL_TO_DAY[t.replace(/\s+/g, ' ')];
  return ord || null;
};

const isoFromParts = (year, month, day) => {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

/**
 * Find date spans that must highlight/copy as one unit (Phase B).
 * Does not rewrite display text — only reports spans + preferred copy value.
 */
export const findDateUnits = (text) => {
  if (!text) return [];
  const units = [];
  const push = (start, end, raw, iso) => {
    if (start < 0 || end <= start) return;
    // skip overlaps
    if (units.some((u) => !(end <= u.start || start >= u.end))) return;
    units.push({
      start,
      end,
      text: text.slice(start, end),
      iso: iso || null,
      copyValue: iso || text.slice(start, end).trim(),
    });
  };

  // 1) Numeric: M/D/YYYY or D/M/YYYY (ambiguous → still one span; ISO only if unambiguous US-ish)
  const numericRe = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g;
  let m;
  while ((m = numericRe.exec(text))) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const year = m[3] ? normalizeYear(m[3]) : null;
    let iso = null;
    if (year && a >= 1 && a <= 12 && b >= 1 && b <= 31) {
      iso = isoFromParts(year, a, b); // prefer MDY when first ≤12
    } else if (year && b >= 1 && b <= 12 && a >= 1 && a <= 31 && a > 12) {
      iso = isoFromParts(year, b, a); // DMY when day>12
    }
    push(m.index, m.index + m[0].length, m[0], iso);
  }

  // 2) Month name + day + year: May 8 1990 / May 8, 1990 / May 8th 1990
  const mdY = new RegExp(
    `\\b((?:${MONTH_ALT}))\\s+(\\d{1,2}(?:st|nd|rd|th)?|[A-Za-zÁÉÍÓÚáéíóúñÑ-]+)\\s*,?\\s+(\\d{2,4})\\b`,
    'gi',
  );
  while ((m = mdY.exec(text))) {
    const month = monthNumFromToken(m[1]);
    const day = dayFromToken(m[2]);
    const year = normalizeYear(m[3]);
    push(m.index, m.index + m[0].length, m[0], isoFromParts(year, month, day));
  }

  // 3) Day + month + year: 8 May 1990 / 8 de mayo de 1990
  const dmy = new RegExp(
    `\\b(\\d{1,2}(?:st|nd|rd|th)?|[A-Za-zÁÉÍÓÚáéíóúñÑ-]+)\\s+(?:de\\s+)?((?:${MONTH_ALT}))\\s+(?:de\\s+)?(\\d{2,4})\\b`,
    'gi',
  );
  while ((m = dmy.exec(text))) {
    const day = dayFromToken(m[1]);
    const month = monthNumFromToken(m[2]);
    const year = normalizeYear(m[3]);
    if (!day || !month || !year) continue;
    push(m.index, m.index + m[0].length, m[0], isoFromParts(year, month, day));
  }

  return units.sort((a, b) => a.start - b.start);
};

/** True if digit run sits next to a month/year date context — do not stitch. */
export const looksLikeDateFragment = (textBefore, textAfter) => {
  const before = (textBefore || '').slice(-48);
  const after = (textAfter || '').slice(0, 48);
  const monthRe = new RegExp(`\\b(?:${MONTH_ALT})\\b`, 'i');
  if (monthRe.test(before) || monthRe.test(after)) return true;
  if (/\b(?:born|dob|birthday|appointment|appt|fecha|nacimiento|cita)\b/i.test(before)) return true;
  // year sitting after a lone day digit
  if (/^\s*(?:de\s+)?(?:\d{4}|'\d{2})\b/i.test(after) && /\b\d{1,2}\s*$/.test(before)) return true;
  return false;
};

const DATE_MASK = (i) => `\uE000D${i}\uE001`;

/** Mask date spans so stitch/phone format cannot tear them apart. */
export const maskDateUnits = (text) => {
  const units = findDateUnits(text);
  if (!units.length) return { text, units: [], restore: (t) => t };
  let out = '';
  let cursor = 0;
  units.forEach((u, i) => {
    out += text.slice(cursor, u.start);
    out += DATE_MASK(i);
    cursor = u.end;
  });
  out += text.slice(cursor);
  const restore = (masked) => {
    let restored = masked;
    units.forEach((u, i) => {
      restored = restored.split(DATE_MASK(i)).join(u.text);
    });
    return restored;
  };
  return { text: out, units, restore };
};

/**
 * Split for highlight/copy: date → dosage → money units, then number regex on gaps.
 * @returns {{ type: 'text'|'number'|'date'|'dosage'|'money'|'address'|'email', value: string, copyValue?: string }[]}
 */
export const findDosageUnits = (text) => {
  if (!text) return [];
  const units = [];
  const re = /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|cc|iu|units?|mEq|milligrams?|micrograms?|grams?|milliliters?|miligramos?|microgramos?|gramos?|mililitros?|unidades?)\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    units.push({
      start: m.index,
      end: m.index + raw.length,
      text: raw,
      copyValue: raw.replace(/\s+/g, ' ').trim(),
    });
  }
  return units;
};

export const findMoneyUnits = (text) => {
  if (!text) return [];
  const units = [];
  const re = /(?:[$€£]\s*\d+(?:[.,]\d{2})?|\b\d+(?:[.,]\d{2})?\s*(?:dollars?|pesos?|usd|ars|copay|co-pay|copago|coaseguro)\b)/gi;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const digits = raw.replace(/[^\d.,]/g, '');
    units.push({
      start: m.index,
      end: m.index + raw.length,
      text: raw,
      copyValue: digits || raw.trim(),
    });
  }
  return units;
};

const STREET_TYPE_WORD =
  '(?:street|st|avenue|ave|boulevard|blvd|drive|dr|road|rd|lane|ln|court|ct|place|pl|way|circle|cir|highway|hwy|parkway|pkwy|terrace|ter)';

const US_STATE_NAMES =
  'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming';

/** Address spans for highlight/copy (street #, unit, zip) — display only. */
export const findAddressUnits = (text) => {
  if (!text) return [];
  const units = [];
  const overlaps = (start, end) =>
    units.some((u) => !(end <= u.start || start >= u.end));

  const push = (start, end, raw, copyValue) => {
    if (start < 0 || end <= start || overlaps(start, end)) return;
    units.push({
      start,
      end,
      text: raw,
      copyValue: copyValue ?? raw.trim(),
    });
  };

  const streetBeforeType = new RegExp(
    `\\b(\\d{1,6})\\s*,?\\s*(?:[A-Za-z][\\w.'-]+\\s+){0,2}${STREET_TYPE_WORD}\\b`,
    'gi',
  );
  let m;
  while ((m = streetBeforeType.exec(text))) {
    const num = m[1];
    push(m.index, m.index + num.length, num, copyableDigits(num));
  }

  const numberCue = /\b(?:number|no\.?|#)\s+(\d{1,6})\b/gi;
  while ((m = numberCue.exec(text))) {
    const num = m[1];
    push(m.index + m[0].indexOf(num), m.index + m[0].indexOf(num) + num.length, num, copyableDigits(num));
  }

  const unitRe = /\b(?:unit|apt|apartment|suite|ste)\s*,?\s*#?\s*(\d{1,6})\b/gi;
  while ((m = unitRe.exec(text))) {
    const num = m[1];
    push(m.index + m[0].indexOf(num), m.index + m[0].indexOf(num) + num.length, num, copyableDigits(num));
  }

  const stateZip = new RegExp(`\\b(?:${US_STATE_NAMES})\\s*,?\\s*(\\d{5})(?:-(\\d{4}))?\\b`, 'gi');
  while ((m = stateZip.exec(text))) {
    const zip = m[1] + (m[2] ? `-${m[2]}` : '');
    push(m.index + m[0].indexOf(m[1]), m.index + m[0].indexOf(m[1]) + zip.length, zip, zip);
  }

  const zipCue = /\b(?:zip(?:\s*code)?|postal(?:\s*code)?|c[oó]digo postal)\s*(?:is\s*)?(\d{5})(?:-(\d{4}))?\b/gi;
  while ((m = zipCue.exec(text))) {
    const zip = m[1] + (m[2] ? `-${m[2]}` : '');
    push(m.index + m[0].indexOf(m[1]), m.index + m[0].indexOf(m[1]) + zip.length, zip, zip);
  }

  return units.sort((a, b) => a.start - b.start);
};

/** Email spans for highlight/copy. */
export const findEmailUnits = (text) => {
  if (!text) return [];
  const units = [];
  const re = /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    units.push({
      start: m.index,
      end: m.index + raw.length,
      text: raw,
      copyValue: raw,
    });
  }
  return units;
};

/** Merge non-overlapping typed units; earlier/longer wins on overlap. */
const mergeTypedUnits = (groups) => {
  const all = [];
  groups.forEach(({ type, units }) => {
    units.forEach((u) => all.push({ ...u, type }));
  });
  all.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const out = [];
  all.forEach((u) => {
    if (out.some((x) => !(u.end <= x.start || u.start >= x.end))) return;
    out.push(u);
  });
  return out.sort((a, b) => a.start - b.start);
};

export const splitHighlightSegments = (text) => {
  if (!text) return [];
  const units = mergeTypedUnits([
    { type: 'date', units: findDateUnits(text) },
    { type: 'dosage', units: findDosageUnits(text) },
    { type: 'money', units: findMoneyUnits(text) },
    { type: 'address', units: findAddressUnits(text) },
    { type: 'email', units: findEmailUnits(text) },
  ]);
  const segments = [];
  let cursor = 0;

  const pushNumberSplits = (chunk) => {
    if (!chunk) return;
    const parts = chunk.split(NUMBER_HIGHLIGHT_REGEX);
    parts.forEach((p) => {
      if (!p) return;
      if (p.match(NUMBER_HIGHLIGHT_REGEX)) {
        segments.push({ type: 'number', value: p, copyValue: copyableDigits(p) });
      } else {
        segments.push({ type: 'text', value: p });
      }
    });
  };

  units.forEach((u) => {
    pushNumberSplits(text.slice(cursor, u.start));
    segments.push({ type: u.type, value: u.text, copyValue: u.copyValue });
    cursor = u.end;
  });
  pushNumberSplits(text.slice(cursor));
  return segments;
};

/** Clipboard value for a highlighted sensitive span. */
export const copyableSensitiveValue = (value, type = 'number') => {
  if (type === 'date') {
    const units = findDateUnits(String(value));
    if (units[0]?.copyValue) return units[0].copyValue;
    return String(value || '').trim();
  }
  if (type === 'dosage') {
    const units = findDosageUnits(String(value));
    if (units[0]?.copyValue) return units[0].copyValue;
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
  if (type === 'money') {
    const units = findMoneyUnits(String(value));
    if (units[0]?.copyValue) return units[0].copyValue;
    return String(value || '').trim();
  }
  if (type === 'address') {
    const units = findAddressUnits(String(value));
    if (units[0]?.copyValue) return units[0].copyValue;
    return copyableDigits(value);
  }
  if (type === 'email') {
    const units = findEmailUnits(String(value));
    if (units[0]?.copyValue) return units[0].copyValue;
    return String(value || '').trim();
  }
  return copyableDigits(value);
};

export const stitchSingleDigitSequences = (text, { minDigits = 2, ignoreAddressGuard = false } = {}) => {
  if (!text) return text;
  return text.replace(SINGLE_DIGIT_RUN_RE, (match, offset, full) => {
    const parts = match.split(/[\s,.-]+/).filter(Boolean);
    if (parts.length < minDigits || !parts.every((p) => /^\d$/.test(p))) return match;

    const before = full.slice(Math.max(0, offset - 40), offset);
    const after = full.slice(offset + match.length, offset + match.length + 40);
    if (!ignoreAddressGuard && looksLikeAddressFragment(before, after)) return match;
    if (looksLikeDateFragment(before, after)) return match;

    const trailingPunct = match.match(/[,.]$/)?.[0] || '';
    return parts.join('') + trailingPunct;
  });
};

/**
 * Sentinel display brakes (Phase C).
 * - Skip stitch: date/email/spelling (address may stitch — phone format still skipped)
 * - Skip phone/SSN format: those + dosage/medication/price (keep stitch for "5 0 0 mg")
 * - phone + ssn modes: full transforms allowed
 */
export const DISPLAY_SKIP_STITCH_MODES = new Set([
  'date',
  'email',
  'spelling',
]);

export const DISPLAY_SKIP_PHONE_FORMAT_MODES = new Set([
  'date',
  'address',
  'email',
  'spelling',
  'dosage',
  'medication',
  'price',
]);

export const shouldSkipDigitStitch = (mode) =>
  Boolean(mode && DISPLAY_SKIP_STITCH_MODES.has(mode));

export const shouldSkipPhoneFormat = (mode) =>
  Boolean(mode && DISPLAY_SKIP_PHONE_FORMAT_MODES.has(mode));

/** @deprecated use shouldSkipPhoneFormat — kept for older call sites */
export const shouldSkipPhoneDigitTransforms = (mode) => shouldSkipPhoneFormat(mode);

/** Display pipeline order (transcript + translation panes). */
export const applyDisplayProtections = (text, lang = 'en', { applyNumberWords = true } = {}) => {
  if (!text) return text;
  let out = text;
  if (applyNumberWords) out = convertEnglishNumberWords(out, lang);

  // Phase C: sentinels gate stitch/phone — display brake only (overlap unchanged).
  const sentinel = detectSentinelContext(out, lang);
  const skipStitch = shouldSkipDigitStitch(sentinel.mode);
  const skipPhone = shouldSkipPhoneFormat(sentinel.mode);
  const stitchOpts = { ignoreAddressGuard: sentinel.mode === 'address' };

  const { text: masked, restore } = maskDateUnits(out);
  out = masked;

  if (!skipStitch) {
    const afterWords = out;
    out = stitchSingleDigitSequences(out, stitchOpts);
    if (out !== afterWords) {
      flagVanish('display_digit_stitch', {
        before: afterWords,
        after: out,
        stage: 'applyDisplayProtections',
        force: true,
        extra: { step: 'stitchSingleDigitSequences', sentinel: sentinel.mode },
      });
    }
  }

  if (!skipPhone) {
    const afterStitch = out;
    out = formatPhoneAndSSNDigits(out);
    if (out !== afterStitch && /\d/.test(afterStitch)) {
      flagVanish('display_phone_ssn_reformat', {
        before: afterStitch,
        after: out,
        stage: 'applyDisplayProtections',
        force: true,
        extra: { step: 'formatPhoneAndSSNDigits', sentinel: sentinel.mode },
      });
    }
  }

  out = repairNYCZipNumbers(out);
  out = restore(out);
  return out;
};

export const copyableDigits = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || String(value || '').trim();
};

// NYC ZIP REPAIR — unchanged from v4.27
export const repairNYCZipNumbers = (text) => {
  if (!text) return text;
  return text.replace(/\b(New York|NY|N\.Y\.)\s*,?\s*(\d{3})\b/gi, (m, city, zip) => {
    const suffix = zip.slice(-2);
    return `${city} 100${suffix}`;
  });
};

// NÚMEROS MÁGICOS — unchanged from v4.27
export const NUMBER_HIGHLIGHT_REGEX = /(\+?\(?\d{1,4}?\)?[\s.-]?\(?\d{2,4}?\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\b\d+[\d.,/\\-]*\b)/g;
export const getNumberHighlightRegex = () =>
  new RegExp(NUMBER_HIGHLIGHT_REGEX.source, 'g');

// ---------------------------------------------------------------------------
// CRITICAL MEDICAL/ADMIN DATA PROTECTION (pure regex + helpers)
// ---------------------------------------------------------------------------

const EN_DATE_CUE_RE =
  /\b(date|when|scheduled|schedule|appointment|appt|follow[- ]?up|rescheduled|booked|due)\b/i;

const ES_DATE_CUE_RE =
  /\b(fecha|cu[aá]ndo|programad[oa]|agendad[oa]|turno|cita|control|seguimiento|reprogramad[oa]|vence)\b/i;

const MONTH_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|enero|febrero|marzo|abril|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i;

const MAY_DATE_RE =
  /\bmay\s+(?:\d{1,2}|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty[-\s]first|twenty[-\s]second|twenty[-\s]third|thirtieth|thirty[-\s]first)\b/i;

const WEEKDAY_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i;

const ORDINAL_RE =
  /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty[-\s]first|twenty[-\s]second|twenty[-\s]third|thirtieth|thirty[-\s]first|primero|segunda?|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo)\b/i;

const NUMERIC_DATE_RE = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/;

const CLOCK_TIME_RE =
  /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm)\b/i;

const MED_CUE_RE =
  /\b(medication|medicine|med|dose|dosage|prescription|prescribed|pharmacy|pill|tablet|capsule|insulin|medicamento|medicina|dosis|receta|recetad[oa]|farmacia|pastilla|comprimido|c[aá]psula|insulina)\b/i;

const DOSAGE_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|cc|iu|units?|mEq|milligrams?|micrograms?|grams?|milliliters?|miligramos?|microgramos?|gramos?|mililitros?|unidades?)\b/i;

const FREQUENCY_RE =
  /\b(once|twice|daily|nightly|every|per day|a day|bid|tid|qid|prn|una vez|dos veces|diari[oa]|cada|por d[ií]a|por noche)\b/i;

const PRICE_CUE_RE =
  /\b(price|cost|costs|charge|fee|pay|paid|payment|copay|co-pay|consultation|procedure|medication|medicine|cuesta|costo|precio|pagar|pag[oó]|cobran|consulta|procedimiento|medicamento|medicina|copago|coaseguro)\b/i;

const MONEY_RE =
  /(?:[$€£]\s*\d+(?:[.,]\d{2})?|\b\d+(?:[.,]\d{2})?\s*(?:dollars?|pesos?|usd|ars|copay|co-pay|copago|coaseguro)\b)/i;

export const hasCriticalDataCue = (text) => {
  if (!text) return false;
  return (
    EN_DATE_CUE_RE.test(text) ||
    ES_DATE_CUE_RE.test(text) ||
    MED_CUE_RE.test(text) ||
    PRICE_CUE_RE.test(text)
  );
};

export const containsCriticalData = (text) => {
  if (!text) return false;

  return (
    NUMERIC_DATE_RE.test(text) ||
    CLOCK_TIME_RE.test(text) ||
    MONTH_RE.test(text) ||
    MAY_DATE_RE.test(text) ||
    WEEKDAY_RE.test(text) ||
    ORDINAL_RE.test(text) ||
    DOSAGE_RE.test(text) ||
    MONEY_RE.test(text) ||
    (MED_CUE_RE.test(text) && FREQUENCY_RE.test(text)) ||
    (PRICE_CUE_RE.test(text) && /\d/.test(text))
  );
};

// ---------------------------------------------------------------------------
// CONTEXT SENTINELS
// ---------------------------------------------------------------------------
// Detects "about to spell something" contexts so downstream STT logic can
// switch into pass-through / protected mode and avoid mangling proper nouns,
// emails, and addresses.
//
// Returns an object:
//   { mode: 'spelling' | 'email' | 'ssn' | 'phone' | 'address' | 'date' | 'medication' | 'dosage' | 'price' | null,
//     lang: 'en' | 'es' }
//
// Call this BEFORE convertEnglishNumberWords or formatPhoneAndSSNDigits.
// If mode is non-null, skip or limit further transformations.
// ---------------------------------------------------------------------------

const EN_SENTINELS = {
  spelling: [
    /\bspell(ing)?\b/i,
    /\bspelled\b/i,
    /\bmy name is\b/i,
    /\blast name\b/i,
    /\bfirst name\b/i,
    /\bsurname\b/i,
  ],
  email: [
    /\be-?mail\b/i,
    /\b@\b/,
    /\bdot com\b/i,
    /\bat the rate\b/i,
    /\bat sign\b/i,
  ],
  ssn: [
    /\bsocial\b/i,
    /\bssn\b/i,
    /\bsecurity number\b/i,
  ],
  phone: [
    /\bphone\b/i,
    /\bcell\b/i,
    /\bmobile\b/i,
    /\bnumber is\b/i,
    /\bcall me at\b/i,
    /\bcontact number\b/i,
    /\bcall back\b/i,
  ],
  address: [
    /\b(mailing|home|street|billing)?\s*address\b/i,
    /\b(?:for\s+)?verification\b/i,
    /\bhipaa\b/i,
    /\blive(s)? (at|on)\b/i,
    /\bzip( code)?\b/i,
    /\bapartment\b/i,
    /\bfloor\b/i,
    /\bsuite\b/i,
    /\b(north|south|east|west)\b/i,
    /\bavenue\b/i,
    /\bstreet\b/i,
    /\bboulevard\b/i,
    /\bdrive\b/i,
    /\broad\b/i,
  ],
  date: [
    EN_DATE_CUE_RE,
    MONTH_RE,
    WEEKDAY_RE,
    NUMERIC_DATE_RE,
    CLOCK_TIME_RE,
  ],
  medication: [MED_CUE_RE],
  dosage: [MED_CUE_RE, DOSAGE_RE, FREQUENCY_RE],
  price: [PRICE_CUE_RE, MONEY_RE],
};

const ES_SENTINELS = {
  spelling: [
    /\b(c[oó]mo se escribe|deletrea[r]?|se escribe)\b/i,
    /\bnombre\b/i,
    /\bapellido\b/i,
  ],
  email: [
    /\bcorreo\b/i,
    /\be-?mail\b/i,
    /\barroba\b/i,
    /\bpunto com\b/i,
  ],
  ssn: [
    /\bseguro social\b/i,
    /\bnúmero de seguro\b/i,
    /\bssn\b/i,
  ],
  phone: [
    /\btelefono\b/i,
    /\bcel(ular)?\b/i,
    /\bnúmero de tel[eé]fono\b/i,
    /\bllamar al\b/i,
  ],
  address: [
    /\bdirecci[oó]n\b/i,
    /\bcalle\b/i,
    /\bavenida\b/i,
    /\bcodigo postal\b/i,
    /\bapartamento\b/i,
    /\bpiso\b/i,
  ],
  date: [
    ES_DATE_CUE_RE,
    MONTH_RE,
    WEEKDAY_RE,
    NUMERIC_DATE_RE,
    CLOCK_TIME_RE,
  ],
  medication: [MED_CUE_RE],
  dosage: [MED_CUE_RE, DOSAGE_RE, FREQUENCY_RE],
  price: [PRICE_CUE_RE, MONEY_RE],
};

export const detectSentinelContext = (text, lang = 'en') => {
  if (!text) return { mode: null, lang };
  const sentinels = lang === 'es' ? ES_SENTINELS : EN_SENTINELS;
  for (const [mode, patterns] of Object.entries(sentinels)) {
    if (patterns.some((re) => re.test(text))) {
      return { mode, lang };
    }
  }
  return { mode: null, lang };
};

// ---------------------------------------------------------------------------
// ADDRESS-AWARE digit protection
// ---------------------------------------------------------------------------
// US addresses can contain numeric street names: "20 West 34th Street".
// Naively joining/reformatting those digits breaks the address.
// This function checks if a digit sequence is likely part of an address
// (preceded or followed by directional/street-type words) and if so,
// returns the digits as-is rather than phone-formatting them.
//
// Used internally by formatPhoneAndSSNDigits and exported for testing.
// ---------------------------------------------------------------------------

const STREET_TYPE_RE = /\b(street|st|avenue|ave|boulevard|blvd|drive|dr|road|rd|lane|ln|court|ct|place|pl|way|circle|cir|highway|hwy|route|rt|parkway|pkwy|terrace|ter)\b/i;
const DIRECTION_RE = /\b(north|south|east|west|northeast|northwest|southeast|southwest|n|s|e|w|ne|nw|se|sw)\b/i;

export const looksLikeAddressFragment = (textBefore, textAfter) => {
  const before = (textBefore || '').slice(-40);
  const after = (textAfter || '').slice(0, 40);
  return (
    STREET_TYPE_RE.test(before) ||
    STREET_TYPE_RE.test(after) ||
    DIRECTION_RE.test(before) ||
    DIRECTION_RE.test(after)
  );
};

// ---------------------------------------------------------------------------
// STT / protection helpers (unchanged signatures)
// ---------------------------------------------------------------------------

const normalize = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty',
  'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand',
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
  'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis',
  'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidos',
  'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete',
  'veintiocho', 'veintinueve', 'treinta', 'cuarenta', 'cincuenta', 'sesenta',
  'setenta', 'ochenta', 'noventa', 'cien', 'ciento', 'mil',
]);

export const normalizeWord = (w) =>
  w
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const isNumberLike = (word) => {
  if (!word) return false;
  const norm = normalizeWord(word);
  return /^\d+$/.test(norm) || NUMBER_WORDS.has(norm);
};

export const containsNumberSequence = (text, minLength = 2) => {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  let count = 0;
  let numberWords = 0;
  for (const w of words) {
    if (isNumberLike(w)) {
      count++;
      numberWords++;
      if (count >= minLength) return true;
    } else {
      count = 0;
    }
  }

  if (numberWords / words.length > 0.3) return true;
  return false;
};

const FILLER_WORDS = new Set([
  'um', 'uh', 'eh', 'ah', 'like', 'well', 'so', 'okay', 'ok', 'yeah',
  'yep', 'nope', 'hmm', 'hm', 'bueno', 'pues', 'este', 'ees', 'ehm',
]);

const PHRASE_FILLERS = ['you know', 'i mean', 'sort of', 'kind of'];

export const cleanFillerWords = (text) => {
  if (!text) return text;
  let t = text;

  PHRASE_FILLERS.forEach((phrase) => {
    const re = new RegExp(`\\b${phrase}\\b`, 'gi');
    t = t.replace(re, '');
  });

  const words = t.trim().split(/\s+/);
  let startIdx = 0;
  while (
    startIdx < words.length &&
    FILLER_WORDS.has(words[startIdx].toLowerCase().replace(/[^a-z]/g, ''))
  ) {
    startIdx++;
  }

  if (startIdx > 0) {
    t = words.slice(startIdx).join(' ');
  }

  return t.replace(/\s+/g, ' ').trim();
};

export const hallucinationGuard = (text) => {
  if (!text) return text;
  const words = text.trim().split(/\s+/);

  if (words.length === 1) {
    const w = words[0].toLowerCase();
    if (isNumberLike(w)) return text;
    if (w === 'bueno' || w === 'um' || w === 'eh' || w === 'uh' || w === 'ah') {
      flagVanish('hallucination_filler_wipe', {
        before: text,
        after: '',
        stage: 'hallucinationGuard',
        derender: true,
        force: true,
        extra: { filler: w },
      });
      return '';
    }
  }

  if (words.length < 2) return text;

  let cleaned = [];
  let lastWord = '';
  let lastPair = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const norm = normalize(word);
    const pair = i > 0 ? normalize(words[i - 1] + word) : '';

    const localWindow = words
      .slice(Math.max(0, i - 4), i + 5)
      .join(' ');
    const pairWindow = words
      .slice(Math.max(0, i - 5), i + 6)
      .join(' ');

    if (
      norm === lastWord &&
      norm.length > 1 &&
      !isNumberLike(word) &&
      !containsCriticalData(localWindow) &&
      !hasCriticalDataCue(localWindow)
    )
      continue;
    if (
      pair === lastPair &&
      pair.length > 4 &&
      !containsNumberSequence(words.slice(i - 1, i + 1).join(' ')) &&
      !containsCriticalData(pairWindow) &&
      !hasCriticalDataCue(pairWindow)
    )
      continue;

    cleaned.push(word);
    lastWord = norm;
    lastPair = pair;
  }

  if (
    words.length > 15 &&
    cleaned.length < words.length * 0.5 &&
    !containsNumberSequence(text, 2) &&
    !containsCriticalData(text)
  ) {
    const pruned = `${cleaned.slice(0, 12).join(' ')}... [Stutter Pruned]`;
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') console.log('[PRUNED]', text, '→', cleaned.slice(0, 12).join(' '));
    flagVanish('hallucination_stutter_prune', {
      before: text,
      after: pruned,
      stage: 'hallucinationGuard',
      force: true,
    });
    return pruned;
  }

  const out = cleanFillerWords(cleaned.join(' '));
  if (out !== text && cleaned.length < words.length) {
    flagVanish('hallucination_stutter_dedupe', {
      before: text,
      after: out,
      stage: 'hallucinationGuard',
    });
  }
  return out;
};

export const removeOverlapPreservingDigitSequences = (base, addition) => {
  if (!base || !addition) return addition;

  const bWords = base.trim().split(/\s+/).map(normalize);
  const aWords = addition.trim().split(/\s+/).map(normalize);
  const aWordsRaw = addition.trim().split(/\s+/);

  let bestOverlap = 0;
  const maxCheck = Math.min(aWords.length, bWords.length, 50);

  for (let i = 1; i <= maxCheck; i++) {
    const aPrefix = aWords.slice(0, i).join('');
    const bSuffix = bWords.slice(-i).join('');
    if (aPrefix === bSuffix) {
      bestOverlap = i;
    }
  }

  if (bestOverlap > 0) {
    const overlapSlice = aWordsRaw.slice(0, bestOverlap);
    const overlapText = overlapSlice.join(' ');
    const boundaryText = [
      base.trim().split(/\s+/).slice(-10).join(' '),
      aWordsRaw
        .slice(0, Math.min(aWordsRaw.length, bestOverlap + 8))
        .join(' '),
    ].join(' ');
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') console.log('[OVERLAP]', bestOverlap, 'words:', overlapText);
    if (
      /\d/.test(overlapText) ||
      overlapSlice.some(isNumberLike) ||
      containsCriticalData(overlapText) ||
      containsCriticalData(boundaryText)
    ) {
      bestOverlap = 0;
    }
  }

  const result = aWordsRaw.slice(bestOverlap).join(' ');
  if (bestOverlap > 0 && result !== addition) {
    flagVanish('overlap_strip', {
      before: addition,
      after: result,
      stage: 'removeOverlapPreservingDigitSequences',
      force: true,
      extra: { bestOverlap, baseTail: base.trim().split(/\s+/).slice(-8).join(' ') },
    });
  }
  return result;
};
