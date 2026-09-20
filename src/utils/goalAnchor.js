/**
 * ANCHORED-GOAL: a banked goal counts FROM THE MOMENT IT IS BANKED.
 *
 * The bug this fixes: the configurator turned the weekly commitment into a
 * FULL-MONTH quota and banked it as `stats.goalMinutes` with no record of when
 * it was set. Setting a goal on the 20th was therefore judged as if it had been
 * in force since the 1st → "117h behind", "work 22h today", verdict impossible.
 *
 * New rule (all pure functions here, so both the dial and the header agree):
 *   banked target = minutes already worked + per-workday commitment × workdays left
 *   pace anchor   = { set date, minutes worked at that moment }
 * `stats.goalMinutes` stays a MONTH TOTAL (HUD progress / ladder / chip read it).
 * Month rollover re-derives the full-month quota from the same commitment.
 *
 * FOLLOW-UP: because that month total is now prorated, it must never be
 * reverse-divided into a weekly/daily commitment. `perWorkdayFromStats` /
 * `weeklyHoursFromCommitment` below are the only way the UI reads "what did I
 * commit to per day / per week".
 */

import { monthBasis, goalSetDayOfMonth } from './catchUpPlan';

const VALID_WORKDAYS = [17, 22, 26, 28, 30];

export const isGoalWorkDays = (v) => VALID_WORKDAYS.includes(Number(v));

const pad = (n) => String(n).padStart(2, '0');

/** Local 'YYYY-MM-DD' (never toISOString: that shifts by timezone). */
export const toIsoDay = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const firstOfMonthIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;

/** Human label for an anchor date ('2026-09-20' → 'Sep 20'), '' when absent. */
export const goalSetLabel = (goalSetAt) => {
  const day = goalSetDayOfMonth(goalSetAt);
  if (!day) return '';
  const d = new Date(`${goalSetAt}T00:00:00`);
  return `${d.toLocaleString('en', { month: 'short' })} ${day}`;
};

/**
 * Minutes to bank so the month total counts from NOW:
 * what is already worked + the per-workday commitment for the workdays left.
 * On the 1st with nothing worked this is exactly the old full-month quota.
 */
export const deriveBankTargetMinutes = ({
  bankedMinutes = 0,
  perWorkdayMinutes = 0,
  workDays = 0,
  now = new Date(),
}) => {
  const { remainingWorkdays } = monthBasis({ workDays, now });
  return Math.round(Math.max(0, bankedMinutes) + Math.max(0, perWorkdayMinutes) * remainingWorkdays);
};

/**
 * COMMITMENT HELPERS — "how much per workday did the user commit to?"
 *
 * `stats.goalMinutes` is a MONTH TOTAL. For an anchored goal it already contains
 * what was worked BEFORE the goal was banked, so dividing it by the month's
 * workdays UNDERSTATES the commitment: banking 35h/Wk on the 20th stored
 * 3360m → 3360 ÷ 22d = 152m/day (and 14.5h/Wk) instead of the 420m/day
 * (35h/Wk) actually promised. Every surface that needs the commitment reads it
 * through these helpers instead of re-deriving it from the month total.
 */

/** Workdays basis recorded WITH the banked goal, else the caller's basis (0 = none). */
export const savedGoalWorkDays = (stats = {}, fallbackWorkDays = 0) => {
  const stored = Number(stats?.goalWorkDays);
  if (isGoalWorkDays(stored)) return stored;
  return isGoalWorkDays(fallbackWorkDays) ? Number(fallbackWorkDays) : 0;
};

/**
 * Per-workday COMMITMENT of the saved goal.
 * Anchored stats store it (`goalPerWorkdayMinutes`; also written for a custom
 * month total, as the per-workday value that total implies). Legacy stats have
 * none → month total ÷ workdays basis, the derivation used before the anchor
 * existed, so nothing that already shipped changes behaviour.
 */
export const perWorkdayFromStats = (stats = {}, { workDays = 0 } = {}) => {
  const committed = Math.round(Number(stats?.goalPerWorkdayMinutes) || 0);
  if (committed > 0) return committed;
  const goal = Math.round(Number(stats?.goalMinutes) || 0);
  if (!(goal > 0)) return 0;
  return Math.round(goal / (isGoalWorkDays(workDays) ? Number(workDays) : 22));
};

/** Weekly hours a per-workday commitment is worth (the dial's rows are weekly). */
export const weeklyHoursFromCommitment = (perWorkdayMinutes = 0, daysPerWeek = 5) =>
  ((Number(perWorkdayMinutes) || 0) * (Number(daysPerWeek) || 0)) / 60;

/** Per-workday commitment implied by a month total (used for a custom target). */
export const perWorkdayFromTarget = ({
  targetMinutes = 0,
  bankedMinutes = 0,
  workDays = 0,
  now = new Date(),
}) => {
  const { remainingWorkdays } = monthBasis({ workDays, now });
  return Math.round(Math.max(0, targetMinutes - bankedMinutes) / Math.max(1, remainingWorkdays));
};

/**
 * The anchor to persist next to `goalMinutes` when a goal is banked.
 * base is clamped to the target so a custom goal below what is already worked
 * can never make the expected-by-today curve fall over time.
 */
export const buildGoalAnchor = ({
  targetMinutes = 0,
  bankedMinutes = 0,
  perWorkdayMinutes = 0,
  workDays = 0,
  now = new Date(),
}) => {
  const target = Math.round(Number(targetMinutes) || 0);
  const banked = Math.round(Math.max(0, Number(bankedMinutes) || 0));
  return {
    goalSetAt: toIsoDay(now),
    goalBaseMinutes: Math.min(banked, target),
    goalPerWorkdayMinutes: Math.round(Math.max(0, Number(perWorkdayMinutes) || 0)),
    goalWorkDays: isGoalWorkDays(workDays) ? Number(workDays) : 0,
  };
};

/** Saved anchor for stats that have one, else null (legacy pace preserved). */
export const savedGoalAnchor = (stats = {}) => {
  const base = Number(stats?.goalBaseMinutes);
  if (!stats?.goalSetAt || !Number.isFinite(base)) return null;
  return { goalSetAt: stats.goalSetAt, goalBaseMinutes: base };
};

/**
 * Which anchor should a pace computation use for `targetMinutes`?
 * 1. saved goal + saved anchor  → the saved anchor (configurator and dashboard
 *    must never disagree about the same target)
 * 2. saved goal without an anchor (legacy stats) → null = legacy behaviour
 * 3. an unsaved candidate target → anchor it at "banked right now", so the live
 *    preview shows the plan you get if you bank: deficit 0, today = commitment.
 */
export const anchorForCatchUp = ({
  targetMinutes = 0,
  bankedMinutes = 0,
  savedGoalMinutes = 0,
  savedGoalSetAt = null,
  savedGoalBaseMinutes = 0,
  now = new Date(),
}) => {
  const target = Math.round(Number(targetMinutes) || 0);
  const sameAsSaved = target > 0 && Math.round(Number(savedGoalMinutes) || 0) === target;
  if (sameAsSaved) {
    return savedGoalSetAt ? { goalSetAt: savedGoalSetAt, goalBaseMinutes: Number(savedGoalBaseMinutes) || 0 } : null;
  }
  if (!(target > 0)) return null;
  return {
    goalSetAt: toIsoDay(now),
    goalBaseMinutes: Math.min(Math.max(0, Math.round(Number(bankedMinutes) || 0)), target),
  };
};

/**
 * Month rollover: the same commitment, a fresh month, and the full-month quota
 * again (base 0 / set date = the 1st). Legacy stats without a recorded
 * commitment keep their old target and get no anchor.
 */
export const rollGoalForNewMonth = (stats = {}, workDays = 0, now = new Date()) => {
  const perWorkday = Math.round(Number(stats?.goalPerWorkdayMinutes) || 0);
  if (!(perWorkday > 0) || !isGoalWorkDays(workDays)) {
    return { goalSetAt: null, goalBaseMinutes: 0 };
  }
  return {
    goalMinutes: Math.round(perWorkday * Number(workDays)),
    goalSetAt: firstOfMonthIso(now),
    goalBaseMinutes: 0,
  };
};
