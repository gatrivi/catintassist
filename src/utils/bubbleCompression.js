/**
 * Compression policy (pure, unit-tested) for long transcript bubbles —
 * v4.133.0.
 */

export const LONG_BUBBLE_WORDS = 50;

/** How many trailing rows are always shown in full (the ones being read). */
export const ALWAYS_VISIBLE_TAIL_ROWS = 2;

export const countWords = (text = '') => (text || '').trim().split(/\s+/).filter(Boolean).length;

/** Digits or a clinical cue → medical data must never be hidden. */
const CRITICAL_RE =
  /\d|\b(mg|mcg|ml|cc|iu|units?|unidades?|milligrams?|miligramos?|micrograms?|grams?|tablets?|tabletas?|pills?|pastillas?|capsules?|c[aá]psulas?|drops?|gotas?|puffs?|sprays?|dose|dosage|dosis|medication|medicamento|medicine|medicina|insulina?|metformin|metformina|twice|daily|diari[oa]|nightly|mmhg|percent|por ciento|copay|copago|appointment|cita|dob|date|fecha|allergic|alergic[oa]|take care|stat|code|trauma|airway|bleeding|seizure|stroke)\b/i;

export const isCriticalBubbleText = (text = '') => CRITICAL_RE.test(text || '');

/**
 * Stable key for "the user expanded this bubble". Uses the text itself so a
 * re-seal / re-id / re-key keeps the expansion state across remounts.
 */
export const bubbleExpandKey = (cap = {}) =>
  `sig:${countWords(cap.text)}:${(cap.text || '').trim().slice(0, 80)}`;

/** Should this sealed bubble be clipped to a few lines? */
export const shouldAutoCollapseBubble = ({
  wordCount = 0,
  isLive = false,
  isRecent = false,
  isCritical = false,
} = {}) => {
  if (isLive) return false; // never clip what is being spoken
  if (isRecent) return false; // never clip what is being read
  if (isCritical) return false; // never hide doses/numbers/dates
  return wordCount > LONG_BUBBLE_WORDS;
};