/**
 * Caption engine v2: the "ledger" (v4.200.0, Phase A: NOT wired into the app yet).
 * Plan: docs/development/caption-engine-v2-plan.md
 *
 * Two pieces, both plain functions:
 *   1. ledgerApply(ledger, payload) stores what Deepgram said, keyed by audio time.
 *      - interim: replaces the draft at the same key
 *      - final:   written ONCE, never edited again (so its text can't vanish)
 *   2. bubblesFrom(ledger) builds the bubbles from the ledger. Same input gives
 *      the same output, and it is rebuilt from scratch on every flush.
 *
 * Why it's safe: Deepgram never re-sends audio it already finalized. So no
 * text-based dedupe is needed (overlap removal, restated detection, digit
 * guard…). Those guards caused the "words missing / paragraph gone" bugs.
 */
import { multiLangOf } from './applyDeepgramTranscriptPayload';
import { isLanguageNeutralChunk } from './captionEngine';
import { applyTranscriptFormatting } from './transcriptFormat';
import { laneSideForLang } from './languageConfig';

// ── tuning (each number has one job) ───────────────────────────────────────
export const BUBBLE_GAP_S = 1.2; // audio silence that starts a new turn
export const SENTENCE_MIN_WORDS = 3; // a sentence end closes a bubble only after this many words
export const BUBBLE_MAX_WORDS = 60; // hard cap: long tirades still split
const EST_WORD_S = 0.35; // end estimate when Deepgram sent no timing
const REWIND_S = 1.0; // clock went backwards this far = reconnect (new epoch)
const MAX_SEGMENTS = 5000; // a whole shift of finals is ~2000

const SENTENCE_RX = /^.+?[.!?…]+["')\]]?(?=\s|$)/;

const tokens = (text) => String(text || '').trim().split(/\s+/).filter(Boolean);
const normTok = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export const createLedger = () => ({ segments: [], epochs: {} });

/** A socket (re)opened: its clock restarts at 0, so later audio gets a new epoch. */
export const ledgerNewEpoch = (ledger, socket = 'multi') => ({
  ...ledger,
  epochs: { ...ledger.epochs, [socket]: (ledger.epochs[socket] || 0) + 1 },
});

const segEnd = (payload, words, start) => {
  const lastWordEnd = Number(words[words.length - 1]?.end);
  if (Number.isFinite(lastWordEnd)) return lastWordEnd;
  const duration = Number(payload?.duration);
  if (Number.isFinite(duration) && duration > 0) return start + duration;
  return start + Math.max(1, words.length || tokens(payload?.channel?.alternatives?.[0]?.transcript).length) * EST_WORD_S;
};

const order = (a, b) => a.epoch - b.epoch || a.start - b.start;

/**
 * Store one Deepgram Results message.
 * @param {object} ledger
 * @param {object} payload Deepgram Results JSON
 * @param {{ socket?: string, pair?: object, now?: number }} [opts]
 * @returns {object} the same ledger when nothing changed, else a new one
 */
export const ledgerApply = (ledger, payload, opts = {}) => {
  const { socket = 'multi', pair = { left: 'en', right: 'es' }, now = Date.now() } = opts;
  const alt = payload?.channel?.alternatives?.[0];
  const text = String(alt?.transcript || '').trim();
  if (!text) return ledger; // empty Results = keepalive, never erases a draft
  const start = Number(payload?.start);
  if (!Number.isFinite(start)) return ledger;
  const isFinal = Boolean(payload?.is_final || payload?.speech_final);
  const words = Array.isArray(alt?.words) ? alt.words : [];

  let next = ledger;
  let epoch = next.epochs[socket] || 0;
  // Safety net: if the socket was reopened and nobody called ledgerNewEpoch,
  // the clock jumping backwards gives it away.
  const mine = next.segments.filter((s) => s.socket === socket && s.epoch === epoch && s.final);
  const shownEnd = mine.length ? Math.max(...mine.map((s) => s.end)) : -Infinity;
  const key = (e) => `${socket}:${e}:${start.toFixed(3)}`;
  if (start < shownEnd - REWIND_S && !next.segments.some((s) => s.key === key(epoch))) {
    next = ledgerNewEpoch(next, socket);
    epoch = next.epochs[socket];
  }

  const k = key(epoch);
  const existing = next.segments.find((s) => s.key === k);
  if (existing?.final) return next; // a final is written once (re-delivery = no-op)

  const seg = {
    key: k,
    socket,
    epoch,
    start,
    end: segEnd(payload, words, start),
    text,
    words: words.map((w) => ({ word: w.punctuated_word || w.word || '', confidence: w.confidence })),
    lang: socket === 'multi' ? multiLangOf(payload, pair.left) : socket,
    final: isFinal,
    confidence: Number(alt?.confidence) || 0,
    at: existing?.at || now,
  };

  let segments = next.segments.filter((s) => s.key !== k);
  // A final covers its audio: any older draft on that audio is now stale.
  if (isFinal) {
    segments = segments.filter(
      (s) => s.final || s.socket !== socket || s.epoch !== epoch || s.start >= seg.end,
    );
  }
  segments = [...segments, seg].sort(order);
  if (segments.length > MAX_SEGMENTS) segments = segments.slice(-MAX_SEGMENTS);
  return { ...next, segments };
};

/** Split a segment's text into sentence pieces, each with its own slice of words. */
const piecesOf = (seg) => {
  const out = [];
  let rest = seg.text;
  let wordAt = 0;
  while (rest) {
    const m = rest.match(SENTENCE_RX);
    const piece = m ? m[0] : rest;
    const n = tokens(piece).length;
    out.push({
      text: piece.trim(),
      sentenceEnd: Boolean(m),
      words: seg.words.slice(wordAt, wordAt + n),
    });
    wordAt += n;
    rest = rest.slice(piece.length).trim();
  }
  return out;
};

/**
 * Build the bubbles (rows, same shape the board uses today) from a ledger.
 * @param {object} ledger
 * @param {{ pair?: object, overrides?: Record<string,string> }} [opts]
 *   overrides = ✎ fixes, bubble id → text (applied here, so they always stick)
 */
export const bubblesFrom = (ledger, opts = {}) => {
  const { pair = { left: 'en', right: 'es' }, overrides = {} } = opts;
  const bubbles = [];
  let cur = null;
  let prevSeg = null;
  let turnId = null;
  let turnWords = 0;

  const close = () => {
    if (cur) bubbles.push(cur);
    cur = null;
  };

  ledger.segments.forEach((seg) => {
    const newTurn =
      !prevSeg || seg.epoch !== prevSeg.epoch || seg.socket !== prevSeg.socket || seg.start - prevSeg.end > BUBBLE_GAP_S;
    if (newTurn) {
      close();
      turnId = `turn-${seg.key}`;
      turnWords = 0;
    }
    piecesOf(seg).forEach((piece, i) => {
      const neutral = isLanguageNeutralChunk(piece.text);
      // A different language with real words = a different speaker = new bubble.
      if (cur && !neutral && seg.lang !== cur.lang) close();
      if (!cur) {
        const last = bubbles[bubbles.length - 1];
        cur = {
          id: `${seg.key}#${i}`,
          lang: neutral && !newTurn && last ? last.lang : seg.lang,
          turnId,
          isSplit: !newTurn,
          startTime: seg.start,
          createdAt: seg.at,
          pieces: [],
          segKeys: new Set(),
          final: true,
        };
      }
      cur.pieces.push(piece);
      cur.segKeys.add(seg.key);
      cur.final = cur.final && seg.final;
      cur.audioEnd = seg.end;
      turnWords += tokens(piece.text).length;
      cur.turnWordCount = turnWords;
      const words = cur.pieces.reduce((n, p) => n + tokens(p.text).length, 0);
      if ((piece.sentenceEnd && words >= SENTENCE_MIN_WORDS) || words >= BUBBLE_MAX_WORDS) close();
    });
    prevSeg = seg;
  });
  close();

  return bubbles.map((b) => toRow(b, pair, overrides));
};

/** Bubble → the row shape TranscriptionBoard / translation already read. */
const toRow = (b, pair, overrides) => {
  const rawText = b.pieces.map((p) => p.text).join(' ');
  const override = overrides[b.id];
  const text = override != null ? override : applyTranscriptFormatting(rawText, b.lang);
  const side = laneSideForLang(b.lang, pair);
  const fin = b.final ? text : '';
  const draft = b.final ? '' : text;
  return {
    id: b.id,
    text,
    rawText,
    lang: b.lang,
    isFinal: b.final,
    userCorrected: override != null,
    segKeys: [...b.segKeys],
    turnId: b.turnId,
    turnWordCount: b.turnWordCount,
    isSplit: b.isSplit,
    startTime: b.startTime,
    audioEnd: b.audioEnd,
    createdAt: b.createdAt,
    wordConfidence: b.pieces
      .flatMap((p) => p.words)
      .map((w) => ({ word: normTok(w.word), confidence: Number.isFinite(w.confidence) ? w.confidence : null }))
      .filter((w) => w.word),
    wordConfidenceOffset: 0,
    tailPreviewText: null,
    enFinalized: side === 'en' ? fin : '',
    esFinalized: side === 'es' ? fin : '',
    enInterim: side === 'en' ? draft : '',
    esInterim: side === 'es' ? draft : '',
    enFull: side === 'en' ? text : '',
    esFull: side === 'es' ? text : '',
  };
};

/**
 * The redundancy check. Every FINAL word in the ledger must appear in the
 * bubbles' raw text (bubbles with a ✎ override are skipped). Returns the
 * missing words. Should always be [] by construction, so anything else is a
 * real bug, and that's the one alarm worth a console line.
 */
export const ledgerLoss = (ledger, rows) => {
  const shown = new Map();
  (rows || [])
    .filter((r) => !r.userCorrected)
    .forEach((r) => tokens(r.rawText).map(normTok).filter(Boolean).forEach((t) => shown.set(t, (shown.get(t) || 0) + 1)));
  const corrected = new Set((rows || []).filter((r) => r.userCorrected).flatMap((r) => r.segKeys || []));
  const missing = [];
  ledger.segments
    .filter((s) => s.final && !corrected.has(s.key))
    .forEach((s) =>
      tokens(s.text).map(normTok).filter(Boolean).forEach((t) => {
        const n = shown.get(t) || 0;
        if (n > 0) shown.set(t, n - 1);
        else missing.push(t);
      }),
    );
  return missing;
};

/** Replay fixture events through v2 (tests + eval). Mirrors replayFixtureEvents. */
export const replayLedger = (fixture, opts = {}) => {
  const pair = fixture?.meta?.pair || { left: 'en', right: 'es' };
  let ledger = createLedger();
  (fixture?.events || []).forEach((ev, i) => {
    ledger = ledgerApply(ledger, ev.payload, {
      socket: ev.lane || 'en',
      pair,
      now: 1_700_000_000_000 + (Number.isFinite(ev.atMs) ? ev.atMs : i * 100),
    });
  });
  return { ledger, rows: bubblesFrom(ledger, { pair, overrides: opts.overrides }) };
};
