import React, { useCallback, useMemo, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { DialGoalSelector, daysPerWeekOf } from './DialGoalSelector';
import { MonthCalendarPanel } from './MonthCalendarPanel';
import { computeCatchUp, fmtHm } from '../utils/catchUpPlan';
import { APP_VERSION_LABEL } from '../constants/version';

// v4.113.0: Goal Tracking view — the goal dial got its own full workspace view.
// Left: weekly-commitment dial. Right: month calendar (click a day to fix minutes).
// The pace card + calendar react LIVE to the dial (before saving), including the
// 4/5/6/6.5/7-day-week basis, always accounting for minutes banked so far.
export const GOALS_VIEW = 'goals';

export const GoalTrackingView = ({ onExit }) => {
  const {
    stats, updateStat, dailyLog,
    goalWorkDays, setGoalWorkDays,
    RATE_PER_MINUTE, arsRate, setArsRate,
    getMonthResyncPreview, reconcileMonthTotal,
  } = useSession();

  // Live (unsaved) dial selection — null until the dial reports its first preview.
  const [preview, setPreview] = useState(null);
  const [savedFlash, setSavedFlash] = useState('');

  // Banked month total: never below what the daily log actually sums to.
  const monthlyBanked = useMemo(() => {
    let sum = 0;
    try { sum = getMonthResyncPreview?.()?.sum || 0; } catch { sum = 0; }
    return Math.max(stats.monthlyMinutes || 0, sum);
  }, [stats.monthlyMinutes, dailyLog, getMonthResyncPreview]);

  const previewGoalMinutes = preview?.monthlyMinutes ?? stats.goalMinutes;
  const previewWorkDays = preview?.workDays ?? goalWorkDays;

  // THE number this view exists for: what each remaining workday must produce.
  const plan = useMemo(() => {
    try {
      return computeCatchUp({
        goalMinutes: previewGoalMinutes,
        monthlyMinutes: stats.monthlyMinutes,
        dailyMinutes: stats.dailyMinutes,
        workDays: previewWorkDays,
      });
    } catch { return null; }
  }, [previewGoalMinutes, stats.monthlyMinutes, stats.dailyMinutes, previewWorkDays]);

  const isPreviewing = preview != null
    && (Math.round(preview.monthlyMinutes) !== Math.round(stats.goalMinutes)
      || preview.workDays !== goalWorkDays);

  const handleSave = useCallback((mins, meta) => {
    updateStat('goalMinutes', mins);
    if (meta && [17, 22, 26, 28, 30].includes(meta.workDays)) {
      setGoalWorkDays(meta.workDays); // context persists to catint_goal_workdays_v1
    }
    setSavedFlash(`Banked ${Math.round(mins)}m/mo · ${daysPerWeekOf(meta?.workDays || goalWorkDays)}/wk basis`);
    window.setTimeout(() => setSavedFlash(''), 4000);
    // Stay in the view — the calendar + pace card now reflect the saved goal.
  }, [updateStat, setGoalWorkDays, goalWorkDays]);

  const verdictText = plan
    ? (plan.deficitMins > 30
        ? `📉 behind ${fmtHm(plan.deficitMins)}`
        : plan.deficitMins < -30
          ? `📈 ahead ${fmtHm(-plan.deficitMins)}`
          : '✅ on pace')
    : '';

  return (
    <div className="goal-tracking-view">
      {/* ── Pace card: the live answer to "how much per day do I need?" ── */}
      <div
        className="goal-pace-card glass-panel"
        style={{
          background: isPreviewing ? 'rgba(168,85,247,0.08)' : 'rgba(15,23,42,0.9)',
          border: `1px solid ${isPreviewing ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.08)'}`,
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: '1rem' }}>🎯</span>
        <div className="goal-pace-card__need">
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>need / workday</span>
          <span id="goal-pace-need" style={{ fontSize: '1.3rem', fontWeight: 900, color: isPreviewing ? '#c4b5fd' : '#34d399' }}>
            {plan ? fmtHm(plan.requiredToday) : '—'}
          </span>
        </div>
        <span className="goal-pace-card__meta">
          {plan && <>
            banked <b style={{ color: '#e2e8f0' }}>{fmtHm(monthlyBanked)}</b> / goal <b style={{ color: '#e2e8f0' }}>{fmtHm(previewGoalMinutes)}</b>
            {' '}· <b style={{ color: '#7dd3fc' }}>{plan.remainingWorkdays}</b> workdays left @ {daysPerWeekOf(previewWorkDays)}/wk
            {' '}· today → <b style={{ color: '#fbbf24' }}>{fmtHm(plan.needToday)}</b>
          </>}
        </span>
        <span className="goal-pace-card__verdict">{verdictText}</span>
        {isPreviewing && (
          <span className="goal-pace-card__live">
            LIVE — press “Bank Goal” to keep this
          </span>
        )}
        {savedFlash && (
          <span id="goal-saved-flash" className="goal-pace-card__flash">✔ {savedFlash}</span>
        )}
        <span className="goal-pace-card__right">
          <span style={{ fontSize: '0.6rem', opacity: 0.6, color: 'var(--text-muted)' }}>{APP_VERSION_LABEL}</span>
          <button
            type="button"
            id="goal-view-exit-btn"
            onClick={onExit}
            title="Back to transcription (or click the cat 🐱)"
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#e2e8f0', borderRadius: '8px', padding: '0.35rem 0.8rem',
              fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
            }}
          >
            ← Back to work
          </button>
        </span>
      </div>

      {/* ── Two panes: dial left, calendar right (grid — both can shrink) ── */}
      <div className="goal-tracking-panes">
        <div className="goal-tracking-dial">
          <DialGoalSelector
            ratePerMinute={RATE_PER_MINUTE}
            arsRate={arsRate}
            setArsRate={setArsRate}
            initialGoalMinutes={stats.goalMinutes}
            initialWorkDays={goalWorkDays}
            monthlyMinutes={monthlyBanked}
            dailyMinutes={Math.round(stats.dailyMinutes || 0)}
            onSaveMonth={(m) => updateStat('monthlyMinutes', m)}
            onResyncMonth={() => { try { reconcileMonthTotal?.(); } catch (_) {} }}
            resyncInfo={(() => { try { return getMonthResyncPreview?.(); } catch { return null; } })()}
            onSave={handleSave}
            onCancel={onExit}
            onPreview={setPreview}
          />
        </div>
        <div className="goal-tracking-calendar">
          <MonthCalendarPanel previewGoalMinutes={preview?.monthlyMinutes ?? null} workDays={previewWorkDays} />
        </div>
      </div>
    </div>
  );
};
