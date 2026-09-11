/**
 * v4.96.0: Single source of truth for "am I behind, and what do I do today?"
 *
 * Behind = behind MONTH pace: expected-by-today = goalMinutes / daysInMonth × day
 * (same math DashboardHeader used for its old DEFICIT line).
 * Catch-up is spread evenly over the remaining days (today included).
 */

export const fmtHm = (m) => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}m`;

// v4.101.0: optional `workDays` (days you actually work per month, e.g. 28 for
// 6.5/Wk). When set, catch-up spreads over REMAINING WORKDAYS, not calendar
// days — so "need today" matches what a 6.5-day week really demands.
// expectedByToday stays an even calendar spread (identical to spreading
// workdays evenly), so the deficit line itself is basis-neutral.
export const computeCatchUp = ({
  goalMinutes = 5500,
  monthlyMinutes = 0, // includes today's dailyMinutes
  dailyMinutes = 0,
  workDays = 0, // 0 = legacy calendar-day basis
  now = new Date(),
}) => {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = Math.max(1, daysInMonth - currentDay + 1);
  const remainingWorkdays = workDays > 0
    ? Math.max(1, Math.round((remainingDays * workDays) / daysInMonth))
    : remainingDays;

  const expectedByToday = Math.round((goalMinutes / daysInMonth) * currentDay);
  const deficitMins = Math.round(expectedByToday - monthlyMinutes); // + = behind

  const remainingGoal = Math.max(0, goalMinutes - monthlyMinutes);
  const requiredToday = Math.round(remainingGoal / remainingWorkdays);
  const needToday = Math.max(0, requiredToday - dailyMinutes);

  // Per-workday load for the days AFTER today, assuming today hits requiredToday
  const daysAfter = remainingWorkdays - 1;
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
    remainingWorkdays, // v4.101.0
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
