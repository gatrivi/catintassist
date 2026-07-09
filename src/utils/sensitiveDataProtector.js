// Sensitive-data protector helpers (pure functions).
// Goal: keep phone/SSN-like digit formatting and STT safeguards reusable for
// other models/agents without dragging UI/context into prompts.
// v4.28.0

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

export const stitchSingleDigitSequences = (text, { minDigits = 2 } = {}) => {
  if (!text) return text;
  return text.replace(SINGLE_DIGIT_RUN_RE, (match, offset, full) => {
    const parts = match.split(/[\s,.-]+/).filter(Boolean);
    if (parts.length < minDigits || !parts.every((p) => /^\d$/.test(p))) return match;

    const before = full.slice(Math.max(0, offset - 40), offset);
    const after = full.slice(offset + match.length, offset + match.length + 40);
    if (looksLikeAddressFragment(before, after)) return match;

    const trailingPunct = match.match(/[,.]$/)?.[0] || '';
    return parts.join('') + trailingPunct;
  });
};

/** Display pipeline order (transcript + translation panes). */
export const applyDisplayProtections = (text, lang = 'en', { applyNumberWords = true } = {}) => {
  if (!text) return text;
  let out = text;
  if (applyNumberWords) out = convertEnglishNumberWords(out, lang);
  out = stitchSingleDigitSequences(out);
  out = formatPhoneAndSSNDigits(out);
  out = repairNYCZipNumbers(out);
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
    if (w === 'bueno' || w === 'um' || w === 'eh' || w === 'uh' || w === 'ah') return '';
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
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') console.log('[PRUNED]', text, '→', cleaned.slice(0, 12).join(' '));
    return `${cleaned.slice(0, 12).join(' ')}... [Stutter Pruned]`;
  }

  return cleanFillerWords(cleaned.join(' '));
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

  return aWordsRaw.slice(bestOverlap).join(' ');
};
