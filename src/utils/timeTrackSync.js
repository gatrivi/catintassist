/**
 * Time-track cloud sync helpers (v4.99.0) — PURE functions, no Firebase imports.
 *
 * The day ledger: per-date worked minutes + on/off-call segments. localStorage
 * stays the durability source; Firestore `users/{uid}/timetrack/main` is a mirror.
 * Anti-clobber rule (lesson from the deleted ntfy.sh sync): a sparse cloud doc may
 * never destroy a populated local ledger — merge only fills MISSING past days.
 */

export const TIMETRACK_MAX_DAYS = 90;
export const TIMETRACK_CHANGED_EVENT = 'cat_timetrack_changed';

/** Parse a toDateString() key ("Mon Sep 09 2026") → epoch ms (NaN if unparseable). */
export const dateKeyToMs = (key) => Date.parse(`${key} 00:00:00`);

/** Keep only the newest `maxDays` date keys (unparseable keys are dropped first). */
export const pruneDateKeys = (obj, maxDays = TIMETRACK_MAX_DAYS) => {
  const keys = Object.keys(obj);
  if (keys.length <= maxDays) return obj;
  const keep = keys
    .filter((k) => !Number.isNaN(dateKeyToMs(k)))
    .sort((a, b) => dateKeyToMs(b) - dateKeyToMs(a))
    .slice(0, maxDays)
    .reverse(); // chronological insertion order (oldest → newest)
  const out = {};
  keep.forEach((k) => { out[k] = obj[k]; });
  return out;
};

/**
 * Build the Firestore snapshot from the durability-source objects.
 * Banked values only — live seconds are excluded (they bank every 60s).
 * Shape: { [date]: { minutes, segments, availMinutes?, breakMinutes?, calls? } }
 * (avail/break/calls are recorded while a day is "today"; the entry keeps that
 * snapshot after the day rolls over.)
 */
export const buildTimeTrackSnapshot = ({
  dailyLog = {},
  historyTimeline = {},
  todayTimeline = [],
  stats = {},
  todayStr,
}) => {
  const days = {};
  Object.keys(dailyLog).forEach((date) => {
    days[date] = { minutes: Math.round(dailyLog[date] || 0), segments: historyTimeline[date] || [] };
  });
  Object.keys(historyTimeline).forEach((date) => {
    if (!days[date]) days[date] = { minutes: Math.round(dailyLog[date] || 0), segments: historyTimeline[date] };
  });
  days[todayStr] = {
    minutes: Math.round(stats.dailyMinutes || 0),
    segments: todayTimeline,
    availMinutes: Math.round(stats.dailyAvailMinutes || 0),
    breakMinutes: Math.round(stats.dailyBreakMinutes || 0),
    calls: stats.callsToday || 0,
  };
  return pruneDateKeys(days);
};

/**
 * Merge cloud days into local copies — never overwrites, never touches today
 * (today is local-authoritative). Returns new objects + how many days filled in.
 */
export const mergeCloudDays = ({ dailyLog = {}, historyTimeline = {}, cloudDays = {}, todayStr }) => {
  const nextLog = { ...dailyLog };
  const nextHistory = { ...historyTimeline };
  let imported = 0;
  Object.keys(cloudDays).forEach((date) => {
    if (date === todayStr) return;
    const day = cloudDays[date] || {};
    let touched = false;
    if (typeof day.minutes === 'number' && nextLog[date] === undefined) {
      nextLog[date] = Math.round(day.minutes);
      touched = true;
    }
    if (Array.isArray(day.segments) && day.segments.length > 0 && !nextHistory[date]) {
      nextHistory[date] = day.segments;
      touched = true;
    }
    if (touched) imported += 1;
  });
  return { dailyLog: nextLog, historyTimeline: nextHistory, imported };
};
