import React from 'react';
import { WorkspaceViewSwitcher } from './WorkspaceViewSwitcher';

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
  scoreView = 'game',
  onScoreViewChange,
  studioView = 'scoreboard',
  onCycleWorkspace,
  showStudioHint = false,
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
          data-guide="metrics-expand"
          onClick={onToggleExpand}
          title={expanded ? 'Hide detailed scoreboard (game/numbers grid)' : 'Expand scoreboard — game view + 12-metric grid'}
        >
          {expanded ? '▲ Less' : '▼ Metrics'}
        </button>
      </div>
      {(onScoreViewChange || onCycleWorkspace) && (
        <div className="header-metrics-quick-row">
          {onScoreViewChange && (
            <>
              <button
                type="button"
                className={`header-metrics-quick-btn${scoreView === 'game' ? ' is-active' : ''}`}
                onClick={() => onScoreViewChange('game')}
                title="Game scoreboard (bounty HUD)"
                aria-pressed={scoreView === 'game'}
              >
                🎮
              </button>
              <button
                type="button"
                className={`header-metrics-quick-btn${scoreView === 'numbers' ? ' is-active' : ''}`}
                onClick={() => onScoreViewChange('numbers')}
                title="Numbers grid (12 metrics)"
                aria-pressed={scoreView === 'numbers'}
              >
                #
              </button>
            </>
          )}
          {onCycleWorkspace && (
            <WorkspaceViewSwitcher
              view={studioView}
              onCycle={onCycleWorkspace}
              variant="inline"
              showHint={showStudioHint}
            />
          )}
          <button
            type="button"
            className="header-metrics-quick-btn header-metrics-quick-btn--help"
            data-guide="help"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent('cat_open_app_guide'));
              } catch (_) {}
            }}
            title="Help tour (EN / ES)"
          >
            ?
          </button>
        </div>
      )}
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
