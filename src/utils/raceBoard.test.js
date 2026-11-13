import {
  workedDaysThisMonth, avgPerWorkedDay, impossibleTodayLimit, paceTone, buildRaceModel, formatGap, formatGapHours, fmtHoursClean, hhmm,
} from './raceBoard';

const NOW = new Date(2026, 10, 11, 13, 25); // Wed Nov 11 2026, 13:25

describe('workedDaysThisMonth', () => {
  test('counts this month worked days + today, skips tiny days and other months', () => {
    const log = {
      [new Date(2026, 10, 2).toDateString()]: 193,
      [new Date(2026, 10, 3).toDateString()]: 221,
      [new Date(2026, 10, 7).toDateString()]: 5, // test call, not a day
      [new Date(2026, 9, 30).toDateString()]: 400, // October
      [NOW.toDateString()]: 999, // today comes from todayMinutes, not the log
    };
    expect(workedDaysThisMonth(log, 100, NOW)).toBe(3);
    expect(workedDaysThisMonth(log, 0, NOW)).toBe(2);
  });
  test('bad input never throws', () => {
    expect(workedDaysThisMonth(null, 0, NOW)).toBe(0);
    expect(workedDaysThisMonth({ garbage: 'x' }, 0, NOW)).toBe(0);
  });
});

test('avg per worked day', () => {
  expect(avgPerWorkedDay(2411, 8)).toBe(301);
  expect(avgPerWorkedDay(500, 0)).toBe(0);
});

describe('impossibleTodayLimit', () => {
  test('712m at 13:25 is impossible (265m since 9:00)', () => {
    expect(impossibleTodayLimit(712, 0, NOW)).toBe(265);
  });
  test('plausible value → null', () => {
    expect(impossibleTodayLimit(200, 0, NOW)).toBeNull();
  });
  test('earlier same-day start widens the limit', () => {
    const start = new Date(2026, 10, 11, 7, 0).getTime();
    expect(impossibleTodayLimit(380, start, NOW)).toBeNull();
  });
  test('stale dayStartTime from another day is ignored', () => {
    const yesterday = new Date(2026, 10, 10, 6, 0).getTime();
    expect(impossibleTodayLimit(712, yesterday, NOW)).toBe(265);
  });
});

test('paceTone bands', () => {
  expect(paceTone(700, 629)).toBe('good');
  expect(paceTone(560, 629)).toBe('warn');
  expect(paceTone(301, 629)).toBe('bad');
  expect(paceTone(0, 0)).toBe('good');
});

describe('buildRaceModel', () => {
  const plan = { expectedByToday: 4400, requiredToday: 845, needToday: 700, remainingWorkdays: 14, offEta: null };
  test('behind: gap positive, ghost ahead of you, red', () => {
    const m = buildRaceModel({ goalMinutes: 13200, monthMinutes: 1032, todayMinutes: 0, plan, workedDays: 7 });
    expect(m.gap).toBe(3368);
    expect(m.tone).toBe('bad');
    expect(m.ghostPct).toBeGreaterThan(m.youPct);
    expect(m.avg).toBe(147);
    expect(m.avgTone).toBe('bad');
  });
  test('no goal or no plan → null (board hides)', () => {
    expect(buildRaceModel({ goalMinutes: 0, plan })).toBeNull();
    expect(buildRaceModel({ goalMinutes: 100, plan: null })).toBeNull();
  });
  test('bar percentages clamp to 0–100', () => {
    const m = buildRaceModel({ goalMinutes: 100, monthMinutes: 500, plan: { ...plan, expectedByToday: 50 } });
    expect(m.youPct).toBe(100);
    expect(m.finished).toBe(true);
    expect(m.tone).toBe('good');
  });
});

test('formatGap', () => {
  expect(formatGap(3368)).toBe('−3,368m');
  expect(formatGap(-120)).toBe('+120m');
  expect(formatGap(10)).toBe('on pace');
});

test('fmtHoursClean and formatGapHours (v4.212.0)', () => {
  expect(fmtHoursClean(1080)).toBe('18h');
  expect(fmtHoursClean(255)).toBe('4h 15m');
  expect(fmtHoursClean(60)).toBe('1h');
  expect(fmtHoursClean(0)).toBe('0h');

  expect(formatGapHours(1080)).toBe('−18h');
  expect(formatGapHours(-150)).toBe('+2h 30m');
  expect(formatGapHours(20)).toBe('on pace');
});

test('hhmm', () => {
  expect(hhmm(new Date(2026, 0, 1, 7, 5))).toBe('07:05');
  expect(hhmm(null)).toBe('');
});
