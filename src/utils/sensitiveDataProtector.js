// Sensitive-data protector helpers (pure functions).
// Goal: keep phone/SSN-like digit formatting and STT safeguards reusable for
// other models/agents without dragging UI/context into prompts.
// v4.28.0

import { flagVanish } from './vanishTrace';
import { getArmedExpectedType } from './expectedDataContext';

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
// COMPOUND + DECIMAL numbers (v4.115.0)
// ---------------------------------------------------------------------------
// convertEnglishNumberWords leaves "eighty two" → "80 2", "ochenta y dos" →
// "80 y 2", "two point five" → "2 point 5" — fragments stitch/phone then eat.
// Combine AFTER word conversion, BEFORE clerk expansion:
//   EN "80 2" → "82" · ES "80 y 2" → "82" · "2 point 5"/"2 punto/coma 5" → "2.5"
// ---------------------------------------------------------------------------

export const combineCompoundNumbers = (text, lang = 'en') => {
  let out = text || '';
  if (lang === 'es') {
    out = out.replace(/\b([2-9]0)\s+y\s+([1-9])\b/gi, (_, t, u) => `${parseInt(t, 10) + parseInt(u, 10)}`);
    out = out.replace(/\b(\d+)\s+(?:punto|coma)\s+(\d+)\b/gi, '$1.$2');
  } else {
    out = out.replace(/\b([2-9]0)\s+([1-9])\b/g, (_, t, u) => `${parseInt(t, 10) + parseInt(u, 10)}`);
    out = out.replace(/\b(\d+)\s+point\s+(\d+)\b/gi, '$1.$2');
  }
  return out;
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

export const formatPhoneAndSSNDigits = (text, { ignoreAddressGuard = false, ignoreDateGuard = false, allowNonStandardDash = false, expectedType = null } = {}) => {
  if (!text) return text;
  // v4.117.0: armed ID request overrides the ZIP/MRN verbatim brakes below.
  const armedFull =
    expectedType === 'phone' || expectedType === 'ssn' || expectedType === 'member';
  const armedId = expectedType === 'ssn' || expectedType === 'member';
  return text.replace(/\b(?:\d[\s.,-:]*){7,15}\d\b/g, (m, offset, full) => {
    // v4.114.0: clock times are NEVER phones — "1:00, 1:30, 2:00, 2:30"
    // reads as one 12-digit run to this regex. Colons don't appear in phones.
    if (m.includes(':')) return m;
    // v4.115.0: ZIP+4 is not an SSN — "10027-1234" stays verbatim.
    // v4.117.0: unless an SSN/member ID was just asked for (request wins).
    if (!armedId && /^\d{5}-\d{4}$/.test(m.trim())) return m;
    // v4.115.0: IPs/versions are NEVER phones — "192.168.1.1" (10 digits)
    // must not become a phone number. 2+ dots with digits around = not a phone.
    if (/\d\.\d/.test(m) && (m.match(/\./g) || []).length >= 2) return m;
    const before = full.slice(Math.max(0, offset - 40), offset);
    const after = full.slice(offset + m.length, offset + m.length + 40);
    if (!ignoreAddressGuard && looksLikeAddressFragment(before, after)) return m;
    if (!ignoreDateGuard && looksLikeDateFragment(before, after)) return m;

    const digitsOnly = m.replace(/\D/g, '');
    // v4.115.0: non-phone/SSN lengths (8, 12-16 digits) next to chart cues are
    // MRNs/record numbers — leave undashed. 9/10/11 keep SSN/phone/member
    // behavior (Phase G insurance IDs).
    // v4.117.0: armed phone/ssn/member request overrides (request wins).
    if (
      !armedFull &&
      ![9, 10, 11].includes(digitsOnly.length) &&
      /\b(?:mrn|chart|record|account|afiliado|miembro|expediente|historia|folio)\b/i.test(before)
    ) {
      return m;
    }
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
    // v4.116.0 "when in doubt show both": non-US lengths (8, 12-16 digits)
    // stay EXACTLY as dictated unless an explicit phone/ssn sentinel asked
    // for grouping — a guessed dash pattern is worse than spaced digits.
    if (!allowNonStandardDash) return m;
    return digitsOnly.replace(/(\d{3})(?=\d)/g, '$1-');
  });
};

// ---------------------------------------------------------------------------
// Stitch back-to-back single-digit tokens (phone/SSN dictation)
// ---------------------------------------------------------------------------
// Industry pattern: collapse "5 5 5 1 2 3 4" → "5551234" BEFORE phone grouping.
// Only joins tokens that are exactly one digit; skips address-like context.
// ---------------------------------------------------------------------------

const SINGLE_DIGIT_RUN_RE = /\b\d(?:[\s,./-]+\d)+\b/g;

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

// v4.116.0 "when in doubt show both": ambiguous all-digit dates copy BOTH
// readings — "05/12/1980" → "1980-05-12 / 1980-12-05". Display untouched.
const ambiguousCopy = (year, a, b, primary) => {
  if (!primary || a === b || a < 1 || a > 12 || b < 1 || b > 31) return primary;
  const alt = isoFromParts(year, b, a);
  return alt && alt !== primary ? `${primary} / ${alt}` : primary;
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
      iso = ambiguousCopy(year, a, b, iso);
    } else if (year && b >= 1 && b <= 12 && a >= 1 && a <= 31 && a > 12) {
      iso = isoFromParts(year, b, a); // DMY when day>12
    }
    push(m.index, m.index + m[0].length, m[0], iso);
  }

  // v4.115.0: dotted ES dictation "05.12.1980" — full year required so "v1.2"
  // and "room 4.5" never match.
  const dottedRe = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
  while ((m = dottedRe.exec(text))) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const year = normalizeYear(m[3]);
    let iso = null;
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) iso = ambiguousCopy(year, a, b, isoFromParts(year, a, b));
    else if (b >= 1 && b <= 12 && a >= 1 && a <= 31) iso = isoFromParts(year, b, a);
    if (!iso) continue;
    push(m.index, m.index + m[0].length, m[0], iso);
  }

  // v4.115.0: spaced slow dictation "my DOB is 05 12 1980" — cue required.
  // Masked like other dates so stitch/phone can never tear it apart.
  const spacedRe =
    /\b(?:born|dob|birthday|appointment|appt|fecha|nacimiento|cita)\b[^.\n]{0,40}?(\d{1,2})\s+(\d{1,2})\s+(\d{4})\b/gi;
  while ((m = spacedRe.exec(text))) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const year = normalizeYear(m[3]);
    let iso = null;
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) iso = ambiguousCopy(year, a, b, isoFromParts(year, a, b));
    else if (b >= 1 && b <= 12 && a >= 1 && a <= 31) iso = isoFromParts(year, b, a);
    if (!iso) continue;
    // Span starts at the digit triple (tail), not at the cue word.
    const tail = m[0].match(/(\d{1,2}\s+\d{1,2}\s+\d{4})\s*$/);
    const dateText = tail ? tail[1] : `${m[1]} ${m[2]} ${m[3]}`;
    const start = m.index + m[0].lastIndexOf(dateText);
    const end = start + dateText.length;
    push(start, end, text.slice(start, end), iso);
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
  // v4.114.0: clerk slot lists — "we have 1 1 30" adjacent to availability nouns.
  if (/\b(?:available|availability|spots?|openings?|slots?|scheduled?|appointment|appt|disponibles?|disponibilidad|huecos?|cupos?|turnos?)\b/i.test(before)) return true;
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
 * @returns {{ type: 'text'|'number'|'date'|'schedule'|'dosage'|'money'|'address'|'email', value: string, copyValue?: string }[]}
 */
// v4.115.0 unit list: pills/tablets/drops/puffs + ES gotas/pastillas/tabletas.
const DOSAGE_UNITS_ALT =
  'mg|mcg|g|ml|cc|iu|units?|mEq|milligrams?|micrograms?|grams?|milliliters?|miligramos?|microgramos?|gramos?|mililitros?|unidades?|tablets?|tabletas?|pills?|pastillas?|capsules?|c[aá]psulas?|drops?|gotas?|puffs?|sprays?|tsp|tbsp|oz|%';

export const findDosageUnits = (text) => {
  if (!text) return [];
  const units = [];
  const re = new RegExp(`\\b\\d+(?:[.,]\\d+)?\\s*(?:${DOSAGE_UNITS_ALT})\\b`, 'gi');
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
  // v4.115.0: thousand separators — "$1,234.56" is ONE unit, not "$1,23"+"4.56".
  const re = /(?:[$€£]\s*\d+(?:[.,]\d{3})*(?:[.,]\d{2})?|\b\d+(?:(?:[.,]\d{3})+)?(?:[.,]\d{2})?\s*(?:dollars?|pesos?|usd|ars|copay|co-pay|copago|coaseguro)\b)/gi;
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

  // v4.115.0: Spanish street-first order — "Calle 45 # 12-34",
  // "Avenida 6-23", "calle Juárez 420". Whole span is one unit so
  // stitch/phone can never tear the number off the street.
  const esStreetRe =
    /\b(calle|avenida|av\.?|carrera|cra\.?|bulevar)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ.'-]*\s*)?#?\s*(\d{1,6}(?:\s*[–-]\s*\d{1,6})?)/gi;
  while ((m = esStreetRe.exec(text))) {
    const raw = m[0];
    push(m.index, m.index + raw.length, raw, copyableDigits(m[3]));
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

/**
 * Spoken email spans (v4.115.0): "juan at gmail dot com" / "maría arroba
 * correo punto com". Display stays verbatim — only highlight + clipboard
 * reconstruct "user@domain.tld". Requires an "at ... dot" chain so
 * "meet at noon tomorrow" never matches.
 */
export const findSpokenEmailUnits = (text) => {
  if (!text) return [];
  const units = [];
  const re =
    /\b([A-Za-z0-9._%+-]+)\s+(?:at|arroba)\s+([A-Za-z0-9-]+(?:\s+(?:dot|punto)\s+[A-Za-z0-9-]+)+)/gi;
  let m;
  while ((m = re.exec(text))) {
    const addr = `${m[1]}@${m[2].replace(/\s+(?:dot|punto)\s+/gi, '.')}`;
    units.push({ start: m.index, end: m.index + m[0].length, text: m[0], copyValue: addr });
  }
  return units.sort((a, b) => a.start - b.start);
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
    { type: 'schedule', units: findScheduleUnits(text) },
    { type: 'dosage', units: findDosageUnits(text) },
    { type: 'money', units: findMoneyUnits(text) },
    { type: 'address', units: findAddressUnits(text) },
    { type: 'email', units: findEmailUnits(text) },
    { type: 'email', units: findSpokenEmailUnits(text) },
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
  if (type === 'schedule') {
    const units = findScheduleUnits(String(value));
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
    const spoken = findSpokenEmailUnits(String(value));
    if (spoken[0]?.copyValue) return spoken[0].copyValue;
    return String(value || '').trim();
  }
  return copyableDigits(value);
};

export const stitchSingleDigitSequences = (text, { minDigits = 2, ignoreAddressGuard = false, ignoreDateGuard = false } = {}) => {
  if (!text) return text;
  return text.replace(SINGLE_DIGIT_RUN_RE, (match, offset, full) => {
    // v4.115.0: decimals are NEVER stitchable — "2.5 mg" must not become
    // "25 mg". A dot directly between digits means decimal/version, not dictation.
    if (/\d\.\d/.test(match)) return match;
    const parts = match.split(/[\s,./-]+/).filter(Boolean);
    if (parts.length < minDigits || !parts.every((p) => /^\d$/.test(p))) return match;

    const before = full.slice(Math.max(0, offset - 40), offset);
    const after = full.slice(offset + match.length, offset + match.length + 40);
    if (!ignoreAddressGuard && looksLikeAddressFragment(before, after)) return match;
    if (!ignoreDateGuard && looksLikeDateFragment(before, after)) return match;
    // v4.115.0: chart/MRN dictation stays spaced ("MRN 1 2 3 4 5 6 7 8" is
    // readable and safe). Narrow list on purpose: member/policy/afiliado IDs
    // belong to Phase G SSN grouping and must still stitch.
    if (/\b(?:mrn|chart|record|account|folio|expediente)\b/i.test(before)) return match;

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

// ---------------------------------------------------------------------------
// CLERK TIME SHORTHAND (v4.114.0)
// ---------------------------------------------------------------------------
// Clerks list slots as "we have 1 1 30, 2 2 30" — that is NOT 1:30, it is
// TWO slots: 1:00 AND 1:30. Without this, stitch reads "1 1 3"→"113"+"0"
// ="1130" and phone-format then eats the whole list ("113-022-30").
// Expand FIRST (right after number-word conversion, before stitch/phone):
//   "1 1 30" → "1:00, 1:30"     "10 10 30" → "10:00, 10:30"
//   "H H 00" → "H:00" (single — avoids "3:00, 3:00" dupes)
// Hours are 1–12; minutes 00–59. H H H (phone-style repeats) never matches
// (third token must be 2 digits), so phone dictation is untouched.
// ---------------------------------------------------------------------------

export const CLERK_TIME_SHORTHAND_RE = /\b(\d{1,2})\s+\1\s+([0-5]\d)\b/;
const CLERK_TIME_SHORTHAND_G = new RegExp(CLERK_TIME_SHORTHAND_RE.source, 'g');

export const expandClerkTimeShorthand = (text) => {
  if (!text) return text;
  return text.replace(CLERK_TIME_SHORTHAND_G, (m, h, mm) => {
    const hour = parseInt(h, 10);
    if (hour < 1 || hour > 12) return m;
    if (mm === '00') return `${h}:00`;
    return `${h}:00, ${h}:${mm}`;
  });
};

/** Bare clock time after expansion — "1:30" with no am/pm. v4.115.0: 24h too. */
export const BARE_CLOCK_TIME_RE = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/;

/**
 * Find schedule/time spans for highlight/copy (v4.114.0).
 * v4.115.0: 24h "14:30" + bare "3pm" join H:MM.
 * Display-only — reports spans + copy value, never rewrites text.
 */
export const findScheduleUnits = (text) => {
  if (!text) return [];
  const units = [];
  const pushRe = (re) => {
    let m;
    while ((m = re.exec(text))) {
      const rawFull = m[1] || m[0];
      // v4.115.0: trailing space from "\s*(am|pm)?" is not part of the time.
      const raw = rawFull.replace(/\s+$/, '');
      const start = m.index + m[0].indexOf(rawFull);
      if (units.some((u) => !(start + raw.length <= u.start || start >= u.end))) continue;
      units.push({ start, end: start + raw.length, text: raw, copyValue: raw.trim() });
    }
  };
  pushRe(/\b((?:[01]?\d|2[0-3]):[0-5]\d\s*(?:a\.?m\.?|p\.?m\.?|am|pm)?)\b/gi);
  pushRe(/\b((?:[1-9]|1[0-2])\s*(?:a\.?m\.?|p\.?m\.?|am|pm))\b/gi);
  return units.sort((a, b) => a.start - b.start);
};

// ---------------------------------------------------------------------------
// WORD TIMES (v4.115.0)
// ---------------------------------------------------------------------------
// After number-word conversion "half past two" is "half past 2" and
// "tres y media" is "3 y media" — normalize to clock form so highlight,
// critical-data guards and translation safety see them:
//   "half past 2" → "2:30" · "3 y media" → "3:30" · "3 y cuarto" → "3:15"
//   "at 3 30" → "at 3:30" (cue-gated: at/around/about/a las/para las/de las)
// ---------------------------------------------------------------------------

export const expandWordTimes = (text) => {
  if (!text) return text;
  let out = text;
  out = out.replace(/\bhalf past (\d{1,2})\b/gi, '$1:30');
  out = out.replace(/\b(\d{1,2})\s+y\s+media\b/gi, '$1:30');
  out = out.replace(/\b(\d{1,2})\s+y\s+cuarto\b/gi, '$1:15');
  out = out.replace(
    /((?:\bat|\baround|\babout|\ba las|\bpara las|\bde las)\s+)((?:[1-9]|1[0-2]))\s+([0-5]\d)\b/gi,
    '$1$2:$3',
  );
  return out;
};

// ---------------------------------------------------------------------------
// ADJACENT DIGIT-REPEAT COLLAPSE (v4.117.0)
// ---------------------------------------------------------------------------
// Chunk straddles duplicate digit groups: "555 123" + "123 4567" merges to
// "555 123 123 4567" (overlap keeps both by design). Exact adjacent repeats
// of digit groups collapse to one copy — information-preserving, logged.
// NEVER collapses runs of identical single digits ("5 5 5 5" stays: that is
// dictation/stutter territory, and stitch owns it).
// ---------------------------------------------------------------------------

const isDigitGroupTok = (t) => {
  const s = (t || '').trim();
  return s.length > 0 && /[\d]/.test(s) && /^[\d\s.,/:-]+$/.test(s);
};

export const collapseAdjacentDigitRepeats = (text) => {
  if (!text) return text;
  const parts = text.match(/\S+\s*/g) || [];
  let collapsed = false;
  for (let k = 4; k >= 1; k -= 1) {
    for (let i = 0; i + 2 * k <= parts.length; i += 1) {
      const a = parts.slice(i, i + k);
      const b = parts.slice(i + k, i + 2 * k);
      if (!a.every(isDigitGroupTok) || !b.every(isDigitGroupTok)) continue;
      // v4.117.0: any run of single-digit tokens ("5 5 | 5 5", "9 1 | 9 1")
      // is dictation/stutter territory — keep both, stitch owns it. Only
      // multi-char groups ("123 | 123") collapse.
      if (a.every((t) => t.trim().length === 1)) continue;
      if (a.map((t) => t.trim()).join(' ') !== b.map((t) => t.trim()).join(' ')) continue;
      const removed = parts.splice(i + k, k).join('').trim();
      collapsed = true;
      flagVanish('display_digit_repeat_collapse', {
        before: text,
        after: parts.join(''),
        stage: 'collapseAdjacentDigitRepeats',
        force: true,
        extra: { removed },
      });
      i -= 1;
    }
  }
  return collapsed ? parts.join('') : text;
};

/** Display pipeline order (transcript + translation panes). */
export const applyDisplayProtections = (text, lang = 'en', { applyNumberWords = true, expectedType = getArmedExpectedType() } = {}) => {
  if (!text) return text;
  let out = text;
  if (applyNumberWords) out = convertEnglishNumberWords(out, lang);
  // v4.115.0: "eighty two" → "82", "dos punto cinco" → "2.5" before stitch.
  if (applyNumberWords) out = combineCompoundNumbers(out, lang);
  // v4.114.0: clerk "1 1 30" → "1:00, 1:30" BEFORE sentinels see the text,
  // so bare-time + schedule cues below can trigger the date display brake.
  out = expandClerkTimeShorthand(out);
  // v4.115.0: "half past 2" → "2:30", "at 3 30" → "at 3:30" before sentinels.
  out = expandWordTimes(out);
  // v4.117.0: straddle dupes ("555 123 123 4567") collapse before sentinels.
  out = collapseAdjacentDigitRepeats(out);

  // Phase C: sentinels gate stitch/phone — display brake only (overlap unchanged).
  // ssn/phone sentinels win over address/date guards (Phase G tests): a dictated
  // ID/phone near "Madison Avenue" or "May 8" must still stitch + group.
  // v4.117.0: armed expectation (asked 2 bubbles ago) counts as a cue:
  // phone/ssn/member force full transform, dob/address force verbatim.
  const armedFull =
    expectedType === 'phone' || expectedType === 'ssn' || expectedType === 'member';
  const armedSkip =
    !armedFull && (expectedType === 'dob' || expectedType === 'address');
  const sentinel = detectSentinelContext(out, lang);
  const skipStitch =
    !armedFull && (shouldSkipDigitStitch(sentinel.mode) || armedSkip);
  const skipPhone =
    !armedFull && (shouldSkipPhoneFormat(sentinel.mode) || armedSkip);
  const fullTransform =
    sentinel.mode === 'ssn' || sentinel.mode === 'phone' || armedFull;
  const stitchOpts = {
    ignoreAddressGuard: sentinel.mode === 'address' || fullTransform,
    ignoreDateGuard: fullTransform,
    // v4.116.0: explicit phone/ssn cue ("my phone is ...") still groups odd
    // lengths; everything else leaves non-US lengths verbatim.
    allowNonStandardDash: fullTransform,
    // v4.117.0: armed request ("asked 2 bubbles ago") overrides ZIP/MRN brakes.
    expectedType: expectedType || null,
  };

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
    out = formatPhoneAndSSNDigits(out, stitchOpts);
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
  /\b(date|when|scheduled|schedule|appointment|appt|follow[- ]?up|rescheduled|booked|due|available|availability|spots?|openings?|slots?|birth|born|dob|age|aged)\b|how old/i;

const ES_DATE_CUE_RE =
  /\b(fecha|cu[aá]ndo|programad[oa]|agendad[oa]|turno|cita|control|seguimiento|reprogramad[oa]|vence|disponibles?|disponibilidad|huecos?|cupos?|turnos?)\b/i;

const MONTH_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|enero|febrero|marzo|abril|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i;

const MAY_DATE_RE =
  /\bmay\s+(?:\d{1,2}|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty[-\s]first|twenty[-\s]second|twenty[-\s]third|thirtieth|thirty[-\s]first)\b/i;

const WEEKDAY_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i;

const ORDINAL_RE =
  /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty[-\s]first|twenty[-\s]second|twenty[-\s]third|thirtieth|thirty[-\s]first|primero|segunda?|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo)\b/i;

const NUMERIC_DATE_RE = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b\d{1,2}\.\d{1,2}\.\d{4}\b/;

// v4.115.0: slow spaced dictation "my DOB is 05 12 1980" — cue required so
// random triples ("take 2 12 pills") never match.
const SPACED_DOB_RE =
  /\b(?:born|dob|birthday|appointment|appt|fecha|nacimiento|cita)\b[^.\n]{0,40}?\d{1,2}\s+\d{1,2}\s+\d{4}\b/i;

const CLOCK_TIME_RE =
  /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm)\b/i;

const MED_CUE_RE =
  /\b(medication|medicine|med|dose|dosage|prescription|prescribed|pharmacy|pill|tablet|capsule|insulin|medicamento|medicina|dosis|receta|recetad[oa]|farmacia|pastilla|comprimido|c[aá]psula|insulina|gotas?|puffs?)\b/i;

const DOSAGE_RE = new RegExp(`\\b\\d+(?:[.,]\\d+)?\\s*(?:${DOSAGE_UNITS_ALT})\\b`, 'i');

const FREQUENCY_RE =
  /\b(once|twice|daily|nightly|every|per day|a day|bid|tid|qid|prn|una vez|dos veces|diari[oa]|cada|por d[ií]a|por noche)\b/i;

const PRICE_CUE_RE =
  /\b(price|cost|costs|charge|fee|pay|paid|payment|copay|co-pay|consultation|procedure|medication|medicine|cuesta|costo|precio|pagar|pag[oó]|cobran|consulta|procedimiento|medicamento|medicina|copago|coaseguro)\b/i;

const MONEY_RE =
  /(?:[$€£]\s*\d+(?:[.,]\d{3})*(?:[.,]\d{2})?|\b\d+(?:(?:[.,]\d{3})+)?(?:[.,]\d{2})?\s*(?:dollars?|pesos?|usd|ars|copay|co-pay|copago|coaseguro)\b)/i;

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
    SPACED_DOB_RE.test(text) ||
    CLOCK_TIME_RE.test(text) ||
    BARE_CLOCK_TIME_RE.test(text) ||
    CLERK_TIME_SHORTHAND_RE.test(text) ||
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
    /\bsocial security\b/i,
    /\bsecurity number\b/i,
    // v4.117.0: request phrasings — "can I have your social?"
    /can i have your (ssn|social|security)/i,
    /what is your (ssn|social)/i,
    // Phase G: insurance IDs (member/affiliate/Medicaid) — same digit unit as SSN.
    /\bmedicaid\b/i,
    /\baffiliate[sd]?\b/i,
    /\bmember (id|number)\b/i,
    /\b(id|identification) number\b/i,
    /\bpolicy number\b/i,
    /\binsurance id\b/i,
  ],
  phone: [
    /\bphone\b/i,
    /\bcell\b/i,
    /\bmobile\b/i,
    // v4.117.0: request phrasings — "can I have your phone number?"
    /can i have your (phone|cell|mobile|contact|number)/i,
    /what is your (phone|cell|mobile|contact)/i,
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
    SPACED_DOB_RE,
    CLOCK_TIME_RE,
    // v4.114.0: clerk slot lists + expanded bare times trigger the date
    // display brake (skip stitch/phone) even with no other cue words.
    CLERK_TIME_SHORTHAND_RE,
    BARE_CLOCK_TIME_RE,
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
    // v4.117.0: request phrasings — "me puede dar su seguro?"
    /(me puede dar|d[ií]game|cu[aá]l es).{0,25}(seguro|afiliado|miembro|medicaid)/i,
    // Phase G: insurance IDs (afiliado/Medicaid) — same digit unit as SSN.
    /\bmedicaid\b/i,
    /\bafiliad[oa]s?\b/i,
    /\bnúmero de identificaci[oó]n\b/i,
    /\bidentificaci[oó]n\b/i,
    /\bnúmero de miembro\b/i,
    /\bp[oó]liza\b/i,
  ],
  phone: [
    /\btelefono\b/i,
    /\bcel(ular)?\b/i,
    /\bnúmero de tel[eé]fono\b/i,
    /\bllamar al\b/i,
    // v4.117.0: request phrasings — "me puede dar su número?"
    /dame (tu|su) n[uú]mero\b/i,
    /(me puede dar|d[ií]game|cu[aá]l es).{0,25}(tel[eé]fono|celular|n[uú]mero)/i,
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
    SPACED_DOB_RE,
    CLOCK_TIME_RE,
    // v4.114.0: same clerk/bare-time brake for the ES lane.
    CLERK_TIME_SHORTHAND_RE,
    BARE_CLOCK_TIME_RE,
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

const STREET_TYPE_RE = /\b(street|st|avenue|ave|boulevard|blvd|drive|dr|road|rd|lane|ln|court|ct|place|pl|way|circle|cir|highway|hwy|route|rt|parkway|pkwy|terrace|ter|calle|avenida|av|carrera|cra|bulevar)\b/i;
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

  // v4.116.0 "never destroy rendered numbers": the normalized join('')
  // treats "12 34" ≡ "1234" ≡ "1 2 3 4". When digits sit near the boundary,
  // only an EXACT raw-word repeat counts as overlap — when in doubt both
  // copies stay on screen and downstream guards sort it out.
  const boundaryHasDigits = /\d/.test(
    `${base.trim().split(/\s+/).slice(-10).join(' ')} ${aWordsRaw.slice(0, 10).join(' ')}`,
  );
  const bCmp = boundaryHasDigits
    ? base.trim().split(/\s+/).map((w) => w.toLowerCase())
    : bWords;
  const aCmp = boundaryHasDigits
    ? aWordsRaw.map((w) => w.toLowerCase())
    : aWords;
  const joiner = boundaryHasDigits ? ' ' : '';

  let bestOverlap = 0;
  const maxCheck = Math.min(aWords.length, bWords.length, 50);

  for (let i = 1; i <= maxCheck; i++) {
    const aPrefix = aCmp.slice(0, i).join(joiner);
    const bSuffix = bCmp.slice(-i).join(joiner);
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
