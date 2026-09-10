// Call Autopilot (v4.98.0) — pure helpers, unit-tested (mirrors holdState.js).
// Phrase-driven auto start/end: the platform's own announcements
// ("call is being bridged", "the caller has disconnected") drive the session.
// Audio is armed by one manual CONNECT per browser session (browser rule).

export const AUTOPILOT_END_COUNTDOWN_MS = 10000;
export const AUTOPILOT_START_COOLDOWN_MS = 25000;
export const AUTOPILOT_MIN_CALL_SECS = 60;

export const DEFAULT_START_PHRASES = [
  'call is being bridged',
  'bridging you with',
  'bridging you to',
  'i have a call for you',
  'caller is on the line',
  'your caller is on the line',
];

export const DEFAULT_END_PHRASES = [
  'caller has disconnected',
  'has disconnected the call',
  'caller has hung up',
  'call has ended',
  'call is complete',
  'thank you for using',
];

// Queue-wait announcements must NOT start a call — they contain
// start-like wording ("connecting you") while still in the waiting room.
export const DEFAULT_QUEUE_PHRASES = [
  'please continue to hold',
  'your call is important',
  'all representatives are busy',
  'all interpreters are busy',
  'estimated wait',
  'you are in queue',
  'you are number',
];

const PHRASES_KEY = 'catint_autopilot_phrases_v1';

/** Effective phrase lists: saved overrides or the shipped defaults. */
export const loadAutopilotPhrases = () => {
  const pick = (v, fallback) =>
    Array.isArray(v) && v.some((s) => typeof s === 'string' && s.trim())
      ? v.filter((s) => typeof s === 'string' && s.trim())
      : fallback;
  try {
    const raw = JSON.parse(localStorage.getItem(PHRASES_KEY) || 'null');
    return {
      start: pick(raw?.start, DEFAULT_START_PHRASES),
      end: pick(raw?.end, DEFAULT_END_PHRASES),
      queue: pick(raw?.queue, DEFAULT_QUEUE_PHRASES),
    };
  } catch {
    return { start: DEFAULT_START_PHRASES, end: DEFAULT_END_PHRASES, queue: DEFAULT_QUEUE_PHRASES };
  }
};

export const saveAutopilotPhrases = (phrases) => {
  try {
    localStorage.setItem(PHRASES_KEY, JSON.stringify(phrases));
    return true;
  } catch {
    return false;
  }
};

const parseLines = (text) =>
  String(text || '')
    .toLowerCase()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Settings textarea ⇄ phrase lists. */
export const phrasesToText = ({ start = [], end = [] }) =>
  `# one phrase per line — a transcript containing any of these STARTS the call\n${start.join('\n')}\n\n# a transcript containing any of these ENDS it (10s cancellable)\n${end.join('\n')}`;

export const textToPhrases = (text, prev) => {
  const start = [];
  const end = [];
  let bucket = start;
  parseLines(text).forEach((line) => {
    if (/^#\s.*starts? the call/i.test(line)) return;
    if (/^#\s.*ends? it/i.test(line)) { bucket = end; return; }
    if (line.startsWith('#')) return;
    bucket.push(line);
  });
  return {
    start: start.length ? start : prev.start,
    end: end.length ? end : prev.end,
    queue: prev.queue,
  };
};

/** First start phrase found, or null. Queue wording in the SAME utterance vetoes the start. */
export const matchCallStartPhrase = (transcript, phrases = loadAutopilotPhrases()) => {
  const lowTranscript = String(transcript || '').toLowerCase();
  if (!lowTranscript) return null;
  if ((phrases.queue || []).some((p) => lowTranscript.includes(p))) return null;
  return phrases.start.find((p) => lowTranscript.includes(p)) || null;
};

/** First end phrase found, or null. */
export const matchCallEndPhrase = (transcript, phrases = loadAutopilotPhrases()) => {
  const lowTranscript = String(transcript || '').toLowerCase();
  if (!lowTranscript) return null;
  return phrases.end.find((p) => lowTranscript.includes(p)) || null;
};

/** Auto-START gate: armed, idle (not zombie), and out of the post-end cooldown. */
export const canAutopilotStart = ({ enabled, isActive, isZombie, cooldownRemainsMs }) =>
  !!enabled && !isActive && !isZombie && cooldownRemainsMs <= 0;

/** Auto-END gate: armed, live call, not on hold, past the first-minute echo window. */
export const canAutopilotEnd = ({ enabled, isActive, isHold, callAgeSecs }) =>
  !!enabled && !!isActive && !isHold && callAgeSecs >= AUTOPILOT_MIN_CALL_SECS;
