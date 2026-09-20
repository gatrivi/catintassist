import {
  toIsoDay, firstOfMonthIso, goalSetLabel,
  deriveBankTargetMinutes, perWorkdayFromTarget, buildGoalAnchor,
  savedGoalAnchor, anchorForCatchUp, rollGoalForNewMonth, isGoalWorkDays,
  savedGoalWorkDays, perWorkdayFromStats, weeklyHoursFromCommitment,
} from './goalAnchor';

// Sep 2026 = 30 days. 40h/wk @ 5d/wk = 480m/workday, 22d/mo basis.
const MID = new Date('2026-09-20T12:00:00'); // day 20 → 11 days left → 8 workdays
const SEP1 = new Date('2026-09-01T09:00:00');
const PER_WORKDAY = 480;

describe('goalAnchor (banked goals count from the moment they are banked)', () => {
  it('derives the bank target forward: worked + commitment × workdays left', () => {
    expect(deriveBankTargetMinutes({ bankedMinutes: 0, perWorkdayMinutes: PER_WORKDAY, workDays: 22, now: MID })).toBe(3840);
    expect(deriveBankTargetMinutes({ bankedMinutes: 6000, perWorkdayMinutes: PER_WORKDAY, workDays: 22, now: MID })).toBe(9840);
  });

  it('banking on the 1st with nothing worked still gives the full-month quota', () => {
    expect(deriveBankTargetMinutes({ bankedMinutes: 0, perWorkdayMinutes: PER_WORKDAY, workDays: 22, now: SEP1 })).toBe(10560);
  });

  it('late month: 2 workdays left → target is 2 days of commitment', () => {
    const late = new Date('2026-09-28T12:00:00');
    expect(deriveBankTargetMinutes({ bankedMinutes: 0, perWorkdayMinutes: PER_WORKDAY, workDays: 22, now: late })).toBe(960);
    const last = new Date('2026-09-30T12:00:00');
    expect(deriveBankTargetMinutes({ bankedMinutes: 0, perWorkdayMinutes: PER_WORKDAY, workDays: 22, now: last })).toBe(480);
  });

  it('custom target → implied per-workday commitment for the days left', () => {
    expect(perWorkdayFromTarget({ targetMinutes: 9840, bankedMinutes: 6000, workDays: 22, now: MID })).toBe(480);
  });

  it('buildGoalAnchor clamps the base to the target (monotonic expected line)', () => {
    expect(buildGoalAnchor({ targetMinutes: 9840, bankedMinutes: 6000, perWorkdayMinutes: 480, workDays: 22, now: MID }))
      .toEqual({ goalSetAt: '2026-09-20', goalBaseMinutes: 6000, goalPerWorkdayMinutes: 480, goalWorkDays: 22 });
    expect(buildGoalAnchor({ targetMinutes: 5000, bankedMinutes: 6000, perWorkdayMinutes: 480, workDays: 22, now: MID }).goalBaseMinutes)
      .toBe(5000);
  });

  it('savedGoalAnchor: only present when the stats actually carry one', () => {
    expect(savedGoalAnchor({ goalMinutes: 9840, goalSetAt: '2026-09-20', goalBaseMinutes: 6000 }))
      .toEqual({ goalSetAt: '2026-09-20', goalBaseMinutes: 6000 });
    expect(savedGoalAnchor({ goalMinutes: 9231 })).toBeNull();     // legacy saved stats
    expect(savedGoalAnchor({ goalSetAt: '2026-09-20' })).toBeNull(); // no base recorded
    expect(savedGoalAnchor()).toBeNull();
  });

  it('anchorForCatchUp: saved target keeps the saved anchor, candidate gets "banked now"', () => {
    const saved = { savedGoalMinutes: 9840, savedGoalSetAt: '2026-09-20', savedGoalBaseMinutes: 6000 };
    const later = new Date('2026-09-25T12:00:00'); // re-opening the dial 5 days later
    // untouched dial → same number as the saved goal → same anchor as the dashboard
    expect(anchorForCatchUp({ targetMinutes: 9840, bankedMinutes: 6000, ...saved, now: later }))
      .toEqual({ goalSetAt: '2026-09-20', goalBaseMinutes: 6000 });
    // dial moved → unsaved candidate → anchored at what is banked right now
    expect(anchorForCatchUp({ targetMinutes: 10668, bankedMinutes: 6000, ...saved, now: later }))
      .toEqual({ goalSetAt: '2026-09-25', goalBaseMinutes: 6000 });
  });

  it('anchorForCatchUp: legacy saved goal (no anchor) stays on legacy pace', () => {
    expect(anchorForCatchUp({ targetMinutes: 9231, bankedMinutes: 1192, savedGoalMinutes: 9231, now: MID })).toBeNull();
  });

  it('anchorForCatchUp: candidate target is anchored at the banked base', () => {
    expect(anchorForCatchUp({ targetMinutes: 3840, bankedMinutes: 0, savedGoalMinutes: 9231, now: MID }))
      .toEqual({ goalSetAt: '2026-09-20', goalBaseMinutes: 0 });
    expect(anchorForCatchUp({ targetMinutes: 3840, bankedMinutes: 9999, savedGoalMinutes: 0, now: MID }))
      .toEqual({ goalSetAt: '2026-09-20', goalBaseMinutes: 3840 }); // clamped
    expect(anchorForCatchUp({ targetMinutes: 0, bankedMinutes: 0, now: MID })).toBeNull();
  });

  it('month rollover: fresh month → full-month quota, base 0, set on the 1st', () => {
    const rolled = rollGoalForNewMonth({ goalMinutes: 9840, goalBaseMinutes: 6000, goalPerWorkdayMinutes: 480 }, 22, new Date('2026-10-01T00:30:00'));
    expect(rolled).toEqual({ goalMinutes: 10560, goalSetAt: '2026-10-01', goalBaseMinutes: 0 });
  });

  it('month rollover: legacy stats without a commitment keep their target, no anchor', () => {
    expect(rollGoalForNewMonth({ goalMinutes: 9231, goalBaseMinutes: 0 }, 28, new Date('2026-10-01T00:30:00')))
      .toEqual({ goalSetAt: null, goalBaseMinutes: 0 });
    expect(rollGoalForNewMonth({ goalPerWorkdayMinutes: 480 }, 0, new Date('2026-10-01T00:30:00')))
      .toEqual({ goalSetAt: null, goalBaseMinutes: 0 });
  });

  it('helpers: ISO days are local, labels are short, workdays validated', () => {
    expect(toIsoDay(MID)).toBe('2026-09-20');
    expect(firstOfMonthIso(MID)).toBe('2026-09-01');
    expect(goalSetLabel('2026-09-20')).toBe('Sep 20');
    expect(goalSetLabel(null)).toBe('');
    expect(goalSetLabel('2026-08-20')).toBe(''); // other month → not shown
    expect(isGoalWorkDays(22)).toBe(true);
    expect(isGoalWorkDays(21)).toBe(false);
  });

  // FOLLOW-UP DEFECT: the month total is prorated mid-month, so dividing it by
  // workdays understates the commitment (35h/Wk banked on the 20th came back as
  // 3360 ÷ 22d = 152m/d = 14.5h/Wk).
  describe('commitment helpers (never divide the prorated month total)', () => {
    it('perWorkdayFromStats prefers the STORED commitment', () => {
      const banked = { goalMinutes: deriveBankTargetMinutes({ bankedMinutes: 0, perWorkdayMinutes: 420, workDays: 22, now: MID }), goalPerWorkdayMinutes: 420, goalWorkDays: 22 };
      expect(banked.goalMinutes).toBe(3360); // prorated mid-month total
      expect(perWorkdayFromStats(banked, { workDays: 22 })).toBe(420); // NOT 153
      // custom month total → the implied per-workday value stored on bank
      expect(perWorkdayFromStats({ goalMinutes: 9200, goalPerWorkdayMinutes: 1150 }, { workDays: 22 })).toBe(1150);
    });

    it('legacy stats (no commitment recorded) keep month ÷ workdays', () => {
      expect(perWorkdayFromStats({ goalMinutes: 9231 }, { workDays: 22 })).toBe(420);
      expect(perWorkdayFromStats({ goalMinutes: 9231 }, { workDays: 28 })).toBe(330);
      expect(perWorkdayFromStats({ goalMinutes: 9231 }, {})).toBe(420); // no basis → 22d
      expect(perWorkdayFromStats({ goalMinutes: 0, goalPerWorkdayMinutes: 0 }, { workDays: 22 })).toBe(0);
      expect(perWorkdayFromStats()).toBe(0);
    });

    it('weeklyHoursFromCommitment: 420m/d @5d/wk = 35h/wk (not 14.5h/wk)', () => {
      expect(weeklyHoursFromCommitment(420, 5)).toBeCloseTo(35, 6);
      expect(weeklyHoursFromCommitment(330, 6.5)).toBeCloseTo(35.75, 6);
      expect(weeklyHoursFromCommitment(0, 5)).toBe(0);
    });

    it('savedGoalWorkDays: recorded basis wins, else the caller basis, else 0', () => {
      expect(savedGoalWorkDays({ goalWorkDays: 22 }, 28)).toBe(22);
      expect(savedGoalWorkDays({ goalWorkDays: 21 }, 28)).toBe(28); // invalid → caller basis
      expect(savedGoalWorkDays({}, 30)).toBe(30);
      expect(savedGoalWorkDays({}, 0)).toBe(0);
      expect(savedGoalWorkDays()).toBe(0);
    });
  });
});
