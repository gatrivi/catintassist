import { computeCatchUp, formatCatchUpLine, formatCatchUpVerdict, fmtHm } from './catchUpPlan';

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
});
