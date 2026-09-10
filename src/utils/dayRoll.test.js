import { rollDaySnapshot } from './dayRoll';

const YESTERDAY = 'Tue Sep 08 2026';
const TODAY = 'Wed Sep 09 2026';

describe('dayRoll rollDaySnapshot (v4.99.0 live midnight rollover)', () => {
  test('archives minutes + timeline and zeroes the daily counters', () => {
    const out = rollDaySnapshot({
      stats: { lastDate: YESTERDAY, dailyMinutes: 240.6, dailyBreakMinutes: 30, dailyAvailMinutes: 90, callsToday: 7, dayStartTime: 1, streak: 3, monthlyMinutes: 500 },
      dailyLog: { 'Mon Sep 07 2026': 100 },
      historyTimeline: {},
      timeline: [{ type: 'work', start: 1, end: 2 }],
      todayStr: TODAY,
    });
    expect(out.dailyLog).toEqual({ 'Mon Sep 07 2026': 100, [YESTERDAY]: 241 });
    expect(out.historyTimeline[YESTERDAY]).toEqual([{ type: 'work', start: 1, end: 2 }]);
    expect(out.stats).toMatchObject({
      dailyMinutes: 0,
      dailyBreakMinutes: 0,
      dailyAvailMinutes: 0,
      callsToday: 0,
      dayStartTime: null,
      lastDate: TODAY,
      // month-scale fields survive untouched
      monthlyMinutes: 500,
      streak: 3,
    });
    expect(out.archived).toEqual({ date: YESTERDAY, minutes: 241, segments: 1 });
  });

  test('returns null when the day has not changed', () => {
    expect(rollDaySnapshot({ stats: { lastDate: TODAY }, dailyLog: {}, historyTimeline: {}, timeline: [], todayStr: TODAY })).toBeNull();
    expect(rollDaySnapshot({ stats: {}, dailyLog: {}, historyTimeline: {}, timeline: [], todayStr: TODAY })).toBeNull();
  });

  test('empty day still rolls lastDate forward (no junk archive)', () => {
    const out = rollDaySnapshot({
      stats: { lastDate: YESTERDAY, dailyMinutes: 0, callsToday: 0 },
      dailyLog: {},
      historyTimeline: { 'Mon Sep 07 2026': [] },
      timeline: [],
      todayStr: TODAY,
    });
    expect(out.dailyLog).toEqual({});
    expect(out.historyTimeline['Mon Sep 07 2026']).toEqual([]);
    expect(out.historyTimeline[YESTERDAY]).toBeUndefined();
    expect(out.stats.lastDate).toBe(TODAY);
  });
});
