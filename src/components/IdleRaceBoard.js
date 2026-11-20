/**
 * IdleRaceBoard (v4.210.0) — off-call glance board in the empty transcript pane.
 *
 * One shape: a month bar where YOU race a PACE GHOST (where you should be
 * today). One huge number: the gap. One line: what to do about it.
 * Shrinks by container width (CSS @container): tiny window = just the number.
 * Renders nothing if there is no goal → never a broken panel.
 */
import React, { useMemo, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { computeCatchUp } from '../utils/catchUpPlan';
import { buildRaceModel, formatGap, formatGapHours, fmtHoursClean, hhmm, workedDaysThisMonth } from '../utils/raceBoard';
import { APP_VERSION_LABEL } from '../constants/version';
import { IdleMonthCalendar } from './IdleMonthCalendar';
import './IdleRaceBoard.css';

const fmt = (n) => Math.round(n).toLocaleString('en-US');

export const IdleRaceBoard = () => {
  const { stats = {}, dailyLog = {}, goalWorkDays = 0 } = useSession() || {};

  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('catint_idle_view_mode') || 'calendar';
    } catch {
      return 'calendar';
    }
  });

  const handleSelectView = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('catint_idle_view_mode', mode);
    } catch {}
  };

  const model = useMemo(() => {
    try {
      const today = Number(stats.dailyMinutes) || 0;
      // Same "banked" rule as the header: never below the sum of the log.
      const now = new Date();
      let logSum = today;
      Object.entries(dailyLog || {}).forEach(([ds, mins]) => {
        const d = new Date(ds);
        if (ds === now.toDateString() || Number.isNaN(d.getTime())) return;
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) logSum += Number(mins) || 0;
      });
      const month = Math.max(Number(stats.monthlyMinutes) || 0, Math.round(logSum));
      const goalMinutes = Number(stats.goalMinutes) || 0;
      if (!goalMinutes) return null;
      const plan = computeCatchUp({
        goalMinutes,
        monthlyMinutes: month,
        dailyMinutes: Math.round(today),
        workDays: goalWorkDays,
        goalSetAt: stats.goalSetAt || null,
        goalBaseMinutes: stats.goalBaseMinutes || 0,
      });
      return buildRaceModel({
        goalMinutes, monthMinutes: month, todayMinutes: today, plan,
        workedDays: workedDaysThisMonth(dailyLog, today, now),
      });
    } catch (e) {
      return null; // a glance board must never crash the transcript pane
    }
  }, [stats.dailyMinutes, stats.monthlyMinutes, stats.goalMinutes, stats.goalSetAt, stats.goalBaseMinutes, dailyLog, goalWorkDays]);

  if (!model) return null;

  const eta = hhmm(model.offEta);
  const action = model.finished
    ? '🏁 month goal done — everything now is bonus'
    : model.needToday > 0
      ? `do ${fmtHoursClean(model.needToday)} more today${eta ? ` · off ≈ ${eta}` : ''} · then ${fmtHoursClean(model.needPerDay)}/day × ${model.daysLeft}d`
      : `today's share done ✓ · ${fmtHoursClean(model.needPerDay)}/day keeps pace`;

  return (
    <section
      className={`race-board race-board--${model.tone}`}
      aria-label={`Month pace ${formatGapHours(model.gap)} (${formatGap(model.gap)})`}
      title={`Race board ${APP_VERSION_LABEL}: ${fmt(model.done)} of ${fmt(model.goal)}m · pace ghost says ${fmt(model.expected)}m by today`}
    >
      {/* v4.212.0: Hero Dashboard — Daily Need, Pace Gap, Month Progress */}
      <div className="race-board__heroes">
        <div className="race-board__hero race-board__hero--need" title={`${fmt(model.needPerDay)} minutes needed per workday`}>
          <span className="race-board__hero-label">DAILY NEED</span>
          <b className="race-board__hero-val">{fmtHoursClean(model.needPerDay)}</b>
          <span className="race-board__hero-sub">{fmt(model.needPerDay)}m / workday</span>
        </div>

        <div className={`race-board__hero race-board__hero--gap race-board__hero--${model.tone}`} title={`Pace gap vs today: ${formatGap(model.gap)} (${fmt(model.done)}m banked vs ${fmt(model.expected)}m expected)`}>
          <span className="race-board__hero-label">PACE GAP</span>
          <b className="race-board__hero-val">{formatGapHours(model.gap)}</b>
          <span className="race-board__hero-sub">{formatGap(model.gap)} vs today</span>
        </div>

        <div className="race-board__hero race-board__hero--progress" title={`${fmt(model.done)} of ${fmt(model.goal)} minutes completed`}>
          <span className="race-board__hero-label">MONTH PROGRESS</span>
          <b className="race-board__hero-val">{Math.round(model.youPct)}%</b>
          <span className="race-board__hero-sub">{fmtHoursClean(model.done)} / {fmtHoursClean(model.goal)}</span>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.2rem 0 0.1rem' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
          Off-call glance view
        </span>
        <div style={{ display: 'flex', gap: '0.3rem', background: '#111827', padding: '0.2rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
          <button
            id="idle-view-tab-calendar"
            type="button"
            onClick={() => handleSelectView('calendar')}
            style={{
              background: viewMode === 'calendar' ? '#2563eb' : 'transparent',
              border: 'none',
              color: viewMode === 'calendar' ? '#fff' : '#94a3b8',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: viewMode === 'calendar' ? '0 0 8px rgba(37,99,235,0.4)' : 'none',
            }}
          >
            📅 Calendar (50m Emojis)
          </button>
          <button
            id="idle-view-tab-race"
            type="button"
            onClick={() => handleSelectView('race')}
            style={{
              background: viewMode === 'race' ? '#2563eb' : 'transparent',
              border: 'none',
              color: viewMode === 'race' ? '#fff' : '#94a3b8',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: viewMode === 'race' ? '0 0 8px rgba(37,99,235,0.4)' : 'none',
            }}
          >
            🏎️ Pace Race
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <IdleMonthCalendar onSwitchToRace={() => handleSelectView('race')} />
      ) : (
        <>
          <div className="race-board__track" role="img" aria-label={`You ${Math.round(model.youPct)}% · pace ${Math.round(model.ghostPct)}%`}>
            <div className="race-board__fill" style={{ width: `${model.youPct}%` }} />
            <div
              className="race-board__gapband"
              style={{
                left: `${Math.min(model.youPct, model.ghostPct)}%`,
                width: `${Math.abs(model.ghostPct - model.youPct)}%`,
              }}
            />
            <div className="race-board__ghost" style={{ left: `${model.ghostPct}%` }}>
              <span className="race-board__tag">pace</span>
            </div>
            <div className="race-board__you" style={{ left: `${model.youPct}%` }}>
              <span className="race-board__tag">you</span>
            </div>
          </div>

          <div className="race-board__action">{action}</div>

          <div className="race-board__stats">
            <div className={`race-board__stat race-board__stat--${model.avgTone}`} title={`${fmtHoursClean(model.done)} (${fmt(model.done)}m) ÷ ${model.workedDays} worked days`}>
              <b>{fmtHoursClean(model.avg)}</b>
              <span>MO AVG / day</span>
              <small className="race-board__stat-sub">{fmt(model.avg)}m · need {fmt(model.needPerDay)}m</small>
            </div>
            <div className="race-board__stat" title={`${fmt(model.today)} minutes worked today`}>
              <b>{fmtHoursClean(model.today)}</b>
              <span>today</span>
              <small className="race-board__stat-sub">{fmt(model.today)}m</small>
            </div>
            <div className="race-board__stat" title={`${fmtHoursClean(model.remaining)} (${fmt(model.remaining)}m) left to complete ${fmt(model.goal)}m goal`}>
              <b>{fmtHoursClean(model.remaining)}</b>
              <span>remaining</span>
              <small className="race-board__stat-sub">{fmt(model.remaining)}m to goal</small>
            </div>
            <div className="race-board__stat" title={`${model.daysLeft} workdays remaining in this month`}>
              <b>{model.daysLeft}</b>
              <span>workdays left</span>
              <small className="race-board__stat-sub">time to pace</small>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default IdleRaceBoard;
