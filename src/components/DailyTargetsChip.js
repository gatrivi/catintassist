import React from 'react';

// v4.88.0: daily targets always visible in the status bar.
// Primary goal: $1200 USD/month. Fallback (rate floor): 5500 min/month.
const GOAL_USD = 1200;
const FALLBACK_MINUTES = 5500;

const fmtHm = (m) => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`;

/** Shared math: how many minutes do I still need today (and this month) for the $1200 goal? */
export const computeGoalDay = ({ dailyMinutes = 0, monthlyMinutes = 0, ratePerMinute = 0.13 }) => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1);
  const minutesBeforeToday = Math.max(0, monthlyMinutes - dailyMinutes);
  const goalMinutes = GOAL_USD / ratePerMinute; // ~9231m for $1200 @ $0.13
  const remainingGoal = Math.max(0, goalMinutes - minutesBeforeToday);
  return {
    dailyMin: Math.round(remainingGoal / remainingDays),
    leftMin: Math.round(remainingGoal),
  };
};

/**
 * Endgame plan: on-call time still needed today for the $1200 pace,
 * plus how much time off still fits if you finish by 18:00 or 23:00.
 */
export const computeEndgamePlan = ({ doneMins = 0, goalDayMin = 0, now = new Date() }) => {
  const need = Math.max(0, Math.round(goalDayMin - doneMins));
  const minsUntil = (h) => {
    const t = new Date(now); t.setHours(h, 0, 0, 0);
    return Math.round((t - now) / 60000);
  };
  const to18 = minsUntil(18), to23 = minsUntil(23);
  return {
    need,
    by18Possible: need <= to18,
    slack18: Math.max(0, to18 - need),   // free time if finishing by 18h
    slack23: Math.max(0, to23 - need),   // free time if finishing by 23h
  };
};

export const formatEndgamePlan = (p) =>
  !p ? '' :
  p.need <= 0 ? '🏁 goal done — rest / bank buffer' :
  `🏁 need ${fmtHm(p.need)} on call · off≤18h: ${p.by18Possible ? fmtHm(p.slack18) : '—'} · off≤23h: ${fmtHm(p.slack23)}`;

const pairStyle = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: '0.2rem',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const valStyle = { fontSize: '0.78rem', fontWeight: 900, lineHeight: 1 };
const tgtStyle = { fontSize: '0.6rem', fontWeight: 700, opacity: 0.55 };
const lblStyle = { fontSize: '0.6rem', opacity: 0.7 };

/**
 * v4.88.3: readable status-bar strip — three current/target pairs:
 *   💵 $earned/$target · ⏱ on-call done/target · ☕ break taken/max-by-18h
 * Break target = what you can take in TOTAL today and still hit the
 * $1200-pace minutes by 18:00 (overtime to 23:00 is the fallback, shown on hover).
 */
export const DailyTargetsChip = ({
  dailyMinutes = 0,
  monthlyMinutes = 0,
  breakMinutes = 0,
  ratePerMinute = 0.13,
}) => {
  const { dailyMin, leftMin } = computeGoalDay({ dailyMinutes, monthlyMinutes, ratePerMinute });
  const goalMinutes = GOAL_USD / ratePerMinute;
  const earnedUsd = dailyMinutes * ratePerMinute;
  const targetUsd = dailyMin * ratePerMinute;
  const plan = computeEndgamePlan({ doneMins: dailyMinutes, goalDayMin: dailyMin });
  const breakTarget = breakMinutes + plan.slack18; // total break budget incl. already taken

  const minutesBeforeToday = Math.max(0, monthlyMinutes - dailyMinutes);
  const fbRemaining = Math.max(0, FALLBACK_MINUTES - minutesBeforeToday);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const fbDaily = Math.round(fbRemaining / Math.max(1, daysInMonth - now.getDate() + 1));

  const warn = plan.need > 0 && !plan.by18Possible;

  return (
    <span
      id="daily-targets-chip"
      title={`$${GOAL_USD}/mo goal (${Math.round(goalMinutes)}m @ $${ratePerMinute}/min) — today: ${dailyMin}m ≈ $${targetUsd.toFixed(0)} · month left: ${leftMin}m ≈ $${(leftMin * ratePerMinute).toFixed(0)}
Fallback floor 5500m/mo — today: ${fbDaily}m · left: ${Math.round(fbRemaining)}m
Overtime: finish by 23:00 instead → off≤23h: ${fmtHm(plan.slack23)}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.7rem',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        color: warn ? '#f97316' : '#fbbf24',
        background: 'rgba(251,191,36,0.07)',
        border: `1px solid ${warn ? 'rgba(249,115,22,0.4)' : 'rgba(251,191,36,0.25)'}`,
        borderRadius: 4,
        padding: '0.2rem 0.55rem',
        lineHeight: 1,
        minHeight: 24,
      }}
    >
      <span style={pairStyle} title={`Earned today vs today's $ target`}>
        <span style={lblStyle}>💵</span>
        <span style={valStyle}>${earnedUsd.toFixed(2)}</span>
        <span style={tgtStyle}>/${targetUsd.toFixed(0)}</span>
      </span>
      <span style={pairStyle} title={`On-call today vs today's target (${dailyMin}m)`}>
        <span style={lblStyle}>⏱</span>
        <span style={valStyle}>{fmtHm(dailyMinutes)}</span>
        <span style={tgtStyle}>/{fmtHm(dailyMin)}</span>
      </span>
      <span style={pairStyle} title={`Break taken vs total break you can take and still hit the target by 18:00 (more break → overtime toward 23:00)`}>
        <span style={lblStyle}>☕</span>
        <span style={valStyle}>{fmtHm(breakMinutes)}</span>
        <span style={tgtStyle}>/{fmtHm(breakTarget)}</span>
      </span>
    </span>
  );
};
