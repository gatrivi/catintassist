// jsdom 16 ships a Blob without arrayBuffer() (real Chrome has it — the greetings
// path is also exercised end-to-end in Chrome). Shim it for the test env only.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.readAsArrayBuffer(this);
    });
  };
}

// CRA resets mock impls before each test — assign in beforeEach (same as lastCallArchive.test.js).
jest.mock('idb-keyval');
const { set: idbSet, get: idbGet, del: idbDel, keys: idbKeys, entries: idbEntries } = require('idb-keyval');
const mockIdbStore = new Map();
beforeEach(() => {
  mockIdbStore.clear();
  idbSet.mockImplementation(async (k, v) => { mockIdbStore.set(k, v); });
  idbGet.mockImplementation(async (k) => mockIdbStore.get(k));
  idbDel.mockImplementation(async (k) => { mockIdbStore.delete(k); });
  idbKeys.mockImplementation(async () => Array.from(mockIdbStore.keys()));
  idbEntries.mockImplementation(async () => Array.from(mockIdbStore.entries()));
});

import {
  buildAppBackup,
  serializeAppBackup,
  restoreAppBackup,
  validateAppBackup,
  appBackupSummary,
  mergeStatsFields,
  stripSecretsFromMap,
  backupFileName,
  EPHEMERAL_STATS_FIELDS,
} from './appBackup';
import { importCorrections, loadCorrections, clearCorrections } from './transcriptCorrections';

/** Full localStorage snapshot — used to prove a rejected file wrote nothing. */
const snapshot = () =>
  JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));

const STATS = 'catintassist_stats';
const DAILY_LOG = 'catintassist_daily_log';
const HISTORY = 'catintassist_history_timeline';
const WORKDAYS = 'catint_goal_workdays_v1';

const SECRET_PAIRS = [
  ['DEEPGRAM_API_KEY', 'dg-live-secret-value'],
  ['AZURE_TRANSLATOR_KEY', 'az-secret-value'],
  ['dg_cipher', 'cipher-value'],
  ['dg_iv', 'iv-value'],
  ['dg_salt', 'salt-value'],
];

const readStats = () => JSON.parse(localStorage.getItem(STATS) || '{}');

const seedApp = () => {
  localStorage.setItem(STATS, JSON.stringify({
    // goal (scope: goals)
    goalMinutes: 9231,
    goalSetAt: '2026-09-01',
    goalBaseMinutes: 500,
    goalPerWorkdayMinutes: 240,
    goalWorkDays: 28,
    // progress (scope: progress)
    monthlyMinutes: 4321,
    dailyMinutes: 210,
    weeklyMinutes: 1200,
    dailyBreakMinutes: 30,
    dailyAvailMinutes: 480,
    callsToday: 7,
    streak: 4,
    // "now" bookkeeping + unknown fields — must always survive
    lastDate: 'Sat Sep 20 2026',
    lastMonthKey: '2026-8',
    dayStartTime: 1758300000000,
    shiftStartSentiment: 12,
    somethingUnknown: 'keep-me',
  }));
  localStorage.setItem(WORKDAYS, '28');
  localStorage.setItem(DAILY_LOG, JSON.stringify({ 'Sat Sep 19 2026': 300 }));
  localStorage.setItem(HISTORY, JSON.stringify({ 'Sat Sep 19 2026': [{ start: 1 }] }));
  localStorage.setItem('catint_lang_pair_v1', '{"left":"en","right":"es"}');
  localStorage.setItem('catintassist_notes', 'private patient notes');
  SECRET_PAIRS.forEach(([k, v]) => localStorage.setItem(k, v));
  importCorrections([{ sourceHeard: 'mid vail', corrected: 'Midvale', lang: 'en' }]);
};

beforeEach(() => {
  localStorage.clear();
  clearCorrections();
});

describe('appBackup — round trip per scope', () => {
  test('goals + progress come back after a full localStorage wipe', async () => {
    seedApp();
    const backup = await buildAppBackup({ scopes: ['goals', 'progress'] });

    localStorage.clear();
    expect(localStorage.getItem(STATS)).toBeNull();

    const report = await restoreAppBackup(backup);
    expect(report.ok).toBe(true);
    const stats = readStats();
    expect(stats.goalMinutes).toBe(9231);
    expect(stats.goalSetAt).toBe('2026-09-01');
    expect(stats.goalBaseMinutes).toBe(500);
    expect(stats.goalPerWorkdayMinutes).toBe(240);
    expect(stats.goalWorkDays).toBe(28);
    expect(stats.monthlyMinutes).toBe(4321);
    expect(stats.dailyMinutes).toBe(210);
    expect(stats.callsToday).toBe(7);
    expect(stats.streak).toBe(4);
    expect(localStorage.getItem(WORKDAYS)).toBe('28');
    expect(JSON.parse(localStorage.getItem(DAILY_LOG))).toEqual({ 'Sat Sep 19 2026': 300 });
    expect(JSON.parse(localStorage.getItem(HISTORY))).toEqual({ 'Sat Sep 19 2026': [{ start: 1 }] });
  });

  test('greetings round trip through the IndexedDB codec', async () => {
    mockIdbStore.set('greeting_en_morning', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }));
    mockIdbStore.set('catint_captions_v2', [{ text: 'transcript must not travel' }]);

    const backup = await buildAppBackup({ scopes: ['greetings'] });
    expect(Object.keys(backup.scopes.greetings.storage.items)).toEqual(['greeting_en_morning']);

    mockIdbStore.clear();
    const report = await restoreAppBackup(backup);
    expect(report.ok).toBe(true);
    expect(report.applied.greetings.files).toBe(1);
    const restored = mockIdbStore.get('greeting_en_morning');
    expect(restored).toBeInstanceOf(Blob);
    expect(restored.size).toBe(3);
    expect(mockIdbStore.has('catint_captions_v2')).toBe(false);
  });

  test('corrections + settings round trip', async () => {
    seedApp();
    const backup = await buildAppBackup({ scopes: ['corrections', 'settings'] });
    localStorage.clear();
    clearCorrections();

    const report = await restoreAppBackup(backup);
    expect(report.ok).toBe(true);
    expect(loadCorrections().map((c) => c.corrected)).toEqual(['Midvale']);
    expect(localStorage.getItem('catint_lang_pair_v1')).toBe('{"left":"en","right":"es"}');
  });
});

describe('appBackup — merge rules for catintassist_stats', () => {
  test('restoring only goals leaves progress fields and the daily log untouched', async () => {
    seedApp();
    const backup = await buildAppBackup({ scopes: ['goals'] });

    // Meanwhile the user kept working: goal edited, month moved on.
    const later = {
      ...readStats(),
      goalMinutes: 1, goalSetAt: '2026-09-19',
      monthlyMinutes: 5000, dailyMinutes: 120, callsToday: 9, streak: 5,
    };
    localStorage.setItem(STATS, JSON.stringify(later));
    localStorage.setItem(DAILY_LOG, JSON.stringify({ 'Sat Sep 19 2026': 300, 'Sat Sep 20 2026': 120 }));

    const report = await restoreAppBackup(backup);
    const stats = readStats();
    // goals restored
    expect(report.applied.goals.statsFields.sort()).toEqual(['goalBaseMinutes', 'goalMinutes', 'goalPerWorkdayMinutes', 'goalSetAt', 'goalWorkDays'].sort());
    expect(stats.goalMinutes).toBe(9231);
    expect(stats.goalSetAt).toBe('2026-09-01');
    // progress untouched
    expect(stats.monthlyMinutes).toBe(5000);
    expect(stats.dailyMinutes).toBe(120);
    expect(stats.callsToday).toBe(9);
    expect(stats.streak).toBe(5);
    expect(JSON.parse(localStorage.getItem(DAILY_LOG))).toEqual({ 'Sat Sep 19 2026': 300, 'Sat Sep 20 2026': 120 });
  });

  test('fields outside the scopes survive a restore (streak, lastDate, unknown keys, notes)', async () => {
    seedApp();
    const backup = await buildAppBackup({ scopes: ['goals'] });
    const before = readStats();

    await restoreAppBackup(backup);
    const after = readStats();

    expect(after.streak).toBe(before.streak);
    expect(after.lastDate).toBe(before.lastDate);
    expect(after.lastMonthKey).toBe(before.lastMonthKey);
    expect(after.dayStartTime).toBe(before.dayStartTime);
    expect(after.shiftStartSentiment).toBe(before.shiftStartSentiment);
    expect(after.somethingUnknown).toBe('keep-me');
    expect(localStorage.getItem('catintassist_notes')).toBe('private patient notes');
  });

  test('lastDate / lastMonthKey / dayStartTime are NOT overwritten even when the file carries them', async () => {
    seedApp();
    const before = readStats();
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;

    // Hand-edited / older file: a backup that DOES carry the "now" fields.
    const crafted = {
      format: 'catintassist-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      scopes: {
        progress: {
          stats: {
            monthlyMinutes: 999,
            lastDate: 'Thu Jan 01 1970',
            lastMonthKey: currentMonthKey === '1999-0' ? '1999-1' : '1999-0',
            dayStartTime: 0,
            shiftStartSentiment: -60,
          },
          local: { [DAILY_LOG]: JSON.stringify({ 'Thu Jan 01 1970': 5 }) },
        },
      },
    };

    const report = await restoreAppBackup(crafted);
    const after = readStats();
    expect(after.monthlyMinutes).toBe(999);            // the real payload applied
    expect(after.lastDate).toBe(before.lastDate);       // phantom rollover refused
    expect(after.lastMonthKey).toBe(before.lastMonthKey);
    expect(after.dayStartTime).toBe(before.dayStartTime);
    expect(after.shiftStartSentiment).toBe(before.shiftStartSentiment);
    expect(report.ok).toBe(true);
  });

  test('mergeStatsFields refuses "now" fields and keeps everything else (pure rule)', () => {
    const { next, written, refused } = mergeStatsFields(
      { lastDate: 'Sat Sep 20 2026', monthlyMinutes: 1, untouched: 'yes' },
      { monthlyMinutes: 42, lastDate: 'Thu Jan 01 1970', dg_iv: 'aXY=' },
    );
    expect(next.monthlyMinutes).toBe(42);
    expect(next.lastDate).toBe('Sat Sep 20 2026');
    expect(next.untouched).toBe('yes');
    expect(written).toEqual(['monthlyMinutes']);
    expect(refused.sort()).toEqual(['dg_iv', 'lastDate'].sort());
    expect(EPHEMERAL_STATS_FIELDS).toContain('lastMonthKey');
  });

  test('a progress restore merges the daily log instead of deleting days worked since', async () => {
    seedApp();
    const backup = await buildAppBackup({ scopes: ['progress'] });
    localStorage.setItem(DAILY_LOG, JSON.stringify({ 'Sat Sep 20 2026': 111 }));

    await restoreAppBackup(backup);
    expect(JSON.parse(localStorage.getItem(DAILY_LOG))).toEqual({ 'Sat Sep 19 2026': 300, 'Sat Sep 20 2026': 111 });
  });

  test('restore never writes localStorage keys outside the chosen scopes', async () => {
    seedApp();
    const crafted = {
      format: 'catintassist-backup',
      version: 1,
      scopes: {
        goals: {
          stats: { goalMinutes: 100 },
          local: { [WORKDAYS]: '22', catint_lang_pair_v1: '{"left":"es","right":"en"}', catintassist_notes: 'hacked' },
        },
      },
    };
    const report = await restoreAppBackup(crafted);
    expect(localStorage.getItem(WORKDAYS)).toBe('22');
    expect(localStorage.getItem('catint_lang_pair_v1')).toBe('{"left":"en","right":"es"}');
    expect(localStorage.getItem('catintassist_notes')).toBe('private patient notes');
    expect(report.skippedKeys).toEqual(expect.arrayContaining(['catint_lang_pair_v1', 'catintassist_notes']));
  });
});

describe('appBackup — secrets can never leak', () => {
  test('a backup with every scope selected contains no secret key or value', async () => {
    seedApp();
    mockIdbStore.set('greeting_en_morning', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }));

    const backup = await buildAppBackup({ scopes: ['goals', 'progress', 'greetings', 'settings', 'corrections'] });
    const json = serializeAppBackup(backup);

    SECRET_PAIRS.forEach(([key, value]) => {
      expect(json).not.toContain(key);
      expect(json).not.toContain(value);
    });
    expect(backup.scopes.settings.local).toEqual({
      // catint_goal_workdays_v1 is a cloud-synced pref, so the settings scope
      // carries it too (same value as the goals scope — harmless duplication).
      catint_goal_workdays_v1: '28',
      catint_lang_pair_v1: '{"left":"en","right":"es"}',
    });
    expect(json).not.toContain('private patient notes');
    expect(json).not.toContain('transcript must not travel');
    // sanity: the file really does carry the payloads we expect
    expect(backup.scopes.goals.stats.goalMinutes).toBe(9231);
    expect(Object.keys(backup.scopes.greetings.storage.items)).toEqual(['greeting_en_morning']);
  });

  test('stripSecretsFromMap drops secret names (allow-list safety net)', () => {
    const { safe, dropped } = stripSecretsFromMap({
      catint_lang_pair_v1: 'en-es',
      DEEPGRAM_API_KEY: 'x',
      AZURE_TRANSLATOR_KEY: 'y',
      dg_cipher: 'a',
      dg_iv: 'b',
      dg_salt: 'c',
    });
    expect(safe).toEqual({ catint_lang_pair_v1: 'en-es' });
    expect(dropped.length).toBe(5);
  });

  test('even a poisoned settings allow-list cannot put a secret in the file', async () => {
    localStorage.setItem('DEEPGRAM_API_KEY', 'dg-live-secret-value');
    localStorage.setItem('dg_iv', 'iv-value');
    localStorage.setItem('catint_lang_pair_v1', '{"left":"en","right":"es"}');

    jest.resetModules();
    jest.doMock('../services/settingsService', () => ({
      CLOUD_SYNC_KEYS: ['catint_lang_pair_v1', 'DEEPGRAM_API_KEY', 'dg_iv'],
      collectLocalSettings: () => ({
        catint_lang_pair_v1: '{"left":"en","right":"es"}',
        DEEPGRAM_API_KEY: 'dg-live-secret-value',
        dg_iv: 'iv-value',
      }),
      applySettingsToLocal: () => 0,
    }));
    // eslint-disable-next-line global-require
    const poisoned = require('./appBackup');
    const backup = await poisoned.buildAppBackup({ scopes: ['settings'] });
    const json = JSON.stringify(backup);

    expect(backup.scopes.settings.local).toEqual({ catint_lang_pair_v1: '{"left":"en","right":"es"}' });
    expect(json).not.toContain('DEEPGRAM_API_KEY');
    expect(json).not.toContain('dg_iv');
    expect(json).not.toContain('dg-live-secret-value');
    expect(json).toMatch(/sensitive key\(s\) stripped/);
    expect(backup.warnings.join(' ')).not.toMatch(/DEEPGRAM|dg_iv/);

    jest.dontMock('../services/settingsService');
    jest.resetModules();
  });
});

describe('appBackup — bad input is rejected without writing', () => {
  const cases = [
    ['not json at all', 'plain text'],
    ['wrong format tag', JSON.stringify({ format: 'someone-elses-backup', version: 1, scopes: { goals: {} } })],
    ['future version', JSON.stringify({ format: 'catintassist-backup', version: 99, scopes: { goals: {} } })],
    ['no scopes', JSON.stringify({ format: 'catintassist-backup', version: 1, scopes: {} })],
    ['unrecognised scopes', JSON.stringify({ format: 'catintassist-backup', version: 1, scopes: { wat: {} } })],
  ];

  test.each(cases)('%s is rejected and writes nothing', async (_label, input) => {
    seedApp();
    const before = snapshot();

    expect(validateAppBackup(input).ok).toBe(false);
    const report = await restoreAppBackup(input);
    expect(report.ok).toBe(false);
    expect(typeof report.error).toBe('string');

    expect(snapshot()).toBe(before);
  });

  test('a missing version or a non-object is rejected', () => {
    expect(validateAppBackup({ format: 'catintassist-backup', scopes: { goals: {} } }).ok).toBe(false);
    expect(validateAppBackup(42).ok).toBe(false);
    expect(validateAppBackup(null).ok).toBe(false);
  });

  test('buildAppBackup refuses an empty scope list', async () => {
    await expect(buildAppBackup({ scopes: [] })).rejects.toThrow(/scope/i);
  });

  test('restoring a subset of the file only touches those scopes', async () => {
    seedApp();
    const backup = await buildAppBackup({ scopes: ['goals', 'progress'] });
    const before = readStats();
    localStorage.setItem(STATS, JSON.stringify({ ...before, goalMinutes: 1, monthlyMinutes: 1 }));

    const report = await restoreAppBackup(backup, { scopes: ['goals'] });
    expect(report.scopes).toEqual(['goals']);
    expect(report.applied.progress).toBeUndefined();
    expect(readStats().goalMinutes).toBe(9231);
    expect(readStats().monthlyMinutes).toBe(1);
  });
});

describe('appBackup — summary + filename', () => {
  test('summary reports per-scope counts and total bytes', async () => {
    seedApp();
    const backup = await buildAppBackup({ scopes: ['goals', 'progress'] });
    const summary = appBackupSummary(backup);
    const byId = Object.fromEntries(summary.entries.map((e) => [e.id, e]));
    expect(byId.goals.count).toBe(6);   // 5 goal fields + workdays basis
    expect(byId.progress.count).toBe(9); // 7 stats + 2 maps
    expect(summary.totalBytes).toBeGreaterThan(100);
    expect(summary.entries.length).toBe(2);
  });

  test('filename is dated; subsets name their scopes so same-day files never collide', () => {
    const day = new Date(2026, 8, 20);
    const all = ['goals', 'progress', 'greetings', 'settings', 'corrections'];
    expect(backupFileName(undefined, day)).toBe('catintassist-backup-2026-09-20.json');
    expect(backupFileName(all, day)).toBe('catintassist-backup-2026-09-20.json');
    expect(backupFileName(['goals'], day)).toBe('catintassist-backup-goals-2026-09-20.json');
    // the Goal Tracking shortcut writes this one — must not overwrite the full file
    expect(backupFileName(['goals', 'progress'], day)).toBe('catintassist-backup-goals-progress-2026-09-20.json');
  });
});
