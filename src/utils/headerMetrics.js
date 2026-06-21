/** Compact header strip metrics — shared between collapsed + expanded off-call chrome. */

export const buildHeaderStripMetrics = ({
  stats,
  totalDailyMins,
  dailyGoal,
  monthlyProgressRatio,
  monthlyPendingRatio,
  isMonthlyGoalMet,
  isInDeficit,
  currentIdx,
  milestoneLabels,
  liveDailyArs,
}) => {
  const monthPct = ((stats.monthlyMinutes / (stats.goalMinutes || 1)) * 100).toFixed(1);
  const stepFill = (stats.monthlyMinutes % 1375) / 1375;
  const stepColor = stats.monthlyMinutes >= 11000 ? '#fcd34d' : (stats.monthlyMinutes >= 5500 ? '#a855f7' : '#3b82f6');
  const dailyFill = Math.min(1, totalDailyMins / 480);
  const dailyColor = stats.dailyMinutes >= 480 ? '#fcd34d' : (stats.dailyMinutes >= 350 ? '#c084fc' : '#60a5fa');
  const monthlyColor = isMonthlyGoalMet ? '#10b981' : (isInDeficit ? '#f59e0b' : '#a855f7');

  return {
    totalDailyMins,
    dailyGoal,
    monthPct,
    liveDailyArs,
    monthlyFill: monthlyProgressRatio,
    monthlyPending: monthlyPendingRatio,
    monthlyColor,
    monthlyTooltip: `Banked: ${Math.round(stats.monthlyMinutes)}m / ${Math.round(stats.goalMinutes)}m (${monthPct}%)`,
    stepFill,
    stepColor,
    stepTooltip: `Step ${currentIdx + 1}/12 · ${Math.round(stats.monthlyMinutes % 1375)}m / 1375m · ${milestoneLabels[currentIdx]}`,
    dailyFill,
    dailyColor,
    dailyTooltip: `Today: ${Math.round(totalDailyMins)}m banked · min ${Math.round(dailyGoal)}m · 480m focus`,
  };
};
