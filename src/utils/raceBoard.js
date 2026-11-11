/**
 * Race board math (v4.210.0) — "am I behind, and by how much?" in one shape.
 *
 * Pure functions only (no React, no storage) so every number is unit-tested.
 * Month pace itself comes from computeCatchUp (catchUpPlan.js) — this file
 * never re-derives the goal math, it only shapes it for the board.
 */

/** A day counts as "worked" from this many minutes (filters 2-min test calls). */
export const WORKED_DAY_MIN = 15;

/** dailyLog keys are Date.toDateString() ("Wed Nov 11 2026"). */
const sameMonth = (d, now) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

/**
 * Days you actually worked this month (past log days + today if it counts).
 * MO AVG used to divide by CALENDAR days → weekends dragged it down.
 */
export const workedDaysThisMonth = (dailyLog = {}, todayMinutes = 0, now = new Date()) => {
  const todayStr = now.toDateString();
  let days = 0;
  Object.entries(dailyLog || {}).forEach(([ds, mins]) => {
    if (ds === todayStr) return;
    const d = new Date(ds);
    if (Number.isNaN(d.getTime()) || !sameMonth(d, now)) return;
    if ((Number(mins) || 0) >= WORKED_DAY_MIN) days += 1;
  });
  if ((Number(todayMinutes) || 0) >= WORKED_DAY_MIN) days += 1;
  return days;
};

/** Average minutes per WORKED day (0 when nothing worked yet). */
export const avgPerWorkedDay = (monthMinutes = 0, workedDays = 0) =>
  workedDays > 0 ? Math.round((Number(monthMinutes) || 0) / workedDays) : 0;

/**
 * Sanity check: today's minutes can't exceed the wall clock since the day
 * started (earliest of dayStartTime / 09:00). Returns the max possible, or
 * null when the value is plausible. 10 min slack for rounding/live calls.
 */
export const impossibleTodayLimit = (todayMinutes = 0, dayStartTime = 0, now = new Date()) => {
  const nine = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0).getTime();
  const sameDayStart = dayStartTime && new Date(dayStartTime).toDateString() === now.toDateString();
  const start = sameDayStart ? Math.min(Number(dayStartTime), nine) : nine;
  const limit = Math.max(0, Math.round((now.getTime() - start) / 60000));
  return (Number(todayMinutes) || 0) > limit + 10 ? limit : null;
};

/** Color band for "you vs need": green at/above, amber within 15 %, red below. */
export const paceTone = (have = 0, need = 0) => {
  if (!(need > 0) || have >= need) return 'good';
  return have >= need * 0.85 ? 'warn' : 'bad';
};

const pct = (v, goal) => (goal > 0 ? Math.max(0, Math.min(100, (v / goal) * 100)) : 0);

/**
 * Everything the race board paints. `plan` = computeCatchUp(...) result.
 * gap > 0 = behind the pace ghost, gap < 0 = ahead.
 */
export const buildRaceModel = ({ goalMinutes = 0, monthMinutes = 0, todayMinutes = 0, plan = null, workedDays = 0 }) => {
  const goal = Math.max(0, Math.round(Number(goalMinutes) || 0));
  const done = Math.max(0, Math.round(Number(monthMinutes) || 0));
  if (!goal || !plan) return null;
  const expected = Math.max(0, Math.min(goal, Math.round(plan.expectedByToday || 0)));
  const gap = expected - done;
  const avg = avgPerWorkedDay(done, workedDays);
  const needPerDay = Math.round(plan.requiredToday || 0);
  return {
    goal,
    done,
    expected,
    gap,
    youPct: pct(done, goal),
    ghostPct: pct(expected, goal),
    tone: gap > 30 ? 'bad' : gap < -30 ? 'good' : 'even',
    avg,
    workedDays,
    needPerDay,
    avgTone: paceTone(avg, needPerDay),
    today: Math.round(Number(todayMinutes) || 0),
    needToday: Math.round(plan.needToday || 0),
    daysLeft: plan.remainingWorkdays,
    offEta: plan.offEta || null,
    finished: done >= goal,
  };
};

/** "−3,368m" / "+120m" / "on pace" — the one huge number. */
export const formatGap = (gap) => {
  if (Math.abs(gap) <= 30) return 'on pace';
  const n = Math.abs(Math.round(gap)).toLocaleString('en-US');
  return gap > 0 ? `−${n}m` : `+${n}m`;
};

/** HH:MM from a Date, '' when none. */
export const hhmm = (d) => (d instanceof Date && !Number.isNaN(d.getTime())
  ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  : '');
