/**
 * Work-clock helpers — shift time is US CENTRAL, never the machine clock.
 *
 * WHY: interpreters work US Central (America/Chicago) hours. Reading the
 * OS clock meant a GMT-3 machine at 13:02 local picked the AFTERNOON opener
 * while it was still 11:02 Central — the wrong recording fired to the patient.
 * Everything that picks a time-of-day slot (greetings strip, Studio) must ask
 * this module instead of `new Date().getHours()`.
 *
 * v4.131.1: the clock is only the DEFAULT. The interpreter can pick the slot
 * by hand (AM/PM/Eve in the on-call pill) and that pick always wins — a wrong
 * clock must never overrule a human choosing the recording the caller hears.
 */

/** The shift timezone. One place, so strip + Studio can never disagree. */
export const WORK_TIMEZONE = 'America/Chicago';

/** Slot ids in chronological order. */
export const TIME_SLOTS = ['morning', 'afternoon', 'evening'];

/** localStorage key for the interpreter's manual slot pick (`null` = clock). */
export const SLOT_OVERRIDE_KEY = 'catint_slot_override_v1';

const isSlot = (v) => TIME_SLOTS.includes(v);

/**
 * The interpreter's manual pick, or `null` for "follow the clock".
 * A junk value (or a browser with no storage) reads as `null`, never throws.
 * @returns {'morning'|'afternoon'|'evening'|null}
 */
export const readSlotOverride = () => {
  try {
    const raw = localStorage.getItem(SLOT_OVERRIDE_KEY);
    return isSlot(raw) ? raw : null;
  } catch {
    return null; // private mode / storage blocked — behave like "auto"
  }
};

/**
 * Save (or clear) the manual pick.
 * `null` or anything unknown REMOVES the key, so "auto" is really the absence
 * of a choice — never a stored string we have to special-case later.
 * @param {'morning'|'afternoon'|'evening'|null} slot
 */
export const writeSlotOverride = (slot) => {
  try {
    if (isSlot(slot)) localStorage.setItem(SLOT_OVERRIDE_KEY, slot);
    else localStorage.removeItem(SLOT_OVERRIDE_KEY);
  } catch {
    /* storage blocked — the clock rule keeps working, nothing to report */
  }
};

const HOUR_FORMATTER_ARGS = [
  'en-US',
  { timeZone: WORK_TIMEZONE, hour12: false, hour: '2-digit' },
];

/**
 * Hour (0-23) in WORK_TIMEZONE.
 * Falls back to the machine hour if Intl or the timeZone data is unavailable,
 * so a stale browser degrades to old behaviour instead of crashing.
 * @param {Date} [date]
 * @returns {number}
 */
export const getWorkHour = (date = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat(...HOUR_FORMATTER_ARGS).formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const n = parseInt(hour, 10);
    if (Number.isFinite(n)) return n % 24; // some engines yield "24" at midnight
  } catch {
    /* Intl/timeZone unavailable — fall through to the local clock */
  }
  return date.getHours();
};

/**
 * The clock-only slot in Central time (the pre-picker rule, unchanged).
 * Boundaries: morning before 12:00, afternoon before 17:00, evening after.
 * @param {Date} [date]
 * @returns {'morning'|'afternoon'|'evening'}
 */
export const getSlotAuto = (date = new Date()) => {
  const h = getWorkHour(date);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

/**
 * The slot everything should use: the interpreter's pick if there is one,
 * otherwise the Central clock.
 * @param {Date} [date]
 * @returns {'morning'|'afternoon'|'evening'}
 */
export const getWorkSlot = (date = new Date()) => readSlotOverride() || getSlotAuto(date);

const CLOCK_FORMATTER_ARGS = [
  'en-US',
  { timeZone: WORK_TIMEZONE, hour: 'numeric', minute: '2-digit' },
];

/**
 * Short human label for the current time in WORK_TIMEZONE, e.g. `11:15 AM`.
 * Shown in the on-call pill so an off-by-one/two shift clock is visible at a
 * glance. Never throws: falls back to the machine's local formatting.
 * @param {Date} [date]
 * @returns {string}
 */
export const getWorkClockLabel = (date = new Date()) => {
  try {
    return new Intl.DateTimeFormat(...CLOCK_FORMATTER_ARGS).format(date);
  } catch {
    /* Intl/timeZone unavailable — fall through to the local clock */
  }
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Nearest-first fallback per slot: when the current slot has no recording, use
 * the slot that still sounds right for the hour (afternoon before morning when
 * evening is empty).
 */
export const SLOT_FALLBACK_ORDER = {
  morning: ['afternoon', 'evening'],
  afternoon: ['morning', 'evening'],
  evening: ['afternoon', 'morning'],
};

/**
 * `[slot, ...nearest]` — the order to try clip keys in.
 * @param {'morning'|'afternoon'|'evening'} slot
 * @returns {string[]}
 */
export const nearestSlotOrder = (slot) => [slot, ...(SLOT_FALLBACK_ORDER[slot] || TIME_SLOTS)];
