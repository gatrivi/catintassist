/**
 * Pure translation accept/reject applicator (v4.82.0).
 * Shared by live useTranslate + fixture replay.
 *
 * Key: captionId::segmentId::sourceHash::targetLang
 * Preserve: status stays ok|weak with preserved:true + warning (never looks "failed").
 */
import { peelCompleteSentences } from './transcriptFormat';
import {
  diffSensitiveTokens,
  salvageSensitiveTokens,
} from './translationSensitiveTokens';

const FILLER_RE =
  /^(bueno|um|uh|eh|ah|oh|hmm|mhm|sí|si|ok|okay|vale|pues|este|like|you know)[.,!?…]*$/i;

export const DEFAULT_MAX_SEGMENT_WORDS = 40;

const normalizeSource = (text) =>
  String(text || '')
    .trim()
    .replace(/\s+/g, ' ');

const splitSentencesLocal = (text) => {
  const normText = normalizeSource(text);
  if (!normText) return [];
  const { sentences, remainder } = peelCompleteSentences(normText);
  if (sentences.length === 0) return [normText];
  const segments = [...sentences];
  if (remainder.length > 1) segments.push(remainder);
  return segments;
};

/** djb2 → base36 short hash of normalized source. */
export function hashTranslationSource(text) {
  const s = normalizeSource(text).toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Delimiter-safe key — do not use single `-` (IDs/hashes contain dashes). */
export function buildTranslationKey({ captionId, segmentId, sourceHash, targetLang }) {
  return `${captionId}::${segmentId}::${sourceHash}::${targetLang}`;
}

/** Per-segment request id (same identity as key). */
export function buildSegmentRequestId({ captionId, segmentId, sourceHash, targetLang }) {
  return buildTranslationKey({ captionId, segmentId, sourceHash, targetLang });
}

export function assignSegmentIds(segments) {
  return (segments || []).map((text, i) => ({
    segmentId: `seg-${i}`,
    text: normalizeSource(text),
  }));
}

/** True when engine output is filler garbage vs a real source sentence. */
export function isGarbageTranslation(source, result) {
  const src = normalizeSource(source);
  const out = normalizeSource(result);
  if (!out) return true;
  const srcWords = src.split(/\s+/).filter(Boolean).length;
  const isReal =
    srcWords >= 4 || /\d/.test(src) || /[.,!?;:]/.test(src);
  if (!isReal) return false;
  if (FILLER_RE.test(out)) return true;
  // Single-token garbage when source is long
  if (srcWords >= 6 && out.split(/\s+/).filter(Boolean).length <= 1 && FILLER_RE.test(out.replace(/[.,!?…]/g, ''))) {
    return true;
  }
  return false;
}

/**
 * Chunk text into ~35–45 word API payloads (sentence peel first).
 * @param {string} text
 * @param {{ maxWords?: number }} [opts]
 */
export function segmentLongMonologue(text, { maxWords = DEFAULT_MAX_SEGMENT_WORDS } = {}) {
  const cap = Math.max(20, Math.min(45, maxWords || DEFAULT_MAX_SEGMENT_WORDS));
  const pieces = splitSentencesLocal(text);
  const out = [];

  const pushChunked = (piece) => {
    const words = normalizeSource(piece).split(/\s+/).filter(Boolean);
    if (words.length <= cap) {
      if (words.length) out.push(words.join(' '));
      return;
    }
    let i = 0;
    while (i < words.length) {
      let end = Math.min(i + cap, words.length);
      // Prefer breaking at comma-ish boundary inside window
      if (end < words.length) {
        for (let j = end; j > i + Math.floor(cap * 0.6); j--) {
          if (/[,;:]$/.test(words[j - 1])) {
            end = j;
            break;
          }
        }
      }
      out.push(words.slice(i, end).join(' '));
      i = end;
    }
  };

  for (const piece of pieces) pushChunked(piece);
  return out.length ? out : text?.trim() ? [normalizeSource(text)] : [];
}

const usablePrevious = (prev) => {
  if (!prev) return null;
  const t = String(prev.text || '').trim();
  if (!t) return null;
  if (prev.status === 'failed' && !prev.preserved) return null;
  return prev;
};

const preserveEntry = (prev, base, warning) => {
  const good = usablePrevious(prev);
  if (good) {
    return {
      ...base,
      text: good.text,
      status: good.status === 'weak' ? 'weak' : 'ok',
      quality: good.quality || good.status || 'ok',
      engineId: good.engineId || base.engineId,
      preserved: true,
      warning,
      missingTokens: good.missingTokens,
      updatedAt: Date.now(),
    };
  }
  return {
    ...base,
    text: '',
    status: 'failed',
    quality: 'failed',
    preserved: false,
    warning,
    updatedAt: Date.now(),
  };
};

/**
 * Apply one engine result into a translations map (immutable).
 * @param {Record<string, object>} state
 * @param {object} event
 * @returns {{ state: Record<string, object>, entry: object }}
 */
export function applyTranslationResult(state = {}, event = {}) {
  const {
    captionId,
    segmentId,
    sourceText,
    sourceHash: eventHash,
    targetLang,
    engineResult = {},
    previousEntry,
  } = event;

  const sourceTextNorm = normalizeSource(sourceText);
  const expectedHash = hashTranslationSource(sourceTextNorm);
  const sourceHash = eventHash || expectedHash;
  const expectedKey = buildTranslationKey({
    captionId,
    segmentId,
    sourceHash: expectedHash,
    targetLang,
  });
  const key = buildTranslationKey({
    captionId,
    segmentId,
    sourceHash,
    targetLang,
  });
  const expectedRequestId = buildSegmentRequestId({
    captionId,
    segmentId,
    sourceHash: expectedHash,
    targetLang,
  });

  const prev =
    previousEntry ||
    state[expectedKey] ||
    state[key] ||
    null;
  const base = {
    key: expectedKey,
    captionId,
    segmentId,
    sourceHash: expectedHash,
    targetLang,
    engineId: engineResult.engineId || null,
    quality: engineResult.quality || null,
  };

  // Stale: event hash must match current source; requestId must match segment key
  if (eventHash && eventHash !== expectedHash) {
    const entry = preserveEntry(prev, base, 'stale');
    return { state: { ...state, [expectedKey]: entry }, entry };
  }
  if (
    engineResult.requestId != null &&
    engineResult.requestId !== '' &&
    engineResult.requestId !== expectedRequestId &&
    engineResult.requestId !== key
  ) {
    const entry = preserveEntry(prev, base, 'stale');
    return { state: { ...state, [expectedKey]: entry }, entry };
  }

  const raw = String(engineResult.text ?? '').trim();

  if (!raw) {
    const entry = preserveEntry(prev, base, 'blank');
    return { state: { ...state, [expectedKey]: entry }, entry };
  }

  if (isGarbageTranslation(sourceTextNorm, raw)) {
    const entry = preserveEntry(prev, { ...base, engineId: engineResult.engineId }, 'garbage_rejected');
    return { state: { ...state, [expectedKey]: entry }, entry };
  }

  const missing = diffSensitiveTokens(sourceTextNorm, raw);
  let text = raw;
  let warning;
  let missingTokens;
  if (missing.length) {
    text = salvageSensitiveTokens(raw, missing);
    warning = 'sensitive_token_loss';
    missingTokens = missing;
  }

  const quality = engineResult.quality === 'weak' ? 'weak' : 'ok';
  const entry = {
    ...base,
    text,
    status: warning ? 'warning' : quality,
    quality,
    preserved: false,
    warning,
    missingTokens,
    engineId: engineResult.engineId || null,
    updatedAt: Date.now(),
  };

  return { state: { ...state, [expectedKey]: entry }, entry };
}

/**
 * Compose display translation from current segment keys only.
 * @param {Record<string, object>} entriesMap
 * @param {Array<{ key?: string, segmentId?: string }>} [orderedKeys]
 */
export function composeCaptionTranslation(entriesMap, orderedKeys) {
  if (!entriesMap || typeof entriesMap !== 'object') return '';
  let entries;
  if (Array.isArray(orderedKeys) && orderedKeys.length) {
    entries = orderedKeys
      .map((k) => (typeof k === 'string' ? entriesMap[k] : entriesMap[k?.key]))
      .filter(Boolean);
  } else {
    entries = Object.values(entriesMap).sort((a, b) => {
      const ai = Number(String(a.segmentId || '').replace(/\D/g, '')) || 0;
      const bi = Number(String(b.segmentId || '').replace(/\D/g, '')) || 0;
      return ai - bi;
    });
  }
  return entries
    .map((e) => String(e.text || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether an entry should be written to IDB (sealed path decides separately). */
export function shouldPersistTranslationEntry(entry) {
  if (!entry) return false;
  if (entry.status === 'failed' && !entry.text) return false;
  if (entry.warning === 'sensitive_token_loss') return true;
  if (entry.status === 'ok' || entry.status === 'weak' || entry.status === 'warning') return true;
  if (entry.preserved && entry.text) return true;
  return false;
}
