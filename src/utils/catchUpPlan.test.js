import {
  computeCatchUp, formatCatchUpLine, formatCatchUpVerdict, fmtHm,
  monthBasis, expectedByTodayFor, goalSetDayOfMonth,
} from './catchUpPlan';

// Fixed "now" so the math is deterministic in tests
const NOON = new Date('2026-09-10T12:00:00'); // day 10 of 30, 6h to 18:00, 11h to 23:00

describe('catchUpPlan', () => {
  it('computes month-pace deficit (positive = behind)', () => {
    // goal 3000m / 30d = 100m/day → expected by day 10 = 1000
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 628, dailyMinutes: 60, now: NOON });
    expect(p.expectedByToday).toBe(1000);
    expect(p.deficitMins).toBe(372);
    expect(p.remainingDays).toBe(21);
  });

  it('spreads catch-up over remaining days incl. today, then flattens after', () => {
    // remaining = 3000-628 = 2372 over 21 days → 113 today, then 2259/20 ≈ 113
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 628, dailyMinutes: 60, now: NOON });
    expect(p.requiredToday).toBe(113);
    expect(p.needToday).toBe(53);
    expect(p.thenPerDay).toBe(113);
    expect(p.daysAfter).toBe(20);
  });

  it('verdict: fits by 18:00 when need fits before 18h', () => {
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 628, dailyMinutes: 60, now: NOON });
    expect(p.verdict).toBe('fits-by-18');
    expect(formatCatchUpVerdict(p)).toBe('✅ fits by 18:00');
  });

  it('verdict: needs OT when past 18:00 cutoff but before 23:00', () => {
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 628, dailyMinutes: 60, now: new Date('2026-09-10T18:30:00') });
    expect(p.verdict).toBe('needs-ot');
  });

  it('verdict: impossible when need exceeds even 23:00', () => {
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 0, dailyMinutes: 0, now: new Date('2026-09-10T22:30:00') });
    // need ≈ 150m but only 30m to 23:00
    expect(p.verdict).toBe('impossible');
    expect(formatCatchUpVerdict(p)).toBe("🔴 won't fit today");
  });

  it('verdict: on-track when month pace met or ahead', () => {
    const done = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 1100, dailyMinutes: 100, now: NOON });
    expect(done.deficitMins).toBe(-100);
    expect(done.needToday).toBe(0);
    expect(done.verdict).toBe('on-track');
    expect(formatCatchUpLine(done)).toBe('📈 AHEAD 1h40m');
  });

  it('formats a behind line with deficit, today target and per-day split', () => {
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 628, dailyMinutes: 60, now: NOON });
    const line = formatCatchUpLine(p);
    expect(line).toContain('📉 BEHIND 6h12m');
    expect(line).toContain('today → 0h53m');
    expect(line).toContain('then 1h53m/day × 20d');
    expect(line).toContain('off ≈ 12:53');
  });

  it('near-pace (±30m) reads as ON PACE, no noise', () => {
    const near = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 990, dailyMinutes: 60, now: NOON });
    expect(near.deficitMins).toBe(10);
    expect(formatCatchUpLine(near)).toBe('✅ ON PACE');
  });

  it('first of month: only day-1 quota expected (100m), 30d left', () => {
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 0, dailyMinutes: 0, now: new Date('2026-09-01T09:00:00') });
    expect(p.deficitMins).toBe(100); // month-pace convention: day N expects N × daily quota
    expect(p.remainingDays).toBe(30);
  });

  it('last day of month: daysAfter = 0, thenPerDay = leftover only', () => {
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 2900, dailyMinutes: 0, now: new Date('2026-09-30T10:00:00') });
    expect(p.remainingDays).toBe(1);
    expect(p.daysAfter).toBe(0);
    expect(p.requiredToday).toBe(100);
    expect(p.thenPerDay).toBe(0);
  });

  it('fmtHm renders hours+padded minutes', () => {
    expect(fmtHm(372)).toBe('6h12m');
    expect(fmtHm(60)).toBe('1h00m');
  });

  // v4.101.0: workday basis — catch-up spreads over remaining WORKDAYS
  it('workDays basis: spread over remaining workdays, not calendar days', () => {
    // Sep 10 → 21 calendar days left; 28d/mo basis → round(21*28/30)=20 workdays
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 628, dailyMinutes: 60, workDays: 28, now: NOON });
    expect(p.remainingWorkdays).toBe(20);
    expect(p.requiredToday).toBe(Math.round(2372 / 20)); // 119 not 113
    expect(p.daysAfter).toBe(19);
  });

  it('workDays basis: no workDays → legacy calendar behavior unchanged', () => {
    const p = computeCatchUp({ goalMinutes: 3000, monthlyMinutes: 628, dailyMinutes: 60, workDays: 0, now: NOON });
    expect(p.remainingWorkdays).toBe(p.remainingDays);
    expect(p.requiredToday).toBe(113);
  });

  it('workDays basis: user scenario — small real deficit, not a 77h scare', () => {
    // 9231m goal ($1200 @ $0.13), day 11 of Sep, 1192m banked, 6.5/Wk (28d)
    const p = computeCatchUp({ goalMinutes: 9231, monthlyMinutes: 1192, dailyMinutes: 0, workDays: 28, now: new Date('2026-09-11T12:00:00') });
    // deficit vs even spread ≈ 9231*11/30 − 1192 ≈ 2193m; remaining 8039m over
    // round(20*28/30)=19 workdays → 423m/workday (honest number, not a scare).
    expect(p.deficitMins).toBeGreaterThan(0);
    expect(p.requiredToday).toBe(423);
    expect(p.remainingWorkdays).toBe(19);
  });

  // ── ANCHORED-GOAL: a goal banked MID-MONTH counts from the day it is banked ──
  // Sep 2026 = 30 days. 40h/wk @ 5d/wk = 480m/workday; 22d/mo basis.
  const PER_WORKDAY = 480;         // 40h/wk ÷ 5
  const MID = new Date('2026-09-20T12:00:00');
  const MID_ISO = '2026-09-20';

  describe('goal anchor (mid-month banking)', () => {
    it('monthBasis matches the legacy spread (22d basis, day 20 of 30)', () => {
      const b = monthBasis({ workDays: 22, now: MID });
      expect(b).toEqual({ daysInMonth: 30, currentDay: 20, remainingDays: 11, remainingWorkdays: 8 });
    });

    it('anchor detection: missing / malformed / other-month dates are ignored', () => {
      expect(goalSetDayOfMonth(null, MID)).toBeNull();
      expect(goalSetDayOfMonth('nope', MID)).toBeNull();
      expect(goalSetDayOfMonth('2026-08-20', MID)).toBeNull(); // stale month → legacy
      expect(goalSetDayOfMonth(MID_ISO, MID)).toBe(20);
    });

    it('legacy path is untouched: no anchor → goal × day / daysInMonth', () => {
      expect(expectedByTodayFor({ goalMinutes: 10560, now: MID })).toBe(7040);
      expect(expectedByTodayFor({ goalMinutes: 10560, goalBaseMinutes: 0, goalSetAt: null, now: MID })).toBe(7040);
    });

    it('deficit grows one calendar day of the commitment at a time after banking', () => {
      // 9840 banked on the 20th from a 6000m base: 3840m over the 10 days to month end
      const at = (day) => computeCatchUp({
        goalMinutes: 9840, monthlyMinutes: 6000, dailyMinutes: 0, workDays: 22,
        goalSetAt: MID_ISO, goalBaseMinutes: 6000,
        now: new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00`),
      });
      expect(at(20).deficitMins).toBe(0);      // the day you bank: exactly on pace
      expect(at(24).deficitMins).toBe(1536);   // 4 days later, nothing worked since
      expect(at(30).deficitMins).toBe(3840);   // last day: the whole remainder is due
    });

    it('Sep 20, 22d basis, 0 banked → on pace, 480m today (not 22h / impossible)', () => {
      // target derived forward by the dial: 0 worked + 480 × 8 workdays left
      const p = computeCatchUp({
        goalMinutes: 3840, monthlyMinutes: 0, dailyMinutes: 0, workDays: 22,
        goalSetAt: MID_ISO, goalBaseMinutes: 0, now: MID,
      });
      expect(p.expectedByToday).toBe(0);
      expect(p.deficitMins).toBe(0);
      expect(p.requiredToday).toBe(480);
      expect(p.needToday).toBe(480);
      expect(p.remainingWorkdays).toBe(8);
      expect(p.verdict).toBe('needs-ot'); // 8h committed at noon → OT, never "impossible"
    });

    it('Sep 20, 22d basis, 6000 banked from a 6000 base → ~0 deficit', () => {
      const p = computeCatchUp({
        goalMinutes: 9840, monthlyMinutes: 6000, dailyMinutes: 0, workDays: 22,
        goalSetAt: MID_ISO, goalBaseMinutes: 6000, now: MID,
      });
      expect(p.expectedByToday).toBe(6000);
      expect(p.deficitMins).toBe(0);
      expect(p.requiredToday).toBe(480);
      expect(formatCatchUpLine(p)).toBe('✅ ON PACE');
    });

    it('same 6000 banked WITHOUT an anchor still reads the old 117h scare', () => {
      // guard: the fix must not silently change legacy saved data
      const p = computeCatchUp({ goalMinutes: 10560, monthlyMinutes: 6000, dailyMinutes: 0, workDays: 22, now: MID });
      expect(p.deficitMins).toBe(1040);
      expect(p.requiredToday).toBe(570);
    });

    it('Sep 1, 22d basis, 0 banked → full-month quota 10560m @ 480m/day', () => {
      const p = computeCatchUp({
        goalMinutes: 10560, monthlyMinutes: 0, dailyMinutes: 0, workDays: 22,
        goalSetAt: '2026-09-01', goalBaseMinutes: 0,
        now: new Date('2026-09-01T09:00:00'),
      });
      expect(p.remainingWorkdays).toBe(22);
      expect(p.requiredToday).toBe(480);
      expect(p.expectedByToday).toBe(0);
      expect(p.deficitMins).toBe(0);
    });

    it('Sep 28 (2 workdays left): 480m today, not 88h', () => {
      const p = computeCatchUp({
        goalMinutes: 960, monthlyMinutes: 0, dailyMinutes: 0, workDays: 22,
        goalSetAt: '2026-09-28', goalBaseMinutes: 0,
        now: new Date('2026-09-28T12:00:00'),
      });
      expect(p.remainingWorkdays).toBe(2);
      expect(p.requiredToday).toBe(480);
      expect(p.deficitMins).toBe(0);
      const legacy = computeCatchUp({ goalMinutes: 10560, monthlyMinutes: 0, dailyMinutes: 0, workDays: 22, now: new Date('2026-09-28T12:00:00') });
      expect(legacy.deficitMins).toBe(9856); // what the user was being shown before
      expect(legacy.verdict).toBe('impossible');
    });

    it('Sep 30 (last day): the whole remainder is due, exactly at month end', () => {
      const p = computeCatchUp({
        goalMinutes: 9840, monthlyMinutes: 6000, dailyMinutes: 0, workDays: 22,
        goalSetAt: MID_ISO, goalBaseMinutes: 6000,
        now: new Date('2026-09-30T12:00:00'),
      });
      expect(p.remainingWorkdays).toBe(1);
      expect(p.deficitMins).toBe(3840);
      expect(p.requiredToday).toBe(3840);
    });

    it('a stale anchor from a previous month falls back to legacy pace', () => {
      const anchored = computeCatchUp({
        goalMinutes: 10560, monthlyMinutes: 1000, dailyMinutes: 0, workDays: 22,
        goalSetAt: '2026-08-20', goalBaseMinutes: 0, now: MID,
      });
      const legacy = computeCatchUp({ goalMinutes: 10560, monthlyMinutes: 1000, dailyMinutes: 0, workDays: 22, now: MID });
      expect(anchored.expectedByToday).toBe(legacy.expectedByToday);
    });

    it('a goal banked ahead of the base keeps a monotonic expected line', () => {
      // base clamped to the target: custom goal below what is already worked
      const p = computeCatchUp({
        goalMinutes: 5000, monthlyMinutes: 6000, dailyMinutes: 0, workDays: 22,
        goalSetAt: MID_ISO, goalBaseMinutes: 6000, now: MID,
      });
      expect(p.expectedByToday).toBe(5000); // clamped, never below the target
      expect(p.deficitMins).toBe(-1000);
      expect(p.requiredToday).toBe(0);      // nothing left to do
    });
  });
});
