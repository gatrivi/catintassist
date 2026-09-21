import React, { useCallback, useMemo, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { DialGoalSelector, daysPerWeekOf } from './DialGoalSelector';
import { MonthCalendarPanel } from './MonthCalendarPanel';
import { computeCatchUp, fmtHm } from '../utils/catchUpPlan';
import { anchorForCatchUp, goalSetLabel } from '../utils/goalAnchor';
import { downloadAppBackup, formatBytes } from '../utils/appBackup';
import { APP_VERSION_LABEL } from '../constants/version';

// v4.113.0: Goal Tracking view — the goal dial got its own full workspace view.
// Left: weekly-commitment dial. Right: month calendar (click a day to fix minutes).
// The pace card + calendar react LIVE to the dial (before saving), including the
// 4/5/6/6.5/7-day-week basis, always accounting for minutes banked so far.
// ANCHORED-GOAL: the target counts from the day it is banked — never a
// full-month quota for days that were already gone when you set it.
export const GOALS_VIEW = 'goals';

export const GoalTrackingView = ({ onExit }) => {
  const {
    stats, updateStat, bankGoal, dailyLog,
    goalWorkDays,
    RATE_PER_MINUTE, arsRate, setArsRate,
    getMonthResyncPreview, reconcileMonthTotal,
  } = useSession();

  // Live (unsaved) dial selection — null until the dial reports its first preview.
  const [preview, setPreview] = useState(null);
  const [savedFlash, setSavedFlash] = useState('');
  const [backupFlash, setBackupFlash] = useState('');

  // Banked month total: never below what the daily log actually sums to.
  const monthlyBanked = useMemo(() => {
    let sum = 0;
    try { sum = getMonthResyncPreview?.()?.sum || 0; } catch { sum = 0; }
    return Math.max(stats.monthlyMinutes || 0, sum);
  }, [stats.monthlyMinutes, dailyLog, getMonthResyncPreview]);

  const previewGoalMinutes = preview?.monthlyMinutes ?? stats.goalMinutes;
  const previewWorkDays = preview?.workDays ?? goalWorkDays;

  // ANCHORED-GOAL: the pace clock follows the saved anchor while the dial still
  // shows the saved number; a moved dial is a candidate → anchored at "banked now".
  const anchor = anchorForCatchUp({
    targetMinutes: previewGoalMinutes,
    bankedMinutes: monthlyBanked,
    savedGoalMinutes: stats.goalMinutes,
    savedGoalSetAt: stats.goalSetAt,
    savedGoalBaseMinutes: stats.goalBaseMinutes,
  });

  // THE number this view exists for: what each remaining workday must produce.
  const plan = useMemo(() => {
    try {
      return computeCatchUp({
        goalMinutes: previewGoalMinutes,
        monthlyMinutes: stats.monthlyMinutes,
        dailyMinutes: stats.dailyMinutes,
        workDays: previewWorkDays,
        ...(anchor || {}),
      });
    } catch { return null; }
  }, [previewGoalMinutes, stats.monthlyMinutes, stats.dailyMinutes, previewWorkDays, anchor?.goalSetAt, anchor?.goalBaseMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPreviewing = preview != null
    && (Math.round(preview.monthlyMinutes) !== Math.round(stats.goalMinutes)
      || preview.workDays !== goalWorkDays);

  const savedGoalLabel = goalSetLabel(stats.goalSetAt);

  const handleSave = useCallback((mins, meta) => {
    // ANCHORED-GOAL: target + anchor in one write (set date, worked-so-far base,
    // per-workday commitment for the next month's re-derivation).
    const written = bankGoal({
      targetMinutes: mins,
      workDays: meta?.workDays ?? goalWorkDays,
      perWorkdayMinutes: meta?.perWorkdayMinutes ?? 0,
      baseMinutes: meta?.baseMinutes ?? monthlyBanked,
    });
    const setLabel = goalSetLabel(written?.goalSetAt) || 'today';
    setSavedFlash(`Banked ${Math.round(mins)}m/mo · counts from ${setLabel}` +
      ` (${daysPerWeekOf(meta?.workDays || goalWorkDays)}/wk basis)`);
    window.setTimeout(() => setSavedFlash(''), 4000);
    // Stay in the view — the calendar + pace card now reflect the saved goal.
  }, [bankGoal, goalWorkDays, monthlyBanked]);

  /**
   * One-click rescue for the two things a hot reload wipes that hurt most:
   * the banked goal and this month's minutes. Deliberately NOT the greetings
   * scope — that is megabytes of audio and belongs in Settings → Data.
   */
  const handleBackup = useCallback(async () => {
    try {
      const { filename, bytes } = await downloadAppBackup({ scopes: ['goals', 'progress'] });
      setBackupFlash(`✔ ${filename} · ${formatBytes(bytes)}`);
    } catch (err) {
      setBackupFlash(`⚠ backup failed: ${err.message}`);
    }
    window.setTimeout(() => setBackupFlash(''), 6000);
  }, []);

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
            {savedGoalLabel && !isPreviewing && <> since <b style={{ color: '#c4b5fd' }}>{savedGoalLabel}</b></>}
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
        {backupFlash && (
          <span id="goal-backup-flash" className="goal-pace-card__flash">{backupFlash}</span>
        )}
        <span className="goal-pace-card__right">
          <span style={{ fontSize: '0.6rem', opacity: 0.6, color: 'var(--text-muted)' }}>{APP_VERSION_LABEL}</span>
          <button
            type="button"
            id="goal-view-backup-btn"
            onClick={handleBackup}
            title="Download goal + month progress as one small file (no audio). Restore it from Settings → Data if a hot reload wipes this browser."
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#93c5fd', borderRadius: '8px', padding: '0.35rem 0.55rem',
              fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⤓ Backup
          </button>
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
            savedGoalSetAt={stats.goalSetAt || null}
            savedGoalBaseMinutes={stats.goalBaseMinutes || 0}
            // ANCHORED-GOAL follow-up: the saved COMMITMENT, so re-opening the
            // configurator lands on the row that was actually banked.
            committedPerWorkdayMinutes={stats.goalPerWorkdayMinutes || 0}
            committedWorkDays={stats.goalWorkDays || 0}
          />
        </div>
        <div className="goal-tracking-calendar">
          <MonthCalendarPanel previewGoalMinutes={preview?.monthlyMinutes ?? null} workDays={previewWorkDays} />
        </div>
      </div>
    </div>
  );
};
