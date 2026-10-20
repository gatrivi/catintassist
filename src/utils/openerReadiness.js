/**
 * v4.189.0 opener readiness — "am I missing an opener recording?" in one glance.
 *
 * The two openers (EN + ES) are the most-fired greetings. Each has 3 recordings
 * (morning / afternoon / evening). This turns that into ONE state per language:
 *
 *   none    red    ✗    no recording at all → the tile fires nothing
 *   locked  red    🔒   recorded, but no CALL OK for this route → tile refuses
 *   partial amber  2/3  some time slots missing → a fallback clip fires
 *   ok      green  ✓    all 3 recorded + CALL OK
 *
 * Pure: no React, no storage. The strip passes blobs + the CALL OK answer.
 */

export const OPENER_IDS = ['greeting_en', 'greeting_es'];

const SLOTS = ['morning', 'afternoon', 'evening'];
const SLOT_NAME = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

/**
 * @param {string} actionId   'greeting_en' | 'greeting_es'
 * @param {object} blobs      clip key → Blob (missing key = not recorded)
 * @param {boolean} callOk    CALL OK passed for this family on this route
 * @param {boolean} gated     false in mic-test mode (CALL OK is not checked there)
 */
export function openerReadiness(actionId, blobs, callOk, gated = true) {
  const lang = actionId.slice(-2).toUpperCase();
  const missing = SLOTS.filter((s) => !blobs[`${actionId}_${s}`]);
  const have = SLOTS.length - missing.length;
  const missingText = missing.map((s) => SLOT_NAME[s]).join(', ');

  if (have === 0) {
    return { lang, state: 'none', glyph: '✗', missing,
      text: `${lang} opener: nothing recorded — the tile fires nothing` };
  }
  if (gated && !callOk) {
    return { lang, state: 'locked', glyph: '🔒', missing,
      text: `${lang} opener: recorded, but not caller-tested on this output (CALL OK) — the tile will refuse` };
  }
  if (missing.length) {
    return { lang, state: 'partial', glyph: `${have}/3`, missing,
      text: `${lang} opener: missing ${missingText} — a nearby time slot plays instead` };
  }
  return { lang, state: 'ok', glyph: '✓', missing,
    text: `${lang} opener: all 3 recorded and caller-tested` };
}
