const normalizeClue = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** NATO + common STT spelling clues → letter */
const PHONETIC_MAP = {
  alpha: 'A', alfa: 'A', apple: 'A', manzana: 'A', ana: 'A',
  bravo: 'B', boy: 'B', baker: 'B',
  charlie: 'C', charles: 'C', chicago: 'C',
  delta: 'D', david: 'D', dog: 'D',
  echo: 'E', eco: 'E', edward: 'E',
  foxtrot: 'F', frank: 'F', francisco: 'F',
  golf: 'G', george: 'G',
  hotel: 'H', henry: 'H',
  india: 'I', indigo: 'I',
  juliet: 'J', john: 'J', juan: 'J',
  kilo: 'K', king: 'K',
  lima: 'L', london: 'L', luis: 'L',
  mary: 'M', maria: 'M', marie: 'M', mike: 'M', mexico: 'M',
  november: 'N', nancy: 'N', noviembre: 'N',
  oscar: 'O', ocean: 'O',
  peter: 'P', pedro: 'P', paul: 'P', papa: 'P',
  quebec: 'Q', queen: 'Q',
  romeo: 'R', robert: 'R', roger: 'R',
  sierra: 'S', sam: 'S', samuel: 'S', sugar: 'S',
  tango: 'T', thomas: 'T', tom: 'T',
  uniform: 'U', uncle: 'U', uno: 'U',
  victor: 'V', victory: 'V', victoria: 'V', victoriano: 'V',
  whiskey: 'W', william: 'W', washington: 'W',
  xray: 'X', xavier: 'X',
  yankee: 'Y', yellow: 'Y', yo: 'I',
  zulu: 'Z', zebra: 'Z',
  com: 'COM',
};

const SPECIAL_CLUES = {
  dot: '.',
  period: '.',
  punto: '.',
  point: '.',
  at: '@',
  arroba: '@',
};

const countSpellingMarkers = (text) => {
  const en = (text.match(/\bas\s+in\b/gi) || []).length;
  const es = (text.match(/\bcomo\s+en\b/gi) || []).length;
  return en + es;
};

export const isSpellingBlock = (text) => countSpellingMarkers(text) >= 3;

const deduceChar = (hint, clue) => {
  const h = (hint || '').trim();
  if (h.length === 1 && /[a-zA-Z0-9]/.test(h)) return h.toUpperCase();
  if (h.length <= 3 && /^[a-zA-Z]+$/i.test(h)) {
    const fromHint = PHONETIC_MAP[normalizeClue(h)];
    if (fromHint && fromHint.length === 1) return fromHint;
  }

  const clueNorm = normalizeClue(clue);
  if (SPECIAL_CLUES[clueNorm]) return SPECIAL_CLUES[clueNorm];
  if (PHONETIC_MAP[clueNorm]) {
    const mapped = PHONETIC_MAP[clueNorm];
    return mapped.length === 1 ? mapped : mapped;
  }

  const firstWord = (clue || '').trim().split(/\s+/)[0];
  const fw = normalizeClue(firstWord);
  if (SPECIAL_CLUES[fw]) return SPECIAL_CLUES[fw];
  if (PHONETIC_MAP[fw]) return PHONETIC_MAP[fw];
  if (firstWord && /[a-zA-Z]/.test(firstWord[0])) return firstWord[0].toUpperCase();
  return h.toUpperCase() || '?';
};

const formatSpellingSegment = (segment, lang) => {
  const s = segment.trim();
  if (!s) return '';

  const en = s.match(/^([a-zA-Z0-9])\s+as\s+in\s+(?:the\s+|a\s+)?(.+)$/i);
  if (en) {
    const ch = deduceChar(en[1], en[2]);
    const clue = en[2].trim();
    return ch === '.' || ch === '@' ? ch : `${ch} · ${clue}`;
  }

  const es = s.match(/^(.+?)\s+como\s+en\s+(?:la\s+|el\s+|los\s+|las\s+)?(.+)$/i);
  if (es) {
    const ch = deduceChar(es[1], es[2]);
    const clue = es[2].trim();
    return ch === '.' || ch === '@' ? ch : `${ch} · ${clue}`;
  }

  const solo = normalizeClue(s);
  if (SPECIAL_CLUES[solo]) return SPECIAL_CLUES[solo];
  if (solo === 'com' || s.toLowerCase() === 'punto com') return '.com';

  return s;
};

/**
 * Optional stacked spelling layout (Phase D: NOT used for default display).
 * Prefer spoken paragraph + trailing Spelled chip via consolidateSpelling.
 */
export const formatSpellingText = (text, lang = 'en') => {
  if (!text || !isSpellingBlock(text)) return text;

  const parts = text.split(/,\s*/).map((p) => formatSpellingSegment(p, lang));
  return parts.filter(Boolean).join('\n');
};

/** Collapse spelled segments into one string (e.g. S+M+I+T+H → SMITH). */
export const consolidateSpelling = (text, lang = 'en') => {
  if (!text || !isSpellingBlock(text)) return null;

  const parts = text.split(/,\s*/).map((p) => formatSpellingSegment(p, lang));
  const chars = parts.map((line) => {
    const ch = line.match(/^([A-Za-z0-9@.]+)/);
    if (ch) return ch[1];
    return line.trim().charAt(0).toUpperCase();
  });

  const joined = chars.join('');
  return joined.length >= 2 ? joined : null;
};

/** Words that must never become Name chips (I'm sorry → sorry). */
const NAME_STOPWORDS = new Set([
  'sorry', 'here', 'doctor', 'doctora', 'dr',
  'uh', 'um', 'eh', 'ah', 'oh', 'hmm', 'mm',
  'just', 'going', 'looking', 'calling', 'trying', 'feeling',
  'good', 'fine', 'okay', 'ok', 'well', 'back', 'ready',
  'available', 'afraid', 'happy', 'sad', 'late', 'early',
  'later', 'now', 'there', 'coming', 'leaving',
  'disculpe', 'perdon', 'perdón', 'aqui', 'aquí', 'bien', 'mal',
  // ES roles/conditions after "soy" — never names (tokenStem strips accents)
  'interprete', 'enfermero', 'enfermera', 'paciente', 'medico', 'medica',
  'alergico', 'alergica', 'diabetico', 'diabetica', 'yo', 'el', 'la', 'un', 'una',
]);

/** Strong cues — capitalize not required (STT often lowercases). */
const STRONG_NAME_CUE_PATTERNS = [
  /\b(?:my|patient(?:'s)?)\s+name\s+is\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*){0,2})/gi,
  /\b(?:me llamo|se llama|mi nombre es)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*){0,2})/gi,
  /\bDr\.?\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*){0,1})/gi,
];

/** Weak cues — first token must be Capitalized (blocks I'm sorry). */
const WEAK_NAME_CUE_PATTERNS = [
  /\b(?:this is|I am|I'm)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*){0,2})/gi,
  /\b(?:called|call me)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*){0,2})/gi,
  /\bsoy(?:\s+el|\s+la)?\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ][\wÁÉÍÓÚÜáéíóúüñÑ'.-]*){0,2})/gi,
];

const cleanNameCapture = (raw) =>
  (raw || '').trim().replace(/\s+/g, ' ').replace(/[,.;:!?…]+$/g, '');

const tokenStem = (t) =>
  (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}]/gu, '');

/** @returns {boolean} */
export const isPlausibleCopyableName = (value, { requireCapitalized = false } = {}) => {
  const cleaned = cleanNameCapture(value);
  if (!cleaned || cleaned.length < 2) return false;
  const tokens = cleaned.split(/\s+/);
  if (tokens.some((t) => NAME_STOPWORDS.has(tokenStem(t)))) return false;
  if (requireCapitalized && !/^[A-ZÁÉÍÓÚÑ]/.test(tokens[0])) return false;
  return true;
};

const pushNameMatches = (text, patterns, requireCapitalized, seen, names) => {
  patterns.forEach((re) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const value = cleanNameCapture(m[1]);
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      if (!isPlausibleCopyableName(value, { requireCapitalized })) continue;
      seen.add(key);
      names.push({ kind: 'name', label: 'Name', value });
    }
  });
};

/** Proper-name candidates for one-click copy chips. */
export const extractCopyableNames = (text) => {
  if (!text) return [];
  const seen = new Set();
  const names = [];
  pushNameMatches(text, STRONG_NAME_CUE_PATTERNS, false, seen, names);
  pushNameMatches(text, WEAK_NAME_CUE_PATTERNS, true, seen, names);
  return names;
};

/** Spelling consolidation + name cues → copy chip payloads. */
export const collectCopyableEntities = (text, lang = 'en') => {
  const entities = [];
  const spelled = consolidateSpelling(text, lang);
  if (spelled) entities.push({ kind: 'spelling', label: 'Spelled', value: spelled });
  extractCopyableNames(text).forEach((n) => entities.push(n));
  return entities;
};

/** Split leading complete sentences (ends with . ! ?) from trailing fragment. */
export const peelCompleteSentences = (text) => {
  const sentences = [];
  let rest = (text || '').trim();
  while (rest) {
    const m = rest.match(/^(.+?[.!?…]+)(?:\s+)([\s\S]+)$/);
    if (!m) break;
    const sent = m[1].trim();
    if (!sent) break;
    sentences.push(sent);
    rest = m[2].trim();
  }
  return { sentences, remainder: rest };
};

/** Split long comma-heavy fragments (no sentence end) for translation limits */
export const splitLongTextAtCommas = (text, maxWords = 40) => {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount <= maxWords) return [];
  if (/[.!?…]\s/.test(trimmed) || /[.!?…]$/.test(trimmed)) return [];

  const segments = trimmed.split(/,\s*/);
  if (segments.length < 2) return [];

  const chunks = [];
  let current = '';

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const candidate = current ? `${current}, ${seg}` : seg;
    const wc = candidate.split(/\s+/).filter(Boolean).length;

    if (wc > maxWords && current) {
      chunks.push(current.trim());
      current = seg;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 1 ? chunks : [];
};

/**
 * Display path (Phase D): keep spoken paragraph.
 * Spelling consolidation is chip-only via collectCopyableEntities / consolidateSpelling.
 * formatSpellingText (newlines) is opt-in only — not default.
 */
export const formatTranscriptForDisplay = (text, lang = 'en') => {
  if (!text) return text;
  return text;
};

export const applyTranscriptFormatting = (text, lang = 'en') => formatTranscriptForDisplay(text, lang);
