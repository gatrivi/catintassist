/**
 * Supersede decision for live STT text (v4.140.0).
 *
 * Deepgram emits interim wording, then replaces it with a higher-confidence
 * result for the SAME speech. Two failure modes reported from the booth:
 *   - hard swap: the interpreter is mid-read and the words disappear
 *   - no swap: the pane accumulates two live-looking versions of one phrase
 *
 * This module answers one question, purely: given the wording the interpreter
 * is currently reading (base) and the new wording (next), should we present a
 * SUPERSEDE (old wording dimmed + replacing wording framed, held for a bounded
 * time) or adopt the new wording quietly?
 *
 * No React, no timers, no DOM — the component owns the lifecycle, this owns
 * the decision. See docs/transcription-pane/README.md §12.
 */
import { diffWordsStable, tokenizeWords } from './diffWordsStable';

/** How long superseded wording stays readable before it starts leaving. */
export const SUPERSEDE_HOLD_MS = 1500;
/** Exit fade once the hold expires (derender is eased, never a pop). */
export const SUPERSEDE_RETIRE_MS = 320;
/** Reduced motion: no ladder at all, just get out of the way. */
export const REDUCED_SUPERSEDE_HOLD_MS = 120;
export const REDUCED_SUPERSEDE_RETIRE_MS = 0;
/**
 * Hard cap on one supersede episode. A long utterance keeps sending revisions;
 * without this the dimmed wording could ride the whole bubble. After the cap
 * the episode settles and further revisions are adopted quietly.
 */
export const SUPERSEDE_MAX_EPISODE_MS = 4000;
/** Confidence is noisy at the 3rd decimal; below this a "gain" is not a gain. */
export const SUPERSEDE_CONF_EPSILON = 0.02;

export const SUPERSEDE_MODE = {
  NONE: 'none',
  CONTINUATION: 'continuation',
  SUPERSEDE: 'supersede',
  QUIET: 'quiet',
};

const norm = (token) => (token || '').toString().trim().toLowerCase();

/**
 * Weakest finite score among `tokens`, matched by normalized word.
 * Returns null when nothing matches — never invent a score (v4.121.0 rule).
 */
export function minConfidenceForTokens(tokens = [], scores = []) {
  if (!tokens?.length || !scores?.length) return null;
  const byWord = new Map();
  scores.forEach((entry) => {
    if (!entry || !Number.isFinite(entry.confidence)) return;
    const key = norm(entry.word);
    if (!key) return;
    const seen = byWord.get(key);
    byWord.set(key, seen == null ? entry.confidence : Math.min(seen, entry.confidence));
  });
  const finite = tokens.map((t) => byWord.get(norm(t))).filter((c) => Number.isFinite(c));
  return finite.length ? Math.min(...finite) : null;
}

/**
 * Decide how to present a wording change.
 *
 * @param {object} input
 * @param {string} input.prevText wording currently on screen (episode base)
 * @param {string} input.nextText newest wording for the same speech
 * @param {Array<{word:string,confidence:number}>} [input.prevScores] scores of prevText
 * @param {Array<{word:string,confidence:number}>} [input.nextScores] scores of nextText
 * @returns {{
 *   mode: string, superseded: boolean, reason: string,
 *   ops: Array<object>, lostTokens: string[], gainedTokens: string[],
 *   confidence: { prev: number|null, next: number|null },
 * }}
 */
export function classifySupersede({
  prevText = '',
  nextText = '',
  prevScores = [],
  nextScores = [],
} = {}) {
  const before = prevText || '';
  const after = nextText || '';
  const ops = diffWordsStable(before, after);

  const lostTokens = ops
    .filter((op) => op.type === 'delete' || op.type === 'replace')
    .map((op) => op.from || op.text)
    .filter(Boolean);
  const gainedTokens = ops
    .filter((op) => op.type === 'insert' || op.type === 'replace')
    .map((op) => (op.type === 'insert' ? op.text : op.to))
    .filter(Boolean);

  // Only the changed span is scored: a whole-line average would hide the
  // rewrite we are trying to judge.
  const prevScore = minConfidenceForTokens(
    lostTokens.length ? lostTokens : tokenizeWords(before),
    prevScores,
  );
  const nextScore = minConfidenceForTokens(
    gainedTokens.length ? gainedTokens : tokenizeWords(after),
    nextScores,
  );

  const base = {
    ops,
    lostTokens,
    gainedTokens,
    confidence: { prev: prevScore, next: nextScore },
  };

  if (!before || before === after) {
    return { ...base, mode: before === after ? SUPERSEDE_MODE.NONE : SUPERSEDE_MODE.CONTINUATION, superseded: false, reason: before === after ? 'no_change' : 'first_paint' };
  }

  // Nothing was lost (append / extension) — nothing to supersede.
  if (!lostTokens.length) {
    return { ...base, mode: SUPERSEDE_MODE.CONTINUATION, superseded: false, reason: 'append_only' };
  }

  // Words vanished with nothing replacing them (retraction). Still needs the
  // readable treatment: a hard pop is the symptom we are removing.
  if (!gainedTokens.length) {
    return { ...base, mode: SUPERSEDE_MODE.SUPERSEDE, superseded: true, reason: 'retraction' };
  }

  // Equal or lower confidence is not a supersede: adopt in place, keep the
  // pane free of two live-looking versions of the same phrase.
  if (Number.isFinite(prevScore) && Number.isFinite(nextScore)) {
    return nextScore > prevScore + SUPERSEDE_CONF_EPSILON
      ? { ...base, mode: SUPERSEDE_MODE.SUPERSEDE, superseded: true, reason: 'higher_confidence_rewrite' }
      : { ...base, mode: SUPERSEDE_MODE.QUIET, superseded: false, reason: 'equal_or_lower_confidence' };
  }

  // Scores missing on either side: no evidence either way, so choose the
  // presentation that can always be read (both wordings visible).
  return { ...base, mode: SUPERSEDE_MODE.SUPERSEDE, superseded: true, reason: 'unknown_confidence_rewrite' };
}

/**
 * Per-op presentation for a decision, as an ordered list of parts.
 * Roles: 'equal' | 'arriving' (framed, new wording) | 'superseded' (dimmed, old
 * wording) | 'adopted' (quiet in-place update) | 'arrow' (separator).
 *
 * A replace under SUPERSEDE yields THREE parts — old, arrow, new — because the
 * interpreter must be able to keep reading the old wording while the new one
 * lands. A replace under QUIET yields one part: the pane must not show two
 * live-looking versions of the same phrase when there is no confidence gain.
 */
export function presentOpParts(op, mode) {
  if (!op) return [];
  if (op.type === 'equal') return [{ role: 'equal', text: op.text }];
  if (mode === SUPERSEDE_MODE.SUPERSEDE) {
    if (op.type === 'insert') return [{ role: 'arriving', text: op.text }];
    if (op.type === 'replace') {
      return [
        { role: 'superseded', text: op.from },
        { role: 'arrow', text: ' ⇢ ' },
        { role: 'arriving', text: op.to },
      ];
    }
    return [{ role: 'superseded', text: op.text }];
  }
  if (mode === SUPERSEDE_MODE.QUIET) {
    // Retraction under quiet adopt simply leaves; replacements land in place.
    return op.type === 'delete' ? [] : [{ role: 'adopted', text: op.type === 'replace' ? op.to : op.text }];
  }
  // Continuation: only growth, so only arriving parts are reachable.
  return op.type === 'insert' ? [{ role: 'arriving', text: op.text }] : [];
}

/** True once one supersede episode has been on screen too long (see cap above). */
export function isEpisodeOverBudget(startedAt, now, maxMs = SUPERSEDE_MAX_EPISODE_MS) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now - startedAt > maxMs;
}

/**
 * Hold/retire timing. Reduced motion collapses the ladder to a near-instant,
 * animation-free settle.
 */
export function resolveSupersedeTiming(reducedMotion, options = {}) {
  if (reducedMotion) {
    return { holdMs: REDUCED_SUPERSEDE_HOLD_MS, retireMs: REDUCED_SUPERSEDE_RETIRE_MS, animate: false };
  }
  const holdMs = Number.isFinite(options.holdMs) ? options.holdMs : SUPERSEDE_HOLD_MS;
  const retireMs = Number.isFinite(options.retireMs) ? options.retireMs : SUPERSEDE_RETIRE_MS;
  return { holdMs: Math.max(0, holdMs), retireMs: Math.max(0, retireMs), animate: true };
}
