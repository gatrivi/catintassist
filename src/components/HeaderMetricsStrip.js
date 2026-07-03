import React from 'react';
import { WorkspaceViewSwitcher } from './WorkspaceViewSwitcher';
import { ElementHintTarget } from './ElementHint';
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GameIcon,
  GridIcon,
  HelpIcon,
  LadderIcon,
  SunIcon,
} from './HeaderIcons';

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
 * Off-call scoreboard chrome: summary + quick actions + 3 thin bars + expand toggle.
 * Single component for collapsed and expanded header (no duplicate expand row).
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
  showBars = true,
  showQuickRow = true,
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
        <ElementHintTarget
          elementId="header-metrics-expand-btn"
          guideKey="metrics-expand"
          heading={expanded ? 'Collapse scoreboard' : 'Expand scoreboard'}
          body={expanded ? 'Hide detailed scoreboard (game/numbers grid).' : 'Expand scoreboard — game view + 12-metric grid.'}
          color="#a855f7"
        >
        <button
          type="button"
          className="header-metrics-expand-btn header-metrics-expand-btn--icon"
          id="header-metrics-expand-btn"
          data-guide="metrics-expand"
          onClick={onToggleExpand}
          title={expanded ? 'Hide detailed scoreboard (game/numbers grid)' : 'Expand scoreboard — game view + 12-metric grid'}
        >
          {expanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
          <span>{expanded ? 'Less' : 'Metrics'}</span>
        </button>
        </ElementHintTarget>
      </div>
      {showQuickRow && (onScoreViewChange || onCycleWorkspace) && (
        <div className="header-metrics-quick-row">
          {onScoreViewChange && (
            <>
              <ElementHintTarget
                elementId="header-score-view-game-btn"
                heading="Game scoreboard"
                body="Bounty HUD view with emoji progress rows."
                color="#10b981"
              >
              <button
                type="button"
                id="header-score-view-game-btn"
                className={`header-metrics-quick-btn${scoreView === 'game' ? ' is-active' : ''}`}
                onClick={() => onScoreViewChange('game')}
                title="Game scoreboard (bounty HUD)"
                aria-pressed={scoreView === 'game'}
              >
                <GameIcon size={14} />
              </button>
              </ElementHintTarget>
              <ElementHintTarget
                elementId="header-score-view-grid-btn"
                heading="Numbers grid"
                body="12-metric terminal grid with percentages."
                color="#3b82f6"
              >
              <button
                type="button"
                id="header-score-view-grid-btn"
                className={`header-metrics-quick-btn${scoreView === 'numbers' ? ' is-active' : ''}`}
                onClick={() => onScoreViewChange('numbers')}
                title="Numbers grid (12 metrics)"
                aria-pressed={scoreView === 'numbers'}
              >
                <GridIcon size={14} />
              </button>
              </ElementHintTarget>
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
          <ElementHintTarget
            elementId="header-help-tour-btn"
            guideKey="help"
            heading="Help tour"
            body="Open the EN/ES guided tour of app features."
            color="#38bdf8"
          >
          <button
            type="button"
            id="header-help-tour-btn"
            className="header-metrics-quick-btn header-metrics-quick-btn--help"
            data-guide="help"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent('cat_open_app_guide'));
              } catch (_) {}
            }}
            title="Help tour (EN / ES)"
            aria-label="Open help tour"
          >
            <HelpIcon size={14} />
          </button>
          </ElementHintTarget>
        </div>
      )}
      {showBars && (
        <div className="header-metrics-bars">
          <CompactBar
            fill={monthlyFill}
            pending={monthlyPending}
            color={monthlyColor}
            title={monthlyTooltip}
            onMouseEnter={hover({ elementId: 'header-bar-monthly', icon: <CalendarIcon size={14} />, heading: 'MONTHLY', color: monthlyColor, body: monthlyTooltip })}
            onMouseLeave={leave}
          />
          <CompactBar
            fill={stepFill}
            color={stepColor}
            title={stepTooltip}
            onMouseEnter={hover({ elementId: 'header-bar-weekly-step', icon: <LadderIcon size={14} />, heading: 'WEEKLY STEP', color: stepColor, body: stepTooltip })}
            onMouseLeave={leave}
          />
          <CompactBar
            fill={dailyFill}
            color={dailyColor}
            title={dailyTooltip}
            onMouseEnter={hover({ elementId: 'header-bar-daily', icon: <SunIcon size={14} />, heading: 'DAILY', color: dailyColor, body: dailyTooltip })}
            onMouseLeave={leave}
          />
        </div>
      )}
    </div>
  );
};
