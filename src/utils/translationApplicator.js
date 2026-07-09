/**
 * Pure translation accept/reject applicator (v4.82.0 — safety ledger).
 * Shared by live useTranslate + fixture replay.
 *
 * Invariant: a weaker result must never overwrite a stronger visible result.
 * Key: captionId::segmentId::sourceHash::targetLang
 */
import { peelCompleteSentences } from './transcriptFormat';
import {
  diffSensitiveTokens,
  salvageSensitiveTokens,
} from './translationSensitiveTokens';

/** Target-output filler — reject when source is a real sentence. */
export const FILLER_ONLY_RE =
  /^(bueno|um|uh|eh|ah|oh|hmm|mhm|sí|si|ok|okay|vale|pues|este|like|you know|yes|no|aja|ajá)[.!?\s…]*$/i;

export const DEFAULT_MAX_SEGMENT_WORDS = 40;

/** Strength: higher = safer to keep. Weaker must not overwrite stronger. */
export const TRANSLATION_STRENGTH = {
  ok: 40,
  weak: 30,
  warning: 25,
  weak_digit_loss: 20,
  pending: 10,
  failed: 5,
};

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

export function hashTranslationSource(text) {
  const s = normalizeSource(text).toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function buildTranslationKey({ captionId, segmentId, sourceHash, targetLang }) {
  return `${captionId}::${segmentId}::${sourceHash}::${targetLang}`;
}

export function buildSegmentRequestId({ captionId, segmentId, sourceHash, targetLang }) {
  return buildTranslationKey({ captionId, segmentId, sourceHash, targetLang });
}

export function assignSegmentIds(segments) {
  return (segments || []).map((text, i) => ({
    segmentId: `seg-${i}`,
    text: normalizeSource(text),
  }));
}

export function translationStrength(entry) {
  if (!entry) return 0;
  const t = String(entry.text || '').trim();
  if (!t) return 0;
  if (entry.preserved && (entry.status === 'ok' || entry.status === 'weak')) {
    return TRANSLATION_STRENGTH[entry.status] || 30;
  }
  return TRANSLATION_STRENGTH[entry.status] || 0;
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
  if (FILLER_ONLY_RE.test(out)) return true;
  if (
    srcWords >= 6 &&
    out.split(/\s+/).filter(Boolean).length <= 1 &&
    FILLER_ONLY_RE.test(out.replace(/[.,!?…]/g, ''))
  ) {
    return true;
  }
  return false;
}

/** Reject suspiciously short output (e.g. one word for a long sentence). */
export function isSuspiciouslyShort(source, result) {
  const srcWords = normalizeSource(source).split(/\s+/).filter(Boolean).length;
  const outWords = normalizeSource(result).split(/\s+/).filter(Boolean).length;
  if (srcWords < 6) return false;
  if (outWords === 0) return true;
  // Output < 25% of source words and no digits in output when source has digits
  if (outWords < Math.max(2, Math.floor(srcWords * 0.25))) return true;
  return false;
}

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
  if (prev.status === 'failed' && !prev.preserved && prev.warning !== 'engine_failed') return null;
  return prev;
};

/** Source passthrough when nothing better exists — never silent blank. */
export function sourcePassthroughEntry(base, sourceText, warning) {
  const src = normalizeSource(sourceText);
  return {
    ...base,
    text: src,
    status: warning === 'sensitive_token_loss' ? 'weak_digit_loss' : 'failed',
    quality: 'failed',
    preserved: false,
    warning: warning || 'engine_failed',
    passthrough: true,
    updatedAt: Date.now(),
  };
}

const preserveOrPassthrough = (prev, base, sourceText, warning) => {
  const good = usablePrevious(prev);
  if (good) {
    const keepStatus =
      good.status === 'ok' || good.status === 'weak' || good.status === 'weak_digit_loss'
        ? good.status
        : good.status === 'warning'
          ? 'warning'
          : 'ok';
    return {
      ...base,
      text: good.text,
      status: keepStatus === 'failed' ? 'ok' : keepStatus,
      quality: good.quality || keepStatus || 'ok',
      engineId: good.engineId || base.engineId,
      preserved: true,
      warning,
      missingTokens: good.missingTokens,
      passthrough: !!good.passthrough,
      updatedAt: Date.now(),
    };
  }
  return sourcePassthroughEntry(base, sourceText, warning);
};

/** Keep previous if it is strictly stronger than candidate. */
const preferStronger = (prev, candidate) => {
  if (!prev || !String(prev.text || '').trim()) return candidate;
  if (translationStrength(prev) > translationStrength(candidate)) {
    return {
      ...candidate,
      text: prev.text,
      status: prev.status === 'failed' ? candidate.status : prev.status,
      quality: prev.quality || prev.status,
      engineId: prev.engineId || candidate.engineId,
      preserved: true,
      warning: candidate.warning || prev.warning,
      missingTokens: prev.missingTokens || candidate.missingTokens,
      passthrough: prev.passthrough,
      updatedAt: Date.now(),
    };
  }
  return candidate;
};

/**
 * Apply one engine result into a translations map (immutable).
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
    sourceText: sourceTextNorm,
    engineId: engineResult.engineId || null,
    quality: engineResult.quality || null,
  };

  if (eventHash && eventHash !== expectedHash) {
    const entry = preserveOrPassthrough(prev, base, sourceTextNorm, 'stale');
    return { state: { ...state, [expectedKey]: entry }, entry };
  }
  if (
    engineResult.requestId != null &&
    engineResult.requestId !== '' &&
    engineResult.requestId !== expectedRequestId &&
    engineResult.requestId !== key
  ) {
    const entry = preserveOrPassthrough(prev, base, sourceTextNorm, 'stale');
    return { state: { ...state, [expectedKey]: entry }, entry };
  }

  const raw = String(engineResult.text ?? '').trim();

  if (!raw) {
    const entry = preserveOrPassthrough(prev, base, sourceTextNorm, 'blank');
    return { state: { ...state, [expectedKey]: entry }, entry };
  }

  if (isGarbageTranslation(sourceTextNorm, raw)) {
    const entry = preserveOrPassthrough(
      prev,
      { ...base, engineId: engineResult.engineId },
      sourceTextNorm,
      'garbage_rejected',
    );
    return { state: { ...state, [expectedKey]: entry }, entry };
  }

  if (isSuspiciouslyShort(sourceTextNorm, raw)) {
    const entry = preserveOrPassthrough(
      prev,
      { ...base, engineId: engineResult.engineId },
      sourceTextNorm,
      'too_short',
    );
    return { state: { ...state, [expectedKey]: entry }, entry };
  }

  const missing = diffSensitiveTokens(sourceTextNorm, raw);
  let text = raw;
  let warning;
  let missingTokens;
  let status;
  let quality = engineResult.quality === 'weak' ? 'weak' : 'ok';

  if (missing.length) {
    // Digit loss: never silently accept. Prefer prior good; else salvage + weak_digit_loss.
    const good = usablePrevious(prev);
    if (good && translationStrength(good) >= TRANSLATION_STRENGTH.ok) {
      const entry = preserveOrPassthrough(prev, base, sourceTextNorm, 'sensitive_token_loss');
      return { state: { ...state, [expectedKey]: entry }, entry };
    }
    text = salvageSensitiveTokens(raw, missing);
    warning = 'sensitive_token_loss';
    missingTokens = missing;
    status = 'weak_digit_loss';
    quality = 'weak';
  } else {
    status = quality;
  }

  let entry = {
    ...base,
    text,
    status,
    quality,
    preserved: false,
    warning,
    missingTokens,
    passthrough: false,
    engineId: engineResult.engineId || null,
    updatedAt: Date.now(),
  };

  entry = preferStronger(prev, entry);

  return { state: { ...state, [expectedKey]: entry }, entry };
}

/**
 * Compose display text. Empty segment → source passthrough (never blank hole).
 * @param {Record<string, object>} entriesMap
 * @param {string[]} [orderedKeys]
 * @param {Array<{ key?: string, sourceText?: string }>} [segmentSources]
 */
export function composeCaptionTranslation(entriesMap, orderedKeys, segmentSources) {
  if (!entriesMap || typeof entriesMap !== 'object') return '';
  let keys;
  if (Array.isArray(orderedKeys) && orderedKeys.length) {
    keys = orderedKeys.map((k) => (typeof k === 'string' ? k : k?.key)).filter(Boolean);
  } else {
    keys = Object.keys(entriesMap).sort((a, b) => {
      const ea = entriesMap[a];
      const eb = entriesMap[b];
      const ai = Number(String(ea?.segmentId || '').replace(/\D/g, '')) || 0;
      const bi = Number(String(eb?.segmentId || '').replace(/\D/g, '')) || 0;
      return ai - bi;
    });
  }

  const sourceByKey = new Map();
  if (Array.isArray(segmentSources)) {
    for (const s of segmentSources) {
      if (s?.key) sourceByKey.set(s.key, s.sourceText);
    }
  }

  return keys
    .map((k) => {
      const e = entriesMap[k];
      const t = String(e?.text || '').trim();
      if (t) return t;
      const src = sourceByKey.get(k) || e?.sourceText || '';
      return normalizeSource(src);
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shouldPersistTranslationEntry(entry) {
  if (!entry) return false;
  if (!String(entry.text || '').trim()) return false;
  if (entry.status === 'failed' && entry.passthrough) return true; // restore passthrough after refresh
  if (entry.warning === 'sensitive_token_loss' || entry.status === 'weak_digit_loss') return true;
  if (entry.status === 'ok' || entry.status === 'weak' || entry.status === 'warning') return true;
  if (entry.preserved && entry.text) return true;
  return false;
}
