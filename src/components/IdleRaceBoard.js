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
import { SmartTooltip } from './SmartTooltip';
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
    : model.isUnreachable
      ? `🚨 Goal unreachable: requires ${fmtHoursClean(model.needPerDay)}/day (>24h) across ${model.daysLeft}d · Tap 🎯 to reset target`
      : model.verdict === 'impossible'
        ? `⚠️ Today's share (${fmtHoursClean(model.needToday)}) won't fit today · then ${fmtHoursClean(model.needPerDay)}/day × ${model.daysLeft}d`
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
        <SmartTooltip
          title="🎯 DAILY NEED (Workday Target)"
          badge={model.isUnreachable ? '🚨 OUT OF REACH (>24h)' : (model.needPerDay > 600 ? '⚠️ HIGH LOAD' : 'WORKDAY PACE')}
          tone={model.isUnreachable ? 'bad' : (model.needPerDay > 600 ? 'warn' : 'neutral')}
          formula={`${fmtHoursClean(model.remaining)} (${fmt(model.remaining)}m) left ÷ ${model.daysLeft} workdays = ${fmt(model.needPerDay)}m/day (${fmtHoursClean(model.needPerDay)})`}
          desc={model.isUnreachable
            ? 'Exceeds 24 hours in a single day. This monthly goal cannot mathematically be completed in the remaining days.'
            : 'Average call talk-time you need to bank each remaining scheduled workday to reach 100% of your month goal.'}
          hint={model.isUnreachable
            ? '💡 Tap 🎯 Goal Dial in Settings to set a realistic monthly tier or floor.'
            : '💡 Scheduled rest days and off-call gaps are already accounted for.'}
          delay={250}
        >
          <div className={`race-board__hero race-board__hero--need ${model.isUnreachable ? 'race-board__hero--unreachable' : ''}`}>
            <span className="race-board__hero-label">DAILY NEED</span>
            <b className="race-board__hero-val" style={model.isUnreachable ? { color: '#f87171' } : undefined}>
              {model.isUnreachable ? '>24h / day' : fmtHoursClean(model.needPerDay)}
            </b>
            <span className="race-board__hero-sub">
              {model.isUnreachable ? `🚨 ${fmt(model.needPerDay)}m/d · Out of reach` : `${fmt(model.needPerDay)}m / workday`}
            </span>
          </div>
        </SmartTooltip>

        <SmartTooltip
          title="📉 PACE GAP (Pace Ghost Deficit)"
          badge={model.gap > 30 ? '📉 BEHIND PACE' : (model.gap < -30 ? '📈 AHEAD OF PACE' : '✅ ON PACE')}
          tone={model.gap > 30 ? 'bad' : (model.gap < -30 ? 'good' : 'neutral')}
          formula={`Expected by today: ${fmtHoursClean(model.expected)} (${fmt(model.expected)}m) · Banked: ${fmtHoursClean(model.done)} (${fmt(model.done)}m) · Gap: ${formatGapHours(model.gap)} (${formatGap(model.gap)})`}
          desc="Compares your banked talk-time against where an even monthly pace expects you to be by today. Negative means behind pace ghost."
          hint="💡 Catch-up is distributed evenly across all remaining workdays."
          delay={250}
        >
          <div className={`race-board__hero race-board__hero--gap race-board__hero--${model.tone}`}>
            <span className="race-board__hero-label">PACE GAP</span>
            <b className="race-board__hero-val">{formatGapHours(model.gap)}</b>
            <span className="race-board__hero-sub">{formatGap(model.gap)} vs today</span>
          </div>
        </SmartTooltip>

        <SmartTooltip
          title="📅 MONTH PROGRESS"
          badge={`${Math.round(model.youPct)}% COMPLETE`}
          tone={model.youPct >= 100 ? 'good' : (model.youPct >= 50 ? 'neutral' : 'warn')}
          formula={`${fmtHoursClean(model.done)} (${fmt(model.done)}m) banked of ${fmtHoursClean(model.goal)} (${fmt(model.goal)}m) goal`}
          desc="Total talk-time completed so far this calendar month across all banked calls."
          hint={model.finished ? '🏁 Monthly target achieved! Every call from now on is pure bonus.' : `${fmtHoursClean(model.remaining)} (${fmt(model.remaining)}m) still needed to reach goal.`}
          delay={250}
        >
          <div className="race-board__hero race-board__hero--progress">
            <span className="race-board__hero-label">MONTH PROGRESS</span>
            <b className="race-board__hero-val">{Math.round(model.youPct)}%</b>
            <span className="race-board__hero-sub">{fmtHoursClean(model.done)} / {fmtHoursClean(model.goal)}</span>
          </div>
        </SmartTooltip>
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
            <SmartTooltip
              title="📊 MONTHLY DAILY AVERAGE"
              badge={`${fmt(model.avg)}m / WORKED DAY`}
              tone={model.avgTone === 'good' ? 'good' : (model.avgTone === 'warn' ? 'warn' : 'bad')}
              formula={`${fmtHoursClean(model.done)} (${fmt(model.done)}m) ÷ ${model.workedDays} worked days = ${fmt(model.avg)}m/day (${fmtHoursClean(model.avg)})`}
              desc="Your true average talk-time per day worked. Filters out empty off-days (days with <15m) so weekends never artificially drag your rhythm down."
              hint={`💡 Target need is ${model.isUnreachable ? '>24h/d' : `${fmt(model.needPerDay)}m/day`} across remaining workdays.`}
              delay={250}
            >
              <div className={`race-board__stat race-board__stat--${model.avgTone}`}>
                <b>{fmtHoursClean(model.avg)}</b>
                <span>MO AVG / day</span>
                <small className="race-board__stat-sub">
                  {model.isUnreachable ? `${fmt(model.avg)}m · need >24h/d` : `${fmt(model.avg)}m · need ${fmt(model.needPerDay)}m`}
                </small>
              </div>
            </SmartTooltip>

            <SmartTooltip
              title="📞 TODAY'S TALK TIME"
              badge={`${fmt(model.today)}m TODAY`}
              tone="neutral"
              formula={`${fmtHoursClean(model.today)} (${fmt(model.today)}m) banked today across completed calls`}
              desc="Cumulative minutes spent actively interpreting on client calls today. Updates when calls complete."
              hint="💡 Active calls show live minutes in the sticky top bar."
              delay={250}
            >
              <div className="race-board__stat">
                <b>{fmtHoursClean(model.today)}</b>
                <span>today</span>
                <small className="race-board__stat-sub">{fmt(model.today)}m</small>
              </div>
            </SmartTooltip>

            <SmartTooltip
              title="⏳ REMAINING TALK TIME"
              badge={model.isUnreachable ? '🚨 OUT OF REACH' : `${fmtHoursClean(model.remaining)} LEFT`}
              tone={model.isUnreachable ? 'bad' : 'neutral'}
              formula={`${fmtHoursClean(model.goal)} goal − ${fmtHoursClean(model.done)} banked = ${fmtHoursClean(model.remaining)} (${fmt(model.remaining)}m)`}
              desc="Exact amount of talk-time minutes required before the end of the month to reach 100% of your target."
              hint={model.isUnreachable ? '🚨 Total hours needed exceed remaining calendar hours in the month.' : '💡 Every completed call reduces this countdown.'}
              delay={250}
            >
              <div className="race-board__stat">
                <b>{fmtHoursClean(model.remaining)}</b>
                <span>remaining</span>
                <small className="race-board__stat-sub">{fmt(model.remaining)}m to goal</small>
              </div>
            </SmartTooltip>

            <SmartTooltip
              title="🗓️ REMAINING WORKDAYS"
              badge={`${model.daysLeft} WORKDAYS`}
              tone="neutral"
              formula={`${model.daysLeft} scheduled workdays left this month (including today)`}
              desc="Calculated based on your active schedule pattern (e.g. 5d, 6d, or 6.5d/week), excluding off-days."
              hint="💡 You can adjust your workdays per week in the 🎯 Goal dial."
              delay={250}
            >
              <div className="race-board__stat">
                <b>{model.daysLeft}</b>
                <span>workdays left</span>
                <small className="race-board__stat-sub">time to pace</small>
              </div>
            </SmartTooltip>
          </div>
        </>
      )}
    </section>
  );
};

export default IdleRaceBoard;
