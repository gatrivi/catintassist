/**
 * Stable live transcript helpers (v4.84.0).
 * Display-only — does not touch captionEngine / Deepgram.
 */

/** Word-aligned common prefix length in characters (includes trailing spaces of matched words). */
export function commonWordPrefixLen(a = '', b = '') {
  const aParts = a.match(/\S+\s*/g) || [];
  const bParts = b.match(/\S+\s*/g) || [];
  let len = 0;
  const n = Math.min(aParts.length, bParts.length);
  for (let i = 0; i < n; i += 1) {
    if (aParts[i].trim() !== bParts[i].trim()) break;
    len += bParts[i].length;
  }
  return len;
}

export const UNCERTAIN_TAIL_WORDS = 3;

/** Leave last N words as uncertain tail; rest is soft-committed. */
export function promoteStablePrefix(fullText = '', uncertainWords = UNCERTAIN_TAIL_WORDS) {
  const text = fullText || '';
  const parts = text.match(/\S+\s*/g) || [];
  if (parts.length <= uncertainWords) {
    return { committed: '', tail: text };
  }
  const keep = parts.length - uncertainWords;
  let committed = '';
  for (let i = 0; i < keep; i += 1) committed += parts[i];
  return { committed, tail: text.slice(committed.length) };
}

/**
 * Ratchet committed prefix for live STT display.
 * - Extends when next grows from previous committed.
 * - Soft-promotes all but last UNCERTAIN_TAIL_WORDS.
 * - On early correction, shrinks to shared word prefix (patch, not remount).
 */
export function advanceCommittedPrefix(prevCommitted = '', nextText = '') {
  const next = nextText || '';
  const prev = prevCommitted || '';

  if (!next) {
    return { committed: '', tail: '', committedShrunk: !!prev };
  }

  if (!prev) {
    const soft = promoteStablePrefix(next);
    return { committed: soft.committed, tail: soft.tail, committedShrunk: false };
  }

  if (next.startsWith(prev)) {
    const soft = promoteStablePrefix(next).committed;
    // Only grow committed (ratchet); never shrink while still a prefix match.
    const committed =
      soft.length >= prev.length && next.startsWith(soft) ? soft : prev;
    return {
      committed,
      tail: next.slice(committed.length),
      committedShrunk: false,
    };
  }

  const sharedLen = commonWordPrefixLen(prev, next);
  const committed = next.slice(0, sharedLen);
  return {
    committed,
    tail: next.slice(sharedLen),
    committedShrunk: sharedLen < prev.length,
  };
}

/** @deprecated use advanceCommittedPrefix */
export function splitCommittedAndTail(prevCommitted, nextText) {
  return advanceCommittedPrefix(prevCommitted, nextText);
}

/**
 * Continuity keys for React list — prefer turnId so live id flips don't remount.
 * Live row always `cont:{turn}:live`. Sealed rows `cont:{turn}:s{n}:{id}`.
 */
export function buildCaptionContinuityKeys(captions = []) {
  const sealCountByTurn = new Map();
  const seen = new Map();

  return captions.map((cap, i) => {
    const turn = cap?.turnId || cap?.id || `solo-${i}`;
    let base;
    if (cap?.isFinal === false) {
      base = `cont:${turn}:live`;
    } else {
      const n = sealCountByTurn.get(turn) || 0;
      sealCountByTurn.set(turn, n + 1);
      base = `cont:${turn}:s${n}:${cap?.id || i}`;
    }
    const dup = seen.get(base) || 0;
    seen.set(base, dup + 1);
    return dup === 0 ? base : `${base}~${dup}`;
  });
}

/** Tokenize for stable span keys (word + whitespace chunks). */
export function tokenizeDisplay(text = '') {
  return text.match(/\S+\s*/g) || [];
}
