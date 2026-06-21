import { buildHeaderStripMetrics } from './headerMetrics';

describe('buildHeaderStripMetrics', () => {
  it('computes colors and tooltips from session stats', () => {
    const result = buildHeaderStripMetrics({
      stats: { monthlyMinutes: 2000, goalMinutes: 4000, dailyMinutes: 100 },
      totalDailyMins: 120,
      dailyGoal: 90,
      monthlyProgressRatio: 0.5,
      monthlyPendingRatio: 0.55,
      isMonthlyGoalMet: false,
      isInDeficit: true,
      currentIdx: 1,
      milestoneLabels: ['Floor', 'Growth'],
      liveDailyArs: 5000,
    });

    expect(result.monthPct).toBe('50.0');
    expect(result.monthlyColor).toBe('#f59e0b');
    expect(result.monthlyTooltip).toContain('2000m');
    expect(result.stepTooltip).toContain('Step 2/12');
    expect(result.dailyTooltip).toContain('120m');
  });
});
