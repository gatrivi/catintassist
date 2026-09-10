/**
 * v4.96.0: Single source of truth for "am I behind, and what do I do today?"
 *
 * Behind = behind MONTH pace: expected-by-today = goalMinutes / daysInMonth × day
 * (same math DashboardHeader used for its old DEFICIT line).
 * Catch-up is spread evenly over the remaining days (today included).
 */

export const fmtHm = (m) => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}m`;

export const computeCatchUp = ({
  goalMinutes = 5500,
  monthlyMinutes = 0, // includes today's dailyMinutes
  dailyMinutes = 0,
  now = new Date(),
}) => {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = Math.max(1, daysInMonth - currentDay + 1);

  const expectedByToday = Math.round((goalMinutes / daysInMonth) * currentDay);
  const deficitMins = Math.round(expectedByToday - monthlyMinutes); // + = behind

  const remainingGoal = Math.max(0, goalMinutes - monthlyMinutes);
  const requiredToday = Math.round(remainingGoal / remainingDays);
  const needToday = Math.max(0, requiredToday - dailyMinutes);

  // Per-day load for the days AFTER today, assuming today hits requiredToday
  const daysAfter = remainingDays - 1;
  const thenPerDay = daysAfter >= 1
    ? Math.round(Math.max(0, remainingGoal - requiredToday) / daysAfter)
    : Math.max(0, remainingGoal - requiredToday);

  // Verdict: can needToday still fit today at all?
  const minsUntil = (h) => {
    const t = new Date(now); t.setHours(h, 0, 0, 0);
    return Math.round((t - now) / 60000);
  };
  let verdict = 'on-track';
  if (needToday > 0) {
    if (needToday <= minsUntil(18)) verdict = 'fits-by-18';
    else if (needToday <= minsUntil(23)) verdict = 'needs-ot';
    else verdict = 'impossible';
  }

  // Estimated clock-off if you start needToday right now
  const offEta = needToday > 0
    ? new Date(now.getTime() + needToday * 60000)
    : null;

  return {
    expectedByToday,
    deficitMins,
    remainingDays,
    requiredToday,
    needToday,
    thenPerDay,
    daysAfter,
    verdict,
    offEta, // Date | null
  };
};

const VERDICT_LABEL = {
  'on-track': '✅ on pace',
  'fits-by-18': '✅ fits by 18:00',
  'needs-ot': '⚠️ needs OT to 23:00',
  impossible: "🔴 won't fit today",
};

/** One-liner for the expanded dashboard strip. */
export const formatCatchUpLine = (plan) => {
  if (!plan) return '';
  if (plan.deficitMins > 30) {
    return `📉 BEHIND ${fmtHm(plan.deficitMins)} · today → ${fmtHm(plan.needToday)}` +
      (plan.offEta ? ` (off ≈ ${String(plan.offEta.getHours()).padStart(2, '0')}:${String(plan.offEta.getMinutes()).padStart(2, '0')})` : '') +
      (plan.daysAfter >= 1 ? ` · then ${fmtHm(plan.thenPerDay)}/day × ${plan.daysAfter}d` : '');
  }
  if (plan.deficitMins < -30) return `📈 AHEAD ${fmtHm(-plan.deficitMins)}`;
  return '✅ ON PACE';
};

export const formatCatchUpVerdict = (plan) => (!plan ? '' : VERDICT_LABEL[plan.verdict] || '');
