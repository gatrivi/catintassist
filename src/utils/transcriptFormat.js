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

/** One line per spelled unit — same bubble, easier to scan */
export const formatSpellingText = (text, lang = 'en') => {
  if (!text || !isSpellingBlock(text)) return text;

  const parts = text.split(/,\s*/).map((p) => formatSpellingSegment(p, lang));
  return parts.filter(Boolean).join('\n');
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

export const formatTranscriptForDisplay = (text, lang = 'en') => {
  if (!text) return text;
  return formatSpellingText(text, lang);
};

export const applyTranscriptFormatting = (text, lang = 'en') => formatTranscriptForDisplay(text, lang);
