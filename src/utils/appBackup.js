/**
 * FILE-BASED APP BACKUP — one JSON file that brings the app back after a hot
 * reload, a fresh local deploy, or a cleared browser wipes localStorage/IDB.
 *
 * WHY A NEW MODULE: `storage.js` already serialises every IndexedDB blob
 * (greeting audio, thumbnails, wallpaper) but knows nothing about the
 * localStorage side. This module is the single envelope that carries BOTH,
 * split into opt-in scopes, so a goals-only rescue is a few kB instead of a
 * file full of audio.
 *
 * HARD RULES — each one is covered by a test in appBackup.test.js:
 *  1. Never blind-overwrite `catintassist_stats`. Read it, patch only the
 *     fields the backup carries, write the whole object back. Fields the
 *     backup does not mention survive; keys outside the chosen scopes survive.
 *  2. Never restore "now" fields (lastDate / lastMonthKey / dayStartTime /
 *     shiftStartSentiment / lastBreakEndTime). Restoring them fakes a midnight
 *     or month rollover and can zero out the month being worked in.
 *  3. API keys cannot leave the app: every scope is built from explicit
 *     allow-lists AND every payload passes through stripSecretsFromMap +
 *     assertNoSecretKeys, so a future allow-list edit cannot add one by mistake.
 *  4. Restore only writes allow-listed localStorage keys — a hand-edited file
 *     cannot inject arbitrary keys.
 *  5. Transcripts (`catint_captions_v2`, `catint_last_call_v1`) and notes
 *     (`catintassist_notes`) are in NO scope.
 */

import { exportStorageBackup, importStorageBackup, getStorageSummary } from './storage';
import { exportCorrections, importCorrections } from './transcriptCorrections';
import { CLOUD_SYNC_KEYS, collectLocalSettings, applySettingsToLocal } from '../services/settingsService';

export const BACKUP_FORMAT = 'catintassist-backup';
export const BACKUP_VERSION = 1;

/** localStorage keys this module knows about (single source: the stats blob). */
export const STATS_KEY = 'catintassist_stats';
export const GOAL_WORKDAYS_KEY = 'catint_goal_workdays_v1';
export const DAILY_LOG_KEY = 'catintassist_daily_log';
export const HISTORY_TIMELINE_KEY = 'catintassist_history_timeline';

export const SCOPE_IDS = ['goals', 'progress', 'greetings', 'settings', 'corrections'];

export const SCOPE_META = {
  goals: { label: 'Goals', hint: 'target + workdays basis' },
  progress: { label: 'Month progress', hint: 'minutes, daily log, timelines' },
  greetings: { label: 'Greetings', hint: 'prerecorded audio — biggest file' },
  settings: { label: 'Settings', hint: 'language, audio, layout prefs' },
  corrections: { label: 'Corrections', hint: 'taught STT + glossary' },
};

/**
 * ALLOW-LIST #1 — which `catintassist_stats` fields belong to which scope.
 * `goalWorkDays` rides with the goal on purpose: bankGoal() writes it inside
 * the anchor (goalAnchor.buildGoalAnchor) and GoalTrackingView reads it back
 * as the committed workdays basis, so a goal without it restores half-armed.
 */
export const SCOPE_STATS_FIELDS = {
  goals: ['goalMinutes', 'goalSetAt', 'goalBaseMinutes', 'goalPerWorkdayMinutes', 'goalWorkDays'],
  progress: [
    'monthlyMinutes', 'dailyMinutes', 'weeklyMinutes', 'dailyBreakMinutes',
    'dailyAvailMinutes', 'callsToday', 'streak',
  ],
};

/** ALLOW-LIST #2 — localStorage keys carried outside the stats blob. */
export const SCOPE_LOCAL_KEYS = {
  goals: [GOAL_WORKDAYS_KEY],
  progress: [DAILY_LOG_KEY, HISTORY_TIMELINE_KEY],
};

/** Set by settingsService — reused, never re-typed here. */
export const SCOPE_SETTINGS_KEYS = CLOUD_SYNC_KEYS;

/**
 * "NOW" FIELDS — describe the live session, not the user's work. Restoring
 * them would move today's date/month anchor and trigger a phantom rollover.
 */
export const EPHEMERAL_STATS_FIELDS = [
  'lastDate', 'lastMonthKey', 'dayStartTime', 'shiftStartSentiment', 'lastBreakEndTime',
];

/** Secrets that must never reach a file. Belt to the allow-lists' braces. */
export const SECRET_KEYS = ['DEEPGRAM_API_KEY', 'AZURE_TRANSLATOR_KEY', 'dg_cipher', 'dg_iv', 'dg_salt'];
const SECRET_KEY_PATTERN = /(api[_-]?key|_key$|cipher|_iv$|_salt$|token|secret|password)/i;

/** IndexedDB keys that must never be swept into the greetings scope. */
export const IDB_DENY_KEYS = ['catint_captions_v2', 'catint_last_call_v1'];

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Human size for the UI ("12.4 kB"). */
export const formatBytes = (n) => {
  const bytes = Number(n) || 0;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${bytes} B`;
};

const hasLocalStorage = () => typeof localStorage !== 'undefined' && localStorage !== null;

/** JSON text length in bytes (utf-8 aware), works with or without TextEncoder. */
export const byteSize = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text == null) return 0;
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length;
};

const readJson = (key, fallback) => {
  if (!hasLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
};

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** The stats blob as an object (never throws, never null). */
export const readStats = () => {
  const parsed = readJson(STATS_KEY, {});
  return isPlainObject(parsed) ? parsed : {};
};

// ── secret guard ───────────────────────────────────────────────────────────

export const isSecretKey = (key) => SECRET_KEYS.includes(String(key)) || SECRET_KEY_PATTERN.test(String(key));

/** Drop secret-looking entries from a flat key→value map. @returns {{safe, dropped}} */
export const stripSecretsFromMap = (map = {}) => {
  const safe = {};
  const dropped = [];
  Object.entries(isPlainObject(map) ? map : {}).forEach(([key, value]) => {
    if (isSecretKey(key)) dropped.push(key);
    else safe[key] = value;
  });
  return { safe, dropped };
};

/** Every secret-looking KEY anywhere in a nested object (paths, for tests). */
export const findSecretKeys = (value, path = '') => {
  if (Array.isArray(value)) return value.flatMap((v, i) => findSecretKeys(v, `${path}[${i}]`));
  if (!isPlainObject(value)) return [];
  return Object.entries(value).flatMap(([key, v]) => {
    const here = path ? `${path}.${key}` : key;
    return isSecretKey(key) ? [here] : findSecretKeys(v, here);
  });
};

const assertNoSecretKeys = (payload) => {
  const leaks = findSecretKeys(payload);
  if (leaks.length) throw new Error(`Refusing to write a backup containing secret keys: ${leaks.join(', ')}`);
};

// ── scope normalisation ────────────────────────────────────────────────────

/** Unknown ids are dropped; empty/absent means "all scopes". */
export const normalizeScopes = (scopes) => {
  if (scopes == null) return [...SCOPE_IDS];
  const list = Array.isArray(scopes) ? scopes : [scopes];
  return SCOPE_IDS.filter((id) => list.includes(id));
};

/** localStorage keys a set of scopes is allowed to write on restore. */
export const allowedLocalKeys = (scopes) => {
  const allowed = new Set();
  normalizeScopes(scopes).forEach((id) => {
    (SCOPE_LOCAL_KEYS[id] || []).forEach((k) => allowed.add(k));
    if (id === 'settings') SCOPE_SETTINGS_KEYS.forEach((k) => allowed.add(k));
  });
  return allowed;
};

// ── build ──────────────────────────────────────────────────────────────────

const pickFields = (source, fields) => {
  const out = {};
  fields.forEach((f) => {
    if (!Object.prototype.hasOwnProperty.call(source, f)) return;
    if (source[f] === undefined) return;
    out[f] = source[f];
  });
  return out;
};

const readLocalKeys = (keys) => {
  const out = {};
  if (!hasLocalStorage()) return out;
  keys.forEach((key) => {
    try {
      const value = localStorage.getItem(key);
      if (value != null) out[key] = value;
    } catch {
      /* ignore */
    }
  });
  return out;
};

/**
 * Build the envelope. Async only because the greetings scope reads IndexedDB.
 * @param {{scopes?: string[], now?: Date}} opts  scopes omitted/empty = all of them
 */
export const buildAppBackup = async ({ scopes, now = new Date() } = {}) => {
  const wanted = normalizeScopes(scopes);
  if (!wanted.length) throw new Error('No backup scopes selected');
  const dropped = [];
  const warnings = [];
  const carried = wanted;

  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    scopes: {},
  };

  const stats = readStats();

  ['goals', 'progress'].forEach((id) => {
    if (!carried.includes(id)) return;
    const { safe, dropped: droppedKeys } = stripSecretsFromMap(readLocalKeys(SCOPE_LOCAL_KEYS[id] || []));
    dropped.push(...droppedKeys);
    backup.scopes[id] = { stats: pickFields(stats, SCOPE_STATS_FIELDS[id]), local: safe };
  });

  if (carried.includes('settings')) {
    const { safe, dropped: droppedKeys } = stripSecretsFromMap(collectLocalSettings());
    dropped.push(...droppedKeys);
    backup.scopes.settings = { local: safe };
  }

  if (carried.includes('corrections')) {
    let items = [];
    try {
      const parsed = JSON.parse(exportCorrections());
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      warnings.push('corrections could not be read');
    }
    backup.scopes.corrections = { items };
  }

  if (carried.includes('greetings')) {
    try {
      const storage = await exportStorageBackup();
      const items = {};
      Object.entries(storage?.items || {}).forEach(([key, item]) => {
        if (IDB_DENY_KEYS.includes(key)) return; // transcripts never travel
        items[key] = item;
      });
      backup.scopes.greetings = { storage: { v: storage?.v || 1, exportedAt: storage?.exportedAt || null, items } };
    } catch (err) {
      warnings.push('greetings could not be read from IndexedDB');
      backup.scopes.greetings = { storage: { v: 1, items: {} } };
    }
  }

  if (dropped.length) {
    // Only the COUNT is recorded — writing the secret's name would put it in
    // the file, which is exactly what rule 3 forbids.
    warnings.push(`${dropped.length} sensitive key(s) stripped from this backup`);
  }
  if (warnings.length) backup.warnings = warnings;

  assertNoSecretKeys(backup.scopes);
  return backup;
};

/** Compact single-line JSON — pretty-printing audio byte arrays doubles the file. */
export const serializeAppBackup = (backup) => JSON.stringify(backup);

/**
 * `catintassist-backup-2026-09-20.json` for a full backup; a SUBSET gets its
 * scopes in the name (`…-goals-progress-…`) because the browser overwrites a
 * same-named download in the same folder — a quick goals+progress save must not
 * replace the all-scopes file of the same day.
 */
export const backupFileName = (scopes, now = new Date()) => {
  const wanted = normalizeScopes(scopes);
  const tag = wanted.length && wanted.length < SCOPE_IDS.length ? `${wanted.join('-')}-` : '';
  return `catintassist-backup-${tag}${isoDay(now)}.json`;
};

/**
 * Build + push the file to the browser's download folder.
 * @returns {Promise<{filename, bytes, scopes, warnings}>}
 */
export const downloadAppBackup = async ({ scopes, now = new Date() } = {}) => {
  const wanted = normalizeScopes(scopes);
  const backup = await buildAppBackup({ scopes: wanted, now });
  const json = serializeAppBackup(backup);
  const filename = backupFileName(wanted, now);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Keep the blob URL alive long enough for the browser to finish writing: a
  // greetings backup is megabytes, where the old per-clip download revoked the
  // URL immediately (fine for one clip, riskier as the file grows). The URL
  // dies with the page anyway.
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch { /* already gone */ }
  }, 60000);
  return { filename, bytes: byteSize(json), scopes: wanted, warnings: backup.warnings || [] };
};

// ── summary ────────────────────────────────────────────────────────────────

const countLocalKeys = (local = {}) => Object.keys(local).length;

/** Cheap description of one scope payload: {"bytes": n, "count": n, "detail": "…"} */
export const describeScope = (id, payload) => {
  const bytes = byteSize(payload || {});
  if (id === 'greetings') {
    const items = Object.keys(payload?.storage?.items || {});
    return { id, bytes, count: items.length, detail: items.length ? `${items.length} file(s)` : 'no audio files' };
  }
  if (id === 'corrections') {
    const n = Array.isArray(payload?.items) ? payload.items.length : 0;
    return { id, bytes, count: n, detail: `${n} correction(s)` };
  }
  if (id === 'settings') {
    const n = countLocalKeys(payload?.local);
    return { id, bytes, count: n, detail: `${n} preference(s)` };
  }
  const statsCount = Object.keys(payload?.stats || {}).length;
  const n = countLocalKeys(payload?.local);
  return {
    id,
    bytes,
    count: statsCount + n,
    detail: id === 'goals'
      ? `${statsCount} goal field(s)` + (n ? ' + workdays basis' : '')
      : `${statsCount} stat(s)` + (n ? ` + ${n} stored map(s)` : ''),
  };
};

/** Per-scope counts/bytes for the UI. */
export const appBackupSummary = (backup) => {
  const scopes = isPlainObject(backup?.scopes) ? backup.scopes : {};
  const entries = SCOPE_IDS.filter((id) => isPlainObject(scopes[id])).map((id) => describeScope(id, scopes[id]));
  return { totalBytes: byteSize(backup || {}), entries };
};

/**
 * What is on THIS machine right now, per scope — cheap sizes for the UI
 * ("before"). Greeting bytes are raw audio, not JSON-inflated.
 */
export const estimateScopeSizes = async (scopes) => {
  const wanted = normalizeScopes(scopes);
  let idbBytes = 0;
  let idbKeys = 0;
  if (wanted.includes('greetings')) {
    try {
      const summary = await getStorageSummary();
      idbBytes = summary.bytes || 0;
      idbKeys = (summary.keys || []).filter((k) => !IDB_DENY_KEYS.includes(k)).length;
    } catch {
      idbBytes = 0;
    }
  }
  const stats = readStats();
  const out = {};
  wanted.forEach((id) => {
    if (id === 'greetings') {
      out[id] = { bytes: idbBytes, count: idbKeys, detail: idbKeys ? `${idbKeys} file(s) on disk` : 'no audio files' };
      return;
    }
    if (id === 'settings') {
      const local = readLocalKeys(SCOPE_SETTINGS_KEYS);
      out[id] = { bytes: byteSize(local), count: Object.keys(local).length, detail: `${Object.keys(local).length} preference(s) stored` };
      return;
    }
    if (id === 'corrections') {
      let n = 0;
      try {
        const parsed = JSON.parse(exportCorrections());
        n = Array.isArray(parsed) ? parsed.length : 0;
      } catch { n = 0; }
      out[id] = { bytes: 0, count: n, detail: `${n} correction(s) saved` };
      return;
    }
    const local = readLocalKeys(SCOPE_LOCAL_KEYS[id] || []);
    const statsCount = Object.keys(pickFields(stats, SCOPE_STATS_FIELDS[id])).length;
    out[id] = {
      bytes: byteSize(local),
      count: statsCount + Object.keys(local).length,
      detail: `${statsCount} field(s) in stats` + (Object.keys(local).length ? ' + stored maps' : ''),
    };
  });
  return out;
};

// ── validate ───────────────────────────────────────────────────────────────

/** @returns {{ok: true, scopes, exportedAt, origin} | {ok: false, reason}} */
export const validateAppBackup = (input) => {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, reason: 'Not valid JSON' };
    }
  }
  if (!isPlainObject(data)) return { ok: false, reason: 'Not a backup object' };
  if (data.format !== BACKUP_FORMAT) return { ok: false, reason: `Not a ${BACKUP_FORMAT} file` };
  const version = Number(data.version);
  if (!Number.isFinite(version) || version < 1) return { ok: false, reason: 'Backup has no version' };
  if (version > BACKUP_VERSION) {
    return { ok: false, reason: `Backup version ${version} is newer than this app (v${BACKUP_VERSION}) — update the app first` };
  }
  if (!isPlainObject(data.scopes)) return { ok: false, reason: 'Backup carries no scopes' };
  const scopes = SCOPE_IDS.filter((id) => isPlainObject(data.scopes[id]));
  if (!scopes.length) return { ok: false, reason: 'No recognised scopes in this file' };
  return { ok: true, scopes, exportedAt: data.exportedAt || null, origin: data.origin || '' };
};

// ── restore ────────────────────────────────────────────────────────────────

/**
 * THE MERGE RULE for `catintassist_stats`, pure half (so it can be tested
 * without touching storage): overlay `patch` on `current`.
 *  - fields the patch does not mention are copied through untouched;
 *  - "now" fields and secret-looking names are refused even if present;
 *  - the result is a full object, so the blob is never replaced wholesale.
 * @returns {{next: object, written: string[], refused: string[]}}
 */
export const mergeStatsFields = (current = {}, patch = {}) => {
  const next = { ...(isPlainObject(current) ? current : {}) };
  const written = [];
  const refused = [];
  Object.entries(isPlainObject(patch) ? patch : {}).forEach(([field, value]) => {
    if (EPHEMERAL_STATS_FIELDS.includes(field) || isSecretKey(field)) {
      refused.push(field);
      return;
    }
    if (value === undefined) return;
    next[field] = value;
    written.push(field);
  });
  return { next, written, refused };
};

/** Storage half: read the live blob, merge, write the whole object back. */
const patchStats = (patch) => {
  const { next, written, refused } = mergeStatsFields(readStats(), patch);
  if (!written.length || !hasLocalStorage()) return { written: [], refused };
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(next));
  } catch {
    return { written: [], refused };
  }
  return { written, refused };
};

/**
 * Write allow-listed local keys. With `merge` (progress maps: daily log /
 * history timeline) a map-shaped value is MERGED over what is stored — days
 * worked after the backup survive; the backup wins per day it does carry.
 */
const applyLocalKeys = (local, allowed, { merge = false } = {}) => {
  const { safe } = stripSecretsFromMap(local);
  const written = [];
  const skipped = [];
  if (!hasLocalStorage()) return { written, skipped: Object.keys(safe) };
  Object.entries(safe).forEach(([key, value]) => {
    if (!allowed.has(key)) {
      skipped.push(key);
      return;
    }
    if (value == null) return;
    try {
      const incoming = merge && typeof value === 'string' ? safeJsonParse(value) : value;
      if (merge && isPlainObject(incoming)) {
        const current = readJson(key, {});
        localStorage.setItem(key, JSON.stringify({ ...(isPlainObject(current) ? current : {}), ...incoming }));
      } else {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
      written.push(key);
    } catch {
      skipped.push(key);
    }
  });
  return { written, skipped };
};

/**
 * Apply a backup file (object, or raw JSON text) to this browser.
 * @param {object|string} input
 * @param {{scopes?: string[]}} [opts] restrict to a subset of the file's scopes
 * @returns {Promise<{ok, error?, scopes?, applied?, warnings, skippedKeys}>}
 */
export const restoreAppBackup = async (input, { scopes } = {}) => {
  const check = validateAppBackup(input);
  if (!check.ok) return { ok: false, error: check.reason, applied: {}, warnings: [], skippedKeys: [] };

  const data = typeof input === 'string' ? JSON.parse(input) : input;
  const requested = scopes == null ? check.scopes : normalizeScopes(scopes);
  const carried = requested.filter((id) => isPlainObject(data.scopes[id]));
  const skippedScopes = requested.filter((id) => !isPlainObject(data.scopes[id]));
  if (!carried.length) return { ok: false, error: 'None of the selected scopes are in this file', applied: {}, warnings: [], skippedKeys: [] };

  const allowed = allowedLocalKeys(carried);
  const applied = {};
  const warnings = [];
  const skippedKeys = [];

  // ONE read-modify-write for both stats-carrying scopes, so goals + progress
  // can never land apart. Only allow-listed fields are read out of the file, so
  // a hand-edited backup cannot inject a field the app does not own.
  const patch = {};
  const owner = {};
  ['goals', 'progress'].forEach((id) => {
    if (!carried.includes(id)) return;
    const scope = data.scopes[id];
    const incoming = isPlainObject(scope.stats) ? scope.stats : {};
    SCOPE_STATS_FIELDS[id].forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(incoming, field)) return;
      patch[field] = incoming[field];
      owner[field] = id;
    });
  });
  const { written, refused } = Object.keys(patch).length ? patchStats(patch) : { written: [], refused: [] };
  if (refused.length) warnings.push(`kept current ${refused.join(', ')} (they describe "now", not your work)`);

  ['goals', 'progress'].forEach((id) => {
    if (!carried.includes(id)) return;
    const localResult = applyLocalKeys(data.scopes[id].local, allowed, { merge: id === 'progress' });
    skippedKeys.push(...localResult.skipped);
    applied[id] = {
      statsFields: written.filter((field) => owner[field] === id),
      localKeys: localResult.written,
    };
  });

  if (carried.includes('settings')) {
    const { safe } = stripSecretsFromMap(data.scopes.settings.local);
    const keys = applySettingsToLocal(safe);
    applied.settings = { keys };
  }

  if (carried.includes('corrections')) {
    const items = data.scopes.corrections.items;
    let result = { imported: 0, total: 0 };
    try {
      result = importCorrections(Array.isArray(items) ? items : []);
    } catch {
      warnings.push('corrections could not be imported');
    }
    applied.corrections = { items: result.imported, total: result.total };
  }

  if (carried.includes('greetings')) {
    try {
      const storage = data.scopes.greetings.storage;
      const items = {};
      Object.entries(storage?.items || {}).forEach(([key, item]) => {
        if (IDB_DENY_KEYS.includes(key)) return;
        items[key] = item;
      });
      const count = await importStorageBackup({ ...storage, items });
      applied.greetings = { files: count };
    } catch (err) {
      warnings.push('greetings could not be written to IndexedDB');
      applied.greetings = { files: 0 };
    }
  }

  return {
    ok: true,
    scopes: carried,
    skippedScopes,
    applied,
    warnings,
    skippedKeys,
    exportedAt: check.exportedAt,
    origin: check.origin,
  };
};

/** One-line human summary of a restore report (for the status line). */
export const describeRestoreReport = (report) => {
  if (!report?.ok) return report?.error || 'Restore failed';
  const bits = [];
  const g = report.applied?.goals;
  if (g) bits.push(`goals ${g.statsFields.length} field(s)` + (g.localKeys.length ? ' + workdays' : ''));
  const p = report.applied?.progress;
  if (p) bits.push(`progress ${p.statsFields.length} field(s)` + (p.localKeys.length ? ` + ${p.localKeys.length} map(s)` : ''));
  const s = report.applied?.settings;
  if (s) bits.push(`${s.keys} setting(s)`);
  const c = report.applied?.corrections;
  if (c) bits.push(`${c.items} correction(s)`);
  const gr = report.applied?.greetings;
  if (gr) bits.push(`${gr.files} audio file(s)`);
  return bits.length ? `Restored: ${bits.join(' · ')}` : 'Nothing to restore';
};
