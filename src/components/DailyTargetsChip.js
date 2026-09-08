import React from 'react';

// v4.87.0: daily targets always visible in the status bar.
// Primary goal: $1200 USD/month. Fallback (rate floor): 5500 min/month.
const GOAL_USD = 1200;
const FALLBACK_MINUTES = 5500;

/**
 * Tiny always-on chip: "🎯 246m/$32 · 6.1k m left"
 * - daily minutes + USD needed today to reach the $1200 goal
 * - minutes still missing this month (tooltip adds the 5500 fallback numbers)
 */
export const DailyTargetsChip = ({ dailyMinutes = 0, monthlyMinutes = 0, ratePerMinute = 0.13 }) => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1);
  const minutesBeforeToday = Math.max(0, monthlyMinutes - dailyMinutes);

  const goalMinutes = GOAL_USD / ratePerMinute; // ~9231m for $1200 @ $0.13
  const remainingGoal = Math.max(0, goalMinutes - minutesBeforeToday);
  const dailyMin = Math.round(remainingGoal / remainingDays);
  const dailyUsd = dailyMin * ratePerMinute;
  const leftMin = Math.round(remainingGoal);

  const fbRemaining = Math.max(0, FALLBACK_MINUTES - minutesBeforeToday);
  const fbDaily = Math.round(fbRemaining / remainingDays);

  const fmtK = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)}k` : `${m}`);

  return (
    <span
      id="daily-targets-chip"
      title={`$${GOAL_USD}/mo goal (${Math.round(goalMinutes)}m @ $${ratePerMinute}/min) — today: ${dailyMin}m ≈ $${dailyUsd.toFixed(0)} · month left: ${leftMin}m ≈ $${(leftMin * ratePerMinute).toFixed(0)}
Fallback floor 5500m/mo — today: ${fbDaily}m · left: ${Math.round(fbRemaining)}m`}
      style={{
        fontSize: '0.6rem',
        fontWeight: 800,
        whiteSpace: 'nowrap',
        color: '#fbbf24',
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: 4,
        padding: '0.16rem 0.4rem',
        lineHeight: 1,
        minHeight: 22,
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      🎯 {dailyMin}m/${dailyUsd.toFixed(0)} · {fmtK(leftMin)}m left
    </span>
  );
};
