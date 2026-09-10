import {
  dateKeyToMs,
  pruneDateKeys,
  buildTimeTrackSnapshot,
  mergeCloudDays,
} from './timeTrackSync';

describe('timeTrackSync (v4.99.0 cloud mirror helpers)', () => {
  test('dateKeyToMs parses toDateString() keys, NaN on junk', () => {
    expect(dateKeyToMs('Mon Sep 09 2026')).toBe(Date.parse('Sep 09 2026 00:00:00'));
    expect(Number.isNaN(dateKeyToMs('not a date'))).toBe(true);
  });

  test('pruneDateKeys keeps the newest N days', () => {
    const obj = { 'Mon Sep 07 2026': 1, 'Tue Sep 08 2026': 2, 'Wed Sep 09 2026': 3 };
    const pruned = pruneDateKeys(obj, 2);
    expect(Object.keys(pruned)).toEqual(['Tue Sep 08 2026', 'Wed Sep 09 2026']);
  });

  test('pruneDateKeys no-ops under the cap', () => {
    const obj = { 'Mon Sep 07 2026': 1 };
    expect(pruneDateKeys(obj, 5)).toBe(obj);
  });

  test('snapshot unions dailyLog + historyTimeline and stamps today from stats', () => {
    const snap = buildTimeTrackSnapshot({
      dailyLog: { 'Tue Sep 08 2026': 120 },
      historyTimeline: {
        'Tue Sep 08 2026': [{ type: 'work', start: 1, end: 2 }],
        'Mon Sep 07 2026': [{ type: 'avail', start: 3, end: 4 }],
      },
      todayTimeline: [{ type: 'work', start: 9, end: null }],
      stats: { dailyMinutes: 12.4, dailyAvailMinutes: 30.6, dailyBreakMinutes: 5.5, callsToday: 2 },
      todayStr: 'Wed Sep 09 2026',
    });
    expect(snap['Tue Sep 08 2026']).toEqual({ minutes: 120, segments: [{ type: 'work', start: 1, end: 2 }] });
    expect(snap['Mon Sep 07 2026']).toEqual({ minutes: 0, segments: [{ type: 'avail', start: 3, end: 4 }] });
    expect(snap['Wed Sep 09 2026']).toEqual({
      minutes: 12,
      segments: [{ type: 'work', start: 9, end: null }],
      availMinutes: 31,
      breakMinutes: 6,
      calls: 2,
    });
  });

  test('merge fills only MISSING past days and never touches today', () => {
    const localLog = { 'Mon Sep 07 2026': 60, 'Tue Sep 08 2026': 999 };
    const localHistory = { 'Mon Sep 07 2026': [{ type: 'work', start: 1, end: 2 }] };
    const out = mergeCloudDays({
      dailyLog: localLog,
      historyTimeline: localHistory,
      cloudDays: {
        'Mon Sep 07 2026': { minutes: 1, segments: [] },           // exists locally → untouched
        'Tue Sep 08 2026': { minutes: 5, segments: [{ type: 'x' }] }, // log exists → log kept, history filled
        'Sun Sep 06 2026': { minutes: 45, segments: [{ type: 'y' }] }, // fully missing → imported
        'Wed Sep 09 2026': { minutes: 1, segments: [] },           // today → skipped
      },
      todayStr: 'Wed Sep 09 2026',
    });
    expect(out.dailyLog['Mon Sep 07 2026']).toBe(60);
    expect(out.dailyLog['Tue Sep 08 2026']).toBe(999);
    expect(out.dailyLog['Sun Sep 06 2026']).toBe(45);
    expect(out.dailyLog['Wed Sep 09 2026']).toBeUndefined();
    expect(out.historyTimeline['Tue Sep 08 2026']).toEqual([{ type: 'x' }]);
    expect(out.historyTimeline['Mon Sep 07 2026']).toEqual([{ type: 'work', start: 1, end: 2 }]);
    expect(out.imported).toBe(2);
  });

  test('merge with empty/sparse cloud imports nothing (anti-clobber)', () => {
    const out = mergeCloudDays({
      dailyLog: { 'Mon Sep 07 2026': 60 },
      historyTimeline: {},
      cloudDays: {},
      todayStr: 'Tue Sep 08 2026',
    });
    expect(out.imported).toBe(0);
    expect(out.dailyLog['Mon Sep 07 2026']).toBe(60);
  });
});
