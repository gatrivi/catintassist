/**
 * Undo for the goal configurator's destructive writes (v4.162.0).
 *
 * Why this is NOT the call-log undo (see `callLogImport.js`): that one restores
 * `dailyLog` + `historyTimeline`, which are maps of every day ever worked and
 * need a per-day snapshot to stay small. `catintassist_stats` is ONE small
 * object, so the whole thing is cheap to keep. Different shape on purpose —
 * please do not "unify" these.
 *
 * One level deep, by design: the operator wants "put my month back", not a
 * history to rewind through. Survives a reload, because the mistake that
 * matters is usually noticed a minute later, not a second later.
 */

export const STAT_UNDO_KEY = 'catint_stat_undo_v1';

export const STATS_KEY = 'catintassist_stats';

const readStats = () => {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

const writeStats = (stats) => {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* private mode: the undo just will not survive a reload */ }
};

/** Take a snapshot of `stats` BEFORE a destructive write. Never throws. */
export const captureStatUndo = (label, stats = null) => {
  try {
    const snapshot = {
      label: String(label || 'change'),
      savedAt: Date.now(),
      stats: stats || readStats(),
    };
    localStorage.setItem(STAT_UNDO_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return null;
  }
};

export const readStatUndo = () => {
  try {
    const snap = JSON.parse(localStorage.getItem(STAT_UNDO_KEY) || 'null');
    return snap && snap.stats ? snap : null;
  } catch {
    return null;
  }
};

export const clearStatUndo = () => {
  try {
    localStorage.removeItem(STAT_UNDO_KEY);
  } catch { /* ignore */ }
};

/**
 * Put the snapshot back. Returns the restored stats, or null if there was
 * nothing to undo. The caller is responsible for pushing the result into
 * React state — this only owns storage.
 */
export const applyStatUndo = () => {
  const snap = readStatUndo();
  if (!snap) return null;
  writeStats(snap.stats);
  clearStatUndo();
  return snap.stats;
};

/**
 * Parse a correction field. Returns null for anything that must NOT be written.
 *
 * The bug this exists to stop: `Number('') === 0` passes a `>= 0` check, so
 * clearing the "banked/mo" box to retype it and pressing Set wrote 0 and wiped
 * the month. An empty field is a mistake, not a request to zero the month.
 */
export const parseMinuteCorrection = (raw) => {
  const text = String(raw ?? '').trim();
  if (!text) return null; // cleared field: refuse rather than write 0
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
};

/** `9240m → 3360m (−5880)` for the confirm rows. */
export const formatMinuteChange = (from, to) => {
  const a = Math.round(Number(from) || 0);
  const b = Math.round(Number(to) || 0);
  const delta = b - a;
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  return `${a}m → ${b}m (${sign})`;
};
