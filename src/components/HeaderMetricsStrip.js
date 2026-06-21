import React from 'react';

/** Single 6px bar — no floating milestone labels (fits 180px header budget). */
const CompactBar = ({ fill = 0, pending = null, color = '#a855f7', title, onMouseEnter, onMouseLeave }) => {
  const clampedFill = Math.min(1, Math.max(0, fill));
  const clampedPending = pending != null ? Math.min(1, Math.max(0, pending)) : null;

  return (
    <div
      className="header-metrics-bar"
      title={title}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="presentation"
    >
      <div className="header-metrics-bar-track">
        {clampedPending != null && clampedPending > clampedFill && (
          <div className="header-metrics-bar-pending" style={{ width: `${clampedPending * 100}%` }} />
        )}
        <div className="header-metrics-bar-fill" style={{ width: `${clampedFill * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

/**
 * Collapsed off-call chrome: one summary line + 3 thin bars + expand toggle.
 * Full labels / GameScoreboard live behind expand.
 */
export const HeaderMetricsStrip = ({
  totalDailyMins,
  dailyGoal,
  monthPct,
  liveDailyArs,
  monthlyFill,
  monthlyPending,
  monthlyColor,
  monthlyTooltip,
  stepFill,
  stepColor,
  stepTooltip,
  dailyFill,
  dailyColor,
  dailyTooltip,
  expanded,
  onToggleExpand,
  onBarHover,
  onBarLeave,
}) => {
  const arsLabel = liveDailyArs >= 1000
    ? `AR$${Math.round(liveDailyArs / 1000)}k`
    : `AR$${liveDailyArs}`;

  const hover = (payload) => (e) => onBarHover?.(e, payload);
  const leave = () => onBarLeave?.();

  return (
    <div className="header-metrics-strip" data-guide="scoreboard">
      <div className="header-metrics-strip-row">
        <span className="header-metrics-summary">
          {Math.round(totalDailyMins)}m/{Math.round(dailyGoal)}m · {monthPct}% mo · {arsLabel}
        </span>
        <button
          type="button"
          className="header-metrics-expand-btn"
          onClick={onToggleExpand}
          title={expanded ? 'Hide detailed metrics' : 'Show scoreboard + progress labels'}
        >
          {expanded ? '▲ Less' : '▼ Metrics'}
        </button>
      </div>
      <div className="header-metrics-bars">
        <CompactBar
          fill={monthlyFill}
          pending={monthlyPending}
          color={monthlyColor}
          title={monthlyTooltip}
          onMouseEnter={hover({ icon: '🗓️', heading: 'MONTHLY', color: monthlyColor, body: monthlyTooltip })}
          onMouseLeave={leave}
        />
        <CompactBar
          fill={stepFill}
          color={stepColor}
          title={stepTooltip}
          onMouseEnter={hover({ icon: '🪜', heading: 'WEEKLY STEP', color: stepColor, body: stepTooltip })}
          onMouseLeave={leave}
        />
        <CompactBar
          fill={dailyFill}
          color={dailyColor}
          title={dailyTooltip}
          onMouseEnter={hover({ icon: '☀️', heading: 'DAILY', color: dailyColor, body: dailyTooltip })}
          onMouseLeave={leave}
        />
      </div>
    </div>
  );
};
