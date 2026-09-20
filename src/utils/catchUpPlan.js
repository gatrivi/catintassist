/**
 * v4.96.0: Single source of truth for "am I behind, and what do I do today?"
 *
 * Behind = behind MONTH pace: expected-by-today = goalMinutes / daysInMonth × day
 * (same math DashboardHeader used for its old DEFICIT line) — UNLESS the goal
 * carries an anchor (see goalSetAt/goalBaseMinutes below), in which case the
 * pace clock starts the day the goal was banked.
 * Catch-up is spread evenly over the remaining days (today included).
 */

export const fmtHm = (m) => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}m`;

/**
 * The month's calendar/workday basis. ONE place for this rounding, so the
 * derived bank target (goalAnchor.js) and `requiredToday` can never disagree.
 * workDays = 0 → legacy calendar-day basis.
 */
export const monthBasis = ({ workDays = 0, now = new Date() } = {}) => {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = Math.max(1, daysInMonth - currentDay + 1);
  const remainingWorkdays = workDays > 0
    ? Math.max(1, Math.round((remainingDays * workDays) / daysInMonth))
    : remainingDays;
  return { daysInMonth, currentDay, remainingDays, remainingWorkdays };
};

/** Day-of-month of an anchor date ('YYYY-MM-DD' or Date), or null when it is
 *  missing / unparseable / from another month (a stale anchor is ignored). */
export const goalSetDayOfMonth = (goalSetAt, now = new Date()) => {
  if (!goalSetAt) return null;
  let d = goalSetAt instanceof Date ? goalSetAt : new Date(`${goalSetAt}T00:00:00`);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return null;
  return d.getDate();
};

/**
 * ANCHORED-GOAL: expected-by-today, anchored when the goal has a set date.
 *
 * Legacy (no anchor): goal expected since day 1 → goal × day / daysInMonth.
 * Anchored: the goal only started counting when it was banked, from a base of
 * minutes already worked →
 *   expected = base + (goal − base) × (days since set / days set→month end)
 * so on the day you bank it the deficit is 0, and it grows one day's worth per
 * day after that (landing exactly on goalMinutes on the last day of the month).
 */
export const expectedByTodayFor = ({
  goalMinutes = 5500,
  goalBaseMinutes = 0,
  goalSetAt = null,
  now = new Date(),
  daysInMonth,
  currentDay,
} = {}) => {
  const dInMo = daysInMonth ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = currentDay ?? now.getDate();
  const setDay = goalSetDayOfMonth(goalSetAt, now);
  if (!setDay) return Math.round((goalMinutes / dInMo) * day); // legacy: goal in force since the 1st
  const base = Math.max(0, Math.min(Number(goalBaseMinutes) || 0, goalMinutes));
  const span = Math.max(1, dInMo - setDay); // set day → month end (0 when set on the last day)
  const elapsed = Math.max(0, Math.min(day - setDay, span));
  return Math.round(base + (goalMinutes - base) * (elapsed / span));
};

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
  // ANCHORED-GOAL: goal anchor — optional, absent = legacy full-month pace.
  goalSetAt = null, // 'YYYY-MM-DD' the goal was banked
  goalBaseMinutes = 0, // minutes already worked when it was banked
}) => {
  const { daysInMonth, currentDay, remainingDays, remainingWorkdays } = monthBasis({ workDays, now });

  const expectedByToday = expectedByTodayFor({
    goalMinutes, goalBaseMinutes, goalSetAt, now, daysInMonth, currentDay,
  });
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
