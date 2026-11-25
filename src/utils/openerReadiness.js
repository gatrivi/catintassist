/**
 * v4.189.0 opener readiness — "am I missing an opener recording?" in one glance.
 *
 * Computes opener readiness purely from whether recordings exist in `blobs`.
 * No longer gates on `CALL OK` or route verification.
 *
 *   none    red    ✗    no recording at all → the tile fires nothing
 *   partial amber  2/3  some time slots missing → a fallback clip fires
 *   ok      green  ✓    all 3 recorded (or single-slot clip recorded)
 *
 * Pure: no React, no storage.
 */
import { TIME_SLOTS } from './workTime';

export const OPENER_IDS = ['greeting_en', 'greeting_es'];

const SLOT_NAME = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

/**
 * @param {string} actionId   'greeting_en' | 'greeting_es'
 * @param {Record<string, Blob|string|boolean|null|undefined>} [blobs={}] - Map of saved clip keys to blobs.
 */
export function openerReadiness(actionId, blobs = {}) {
  const safeBlobs = blobs || {};
  const lang = String(actionId || '').slice(-2).toUpperCase();
  const total = TIME_SLOTS.length;
  const missing = TIME_SLOTS.filter((s) => !safeBlobs[`${actionId}_${s}`]);
  const count = total - missing.length;
  const missingText = missing.map((s) => SLOT_NAME[s]).join(', ');

  // Fallback for single-slot (non-time-of-day) openers stored directly under actionId
  if (count === 0 && safeBlobs[actionId]) {
    const title = 'Recorded and ready to play';
    return {
      lang,
      state: 'ok',
      status: 'ok',
      glyph: '✓',
      badge: '✓',
      count: 1,
      total: 1,
      missing: [],
      text: `${lang} opener: ${title}`,
      title,
    };
  }

  if (count === 0) {
    const title = 'No recordings yet — record at least one greeting';
    return {
      lang,
      state: 'none',
      status: 'none',
      glyph: '✗',
      badge: '✗',
      count: 0,
      total,
      missing,
      text: `${lang} opener: nothing recorded — the tile fires nothing`,
      title,
    };
  }

  if (missing.length) {
    const badge = `${count}/${total}`;
    const title = `${count} of ${total} time-of-day greetings recorded`;
    return {
      lang,
      state: 'partial',
      status: 'partial',
      glyph: badge,
      badge,
      count,
      total,
      missing,
      text: `${lang} opener: missing ${missingText} — a nearby time slot plays instead`,
      title,
    };
  }

  const title = `All ${total} time-of-day greetings recorded`;
  return {
    lang,
    state: 'ok',
    status: 'ok',
    glyph: '✓',
    badge: '✓',
    count: total,
    total,
    missing,
    text: `${lang} opener: all 3 recorded`,
    title,
  };
}

export default openerReadiness;
