/**
 * IdleRaceBoard (v4.210.0) — off-call glance board in the empty transcript pane.
 *
 * One shape: a month bar where YOU race a PACE GHOST (where you should be
 * today). One huge number: the gap. One line: what to do about it.
 * Shrinks by container width (CSS @container): tiny window = just the number.
 * Renders nothing if there is no goal → never a broken panel.
 */
import React, { useMemo } from 'react';
import { useSession } from '../contexts/SessionContext';
import { computeCatchUp } from '../utils/catchUpPlan';
import { buildRaceModel, formatGap, hhmm, workedDaysThisMonth } from '../utils/raceBoard';
import { APP_VERSION_LABEL } from '../constants/version';
import './IdleRaceBoard.css';

const fmt = (n) => Math.round(n).toLocaleString('en-US');

export const IdleRaceBoard = () => {
  const { stats = {}, dailyLog = {}, goalWorkDays = 0 } = useSession() || {};

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
      ? `do ${fmt(model.needToday)}m more today${eta ? ` · off ≈ ${eta}` : ''} · then ${fmt(model.needPerDay)}/day × ${model.daysLeft}d`
      : `today's share done ✓ · ${fmt(model.needPerDay)}/day keeps pace`;

  return (
    <section
      className={`race-board race-board--${model.tone}`}
      aria-label={`Month pace ${formatGap(model.gap)}`}
      title={`Race board ${APP_VERSION_LABEL}: ${fmt(model.done)} of ${fmt(model.goal)}m · pace ghost says ${fmt(model.expected)}m by today`}
    >
      <div className="race-board__gap" aria-live="polite">{formatGap(model.gap)}</div>

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
        <div className={`race-board__stat race-board__stat--${model.avgTone}`} title={`${fmt(model.done)}m ÷ ${model.workedDays} worked days`}>
          <b>{fmt(model.avg)}</b><span>MO AVG / day · need {fmt(model.needPerDay)}</span>
        </div>
        <div className="race-board__stat">
          <b>{fmt(model.today)}</b><span>today</span>
        </div>
        <div className="race-board__stat">
          <b>{fmt(model.done)}</b><span>of {fmt(model.goal)}m month</span>
        </div>
        <div className="race-board__stat">
          <b>{model.daysLeft}</b><span>workdays left</span>
        </div>
      </div>
    </section>
  );
};

export default IdleRaceBoard;
