import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { APP_VERSION_LABEL } from '../constants/version';
import { computeCatchUp, fmtHm, monthBasis } from '../utils/catchUpPlan';
import {
  deriveBankTargetMinutes, perWorkdayFromTarget, anchorForCatchUp, goalSetLabel,
  savedGoalWorkDays, perWorkdayFromStats, weeklyHoursFromCommitment,
} from '../utils/goalAnchor';

// v4.100.0 rehab: snap uses the REAL workdays (not hardcoded 5d/wk),
// 6.5/wk option, direct monthly input, live catch-up preview, version tag.
// Invariant: WEEKLY commitment is locked; daily + monthly follow workdays.
// ANCHORED-GOAL: the number BANKED counts from today (worked so far +
// commitment × workdays left), not a full-month quota you never committed to.
// Follow-up: the dial + ladder read the STORED commitment (goalPerWorkdayMinutes)
// so re-opening after a mid-month bank lands on the committed row, not on the
// prorated month total ÷ workdays.
export const WORK_DAY_OPTS = [
  { label: '4/Wk', sub: '17d', val: 17, perWk: 4 },
  { label: '5/Wk', sub: '22d', val: 22, perWk: 5 },
  { label: '6/Wk', sub: '26d', val: 26, perWk: 6 },
  { label: '6.5/Wk', sub: '28d', val: 28, perWk: 6.5 },
  { label: 'Grind', sub: '30d', val: 30, perWk: 7 },
];

export const daysPerWeekOf = (workDays) => {
  const hit = WORK_DAY_OPTS.find((o) => o.val === workDays);
  return hit ? hit.perWk : 5;
};

export const DialGoalSelector = ({
  ratePerMinute, arsRate, setArsRate, initialGoalMinutes, initialWorkDays = 28,
  monthlyMinutes = 0, dailyMinutes = 0,
  bankedMonthOverride = null, // when set, shows "banked" editor row value
  onSaveMonth = null, // (mins) => void — 2-click month-total correction
  onResyncMonth = null, // () => {sum, applied} — re-sum daily log
  resyncInfo = null, // {sum} — what re-sum would write (for preview)
  onSave, onCancel, modal = false,
  // v4.113.0: live (unsaved) selection → parent view, e.g. { monthlyMinutes, workDays, daysPerWeek }.
  onPreview = null,
  // ANCHORED-GOAL: anchor of the SAVED goal (stats.goalSetAt / goalBaseMinutes).
  savedGoalSetAt = null, savedGoalBaseMinutes = 0,
  // ANCHORED-GOAL follow-up: the saved COMMITMENT (stats.goalPerWorkdayMinutes /
  // stats.goalWorkDays). The dial snaps to IT — never to the prorated month total.
  committedPerWorkdayMinutes = 0, committedWorkDays = 0,
}) => {
  const audioEngine = useProgressiveAudio();

  // Weekly-hours dial: 20h–100h in 5h steps.
  const targets = useMemo(() => {
    return Array.from({ length: 17 }, (_, i) => 20 + (i * 5)); // 20, 25, 30... 100
  }, []);

  // Workdays basis the dial OPENS on: the one the goal was banked with (it is
  // part of the commitment — daily = weekly / dpw), else the basis from outside,
  // else the 28d default.
  const initialBasis = useMemo(() => {
    const saved = savedGoalWorkDays({ goalWorkDays: committedWorkDays }, initialWorkDays);
    return WORK_DAY_OPTS.some((o) => o.val === saved) ? saved : 28;
  }, [committedWorkDays, initialWorkDays]);

  const [workDays, setWorkDays] = useState(initialBasis);
  const daysPerWeek = daysPerWeekOf(workDays);

  /** Nearest weekly-hours dial row (rows are a 5h grid, 20h…100h). */
  const nearestTargetIndex = useCallback((hours) => {
    let best = 0;
    let bestDiff = Infinity;
    targets.forEach((hrs, i) => {
      const d = Math.abs(hrs - hours);
      if (d < bestDiff) { bestDiff = d; best = i; }
    });
    return best;
  }, [targets]);

  const [activeIndex, setActiveIndex] = useState(() => {
    if (!(initialGoalMinutes > 0)) return 4; // no goal yet → default 40h
    // ANCHORED-GOAL follow-up: re-open on the COMMITMENT that was banked.
    // Reverse-deriving it from the (prorated) month total turned a 35h/Wk
    // commitment banked on the 20th into "20h/Wk" — re-banking silently
    // downgraded it.
    const commitment = perWorkdayFromStats(
      { goalPerWorkdayMinutes: committedPerWorkdayMinutes, goalMinutes: initialGoalMinutes },
      { workDays: initialBasis },
    );
    return nearestTargetIndex(weeklyHoursFromCommitment(commitment, daysPerWeekOf(initialBasis)));
  });

  const scrollRef = useRef(null);
  const itemHeight = 44;
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    if (scrollRef.current && !isUserScrolling.current) {
      scrollRef.current.scrollTop = activeIndex * itemHeight;
    }
  }, [activeIndex, itemHeight]);

  const handleScroll = (e) => {
    if (!isUserScrolling.current) return;
    const top = e.target.scrollTop;
    const index = Math.min(targets.length - 1, Math.max(0, Math.round(top / itemHeight)));
    if (index !== activeIndex) {
      setActiveIndex(index);
      setCustomMonth(''); // dial move clears custom override
      audioEngine.playTick(1);
    }
  };

  const step = (d) => {
    setActiveIndex((i) => Math.min(targets.length - 1, Math.max(0, i + d)));
    setCustomMonth('');
    audioEngine.playTick(1);
  };

  const selectedWeeklyHours = targets[activeIndex];
  const weeklyMins = selectedWeeklyHours * 60;

  // Weekly commitment locked; daily + monthly follow workdays.
  const dailyMins = Math.round(weeklyMins / daysPerWeek);
  const monthlyMins = Math.round(dailyMins * workDays); // FULL-month equivalent (ladder card, AR$)

  // ANCHORED-GOAL: today's working numbers.
  // bankedMins = what is already worked this month; the banked target only
  // covers the workdays that are LEFT, so it can never ask for days that are gone.
  const bankedMins = Math.max(0, Math.round(Number(monthlyMinutes) || 0));
  const { remainingWorkdays } = monthBasis({ workDays });
  const dialTargetMins = deriveBankTargetMinutes({
    bankedMinutes: bankedMins, perWorkdayMinutes: dailyMins, workDays,
  });

  // v4.100.0: direct monthly-minutes input, two-way with the dial.
  const [customMonth, setCustomMonth] = useState('');
  const customActive = customMonth !== '' && Number(customMonth) > 0;
  // What the Bank button writes and the previews judge:
  //  · dial  → worked so far + commitment × workdays left
  //  · custom → the literal month total the user typed
  const effectiveMonthly = customActive ? Math.round(Number(customMonth)) : dialTargetMins;
  // Per-workday commitment this target implies (custom totals included).
  const perWorkdayTarget = customActive
    ? perWorkdayFromTarget({ targetMinutes: effectiveMonthly, bankedMinutes: bankedMins, workDays })
    : dailyMins;

  // v4.113.0: one effect covers every change path (step/scroll/click/frequency/custom).
  // Fires on mount too so the Goal Tracking view's pace card starts populated.
  useEffect(() => {
    if (!onPreview) return;
    onPreview({ monthlyMinutes: effectiveMonthly, workDays, daysPerWeek: daysPerWeekOf(workDays) });
  }, [effectiveMonthly, workDays, onPreview]);
  const applyCustomToDial = () => {
    const v = Number(customMonth);
    if (!Number.isFinite(v) || v <= 0) return;
    // Find dial row whose monthly is closest at current workdays.
    let best = 0; let diff = Infinity;
    targets.forEach((hrs, i) => {
      const d = Math.round(Math.round((hrs * 60) / daysPerWeek) * workDays);
      if (Math.abs(d - v) < diff) { diff = Math.abs(d - v); best = i; }
    });
    setActiveIndex(best);
  };

  // v4.100.0: live catch-up preview for the EFFECTIVE monthly goal.
  // ANCHORED-GOAL: the pace clock starts now (or keeps the saved anchor when the
  // number is the saved one) — judging a brand-new goal against the 1st is what
  // made this feature useless on the 20th.
  const anchor = anchorForCatchUp({
    targetMinutes: effectiveMonthly,
    bankedMinutes: bankedMins,
    savedGoalMinutes: initialGoalMinutes,
    savedGoalSetAt,
    savedGoalBaseMinutes,
  });
  const anchorSetAt = anchor ? anchor.goalSetAt : null;
  const anchorBaseMins = anchor ? anchor.goalBaseMinutes : 0;
  const anchorIsSaved = !!savedGoalSetAt && anchorSetAt === savedGoalSetAt;
  const catchUp = useMemo(() => {
    if (!(effectiveMonthly > 0)) return null;
    try {
      return computeCatchUp({
        goalMinutes: effectiveMonthly, monthlyMinutes, dailyMinutes, workDays,
        ...(anchor || {}),
      });
    } catch { return null; }
  }, [effectiveMonthly, monthlyMinutes, dailyMinutes, workDays, anchorSetAt, anchorBaseMins]); // eslint-disable-line react-hooks/exhaustive-deps

  const dailyHours = Math.floor(dailyMins / 60);
  const dailyMinsRem = dailyMins % 60;

  // ANCHORED-GOAL follow-up: the ladder badge describes the COMMITMENT's
  // monthly ambition (the full-month equivalent), not the prorated mid-month
  // bank target — otherwise a 35h/Wk goal banked on the 20th showed
  // "Training Mode / Step 2/12" right above the sentence "in a full month (9240m)".
  const ladderMonthly = customActive ? Math.round(effectiveMonthly) : monthlyMins;
  const ladderStep = Math.min(12, Math.max(1, Math.floor(ladderMonthly / 1375) + (ladderMonthly % 1375 > 1300 ? 1 : 0) || 1));
  const ladderTier = ladderMonthly >= 16500 ? 'LEGEND' : ladderMonthly >= 11000 ? 'GROWTH' : ladderMonthly >= 5500 ? 'FLOOR' : 'TRAINING';
  const ladderColor = ladderTier === 'LEGEND' ? '#FCD34D' : ladderTier === 'GROWTH' ? '#A855F7' : ladderTier === 'FLOOR' ? '#3B82F6' : '#94A3B8';

  const [monthEdit, setMonthEdit] = useState('');
  useEffect(() => {
    setMonthEdit(String(bankedMonthOverride ?? Math.round(monthlyMinutes || 0)));
  }, [bankedMonthOverride, monthlyMinutes]);

  const handleApply = () => {
    audioEngine.playCarriageVault();
    // ANCHORED-GOAL: the month total + everything the parent needs to anchor it
    // (set date, minutes worked at bank time, per-workday commitment for next month).
    onSave(effectiveMonthly, {
      workDays,
      weeklyHours: selectedWeeklyHours,
      perWorkdayMinutes: perWorkdayTarget,
      baseMinutes: bankedMins,
      fullMonthMinutes: monthlyMins,
      custom: customActive,
    });
  };

  return (
    <div
      role="dialog"
      aria-label={`Goal configurator ${APP_VERSION_LABEL}`}
      tabIndex={0}
      className={`dial-goal-selector${modal ? ' dial-goal-selector--modal' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        if (e.key === 'Escape') onCancel?.();
      }}
    >
      <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Goal Configurator <span id="goal-config-version-pill" style={{ fontSize: '0.6rem', opacity: 0.6 }}>{APP_VERSION_LABEL}</span>
      </h4>

      {/* v4.100.0: catch-up preview — "how much per day to get back?"
          ANCHORED-GOAL: also spells out WHAT gets banked and why, so a
          mid-month goal is never a surprise number. */}
      {catchUp && (
        <div style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.7rem', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', color: '#fde68a' }}>
          {catchUp.deficitMins > 30 ? (
            <span>📉 behind {fmtHm(catchUp.deficitMins)} · today → <strong>{fmtHm(catchUp.needToday)}</strong> · then {fmtHm(catchUp.thenPerDay)}/day × {catchUp.daysAfter}d</span>
          ) : catchUp.deficitMins < -30 ? (
            <span>📈 ahead {fmtHm(-catchUp.deficitMins)} · today → <strong>{fmtHm(catchUp.needToday)}</strong></span>
          ) : (
            <span>✅ on pace · today → <strong>{fmtHm(catchUp.needToday)}</strong></span>
          )}
          <br />
          <span style={{ opacity: 0.85 }}>
            {customActive ? (
              <>custom <strong>{effectiveMonthly}m</strong> − {fmtHm(bankedMins)} worked over <strong>{remainingWorkdays}</strong> workdays left
                {' '}= <strong>{fmtHm(Math.max(0, effectiveMonthly - bankedMins))}</strong> to go ({fmtHm(Math.max(0, perWorkdayTarget))}/workday)</>
            ) : (
              <>banked goal <strong>{effectiveMonthly}m</strong> = worked {fmtHm(bankedMins)} + <strong>{remainingWorkdays}</strong> workdays
                {' '}× <strong>{fmtHm(dailyMins)}</strong> ({daysPerWeek}/wk basis)</>
            )}
          </span>
          <br />
          <span style={{ opacity: 0.7 }}>
            {anchorIsSaved
              ? <>counts from <strong>{goalSetLabel(savedGoalSetAt) || 'today'}</strong> (mid-month goals skip the days already gone)</>
              : <>starts counting <strong>today</strong> if you bank it</>}
            {' '}· full month @ {workDays}d basis: <strong>{monthlyMins}m</strong> ({fmtHm(dailyMins)} × {workDays}d)
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button type="button" onClick={() => step(-1)} aria-label="Lower weekly commitment" style={stepBtn}>◀</button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#94a3b8', textTransform: 'uppercase', padding: '0 0.5rem', fontWeight: 700 }}>
          <span style={{ flex: 1, textAlign: 'center' }}>Commitment</span>
          <span style={{ flex: 1, textAlign: 'center' }}>Daily Time</span>
          <span style={{ flex: 1, textAlign: 'center' }}>Daily ARS</span>
          <span style={{ flex: 1, textAlign: 'center' }}>Monthly Goal</span>
        </div>
        <button type="button" onClick={() => step(1)} aria-label="Raise weekly commitment" style={stepBtn}>▶</button>
      </div>

      <div style={{ position: 'relative', height: `${itemHeight * 3}px`, overflow: 'hidden', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{
          position: 'absolute', top: `${itemHeight}px`, left: 0, right: 0, height: `${itemHeight}px`,
          background: 'rgba(139, 92, 246, 0.2)', borderTop: '1px solid rgba(139, 92, 246, 0.4)', borderBottom: '1px solid rgba(139, 92, 246, 0.4)',
          pointerEvents: 'none', zIndex: 10
        }} />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onWheel={() => {
            isUserScrolling.current = true;
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
            scrollTimeout.current = setTimeout(() => { isUserScrolling.current = false; }, 500);
          }}
          onMouseDown={(e) => {
            isUserScrolling.current = true;
            const el = scrollRef.current;
            el.dataset.isDragging = true;
            el.dataset.startY = e.pageY - el.offsetTop;
            el.dataset.scrollTop = el.scrollTop;
            el.style.scrollBehavior = 'auto';
            el.style.scrollSnapType = 'none';
          }}
          onMouseLeave={() => {
            const el = scrollRef.current;
            if (el) { el.dataset.isDragging = false; el.style.scrollBehavior = 'smooth'; el.style.scrollSnapType = 'y mandatory'; }
            setTimeout(() => { if (isUserScrolling.current) isUserScrolling.current = false; }, 500);
          }}
          onMouseUp={() => {
            const el = scrollRef.current;
            if (el) { el.dataset.isDragging = false; el.style.scrollBehavior = 'smooth'; el.style.scrollSnapType = 'y mandatory'; }
            setTimeout(() => { if (isUserScrolling.current) isUserScrolling.current = false; }, 500);
          }}
          onMouseMove={(e) => {
            const el = scrollRef.current;
            if (el.dataset.isDragging !== 'true') return;
            e.preventDefault();
            const y = e.pageY - el.offsetTop;
            const walk = (y - parseFloat(el.dataset.startY)) * 1.5;
            el.scrollTop = parseFloat(el.dataset.scrollTop) - walk;
          }}
          style={{
            height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth', userSelect: 'none',
            paddingTop: `${itemHeight}px`, paddingBottom: `${itemHeight}px`,
            scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-y'
          }}
        >
          {targets.map((hrs, idx) => {
            const distance = Math.abs(idx - activeIndex);
            const scale = distance === 0 ? 1 : distance === 1 ? 0.9 : 0.8;
            const opacity = distance === 0 ? 1 : distance === 1 ? 0.6 : 0.3;

            const rWeeklyMins = hrs * 60;
            const rDailyMins = Math.round(rWeeklyMins / daysPerWeek);
            const rMonthMins = Math.round(rDailyMins * workDays);
            const rDailyCash = rDailyMins * ratePerMinute * arsRate;
            const rMonthCash = rMonthMins * ratePerMinute * arsRate;

            const isFloor = rMonthMins >= 5500 && rMonthMins < 5600;
            const isGrowth = rMonthMins >= 11000 && rMonthMins < 11100;
            const isLegend = rMonthMins >= 16500 && rMonthMins < 16600;

            return (
              <div key={hrs} onClick={() => { setActiveIndex(idx); setCustomMonth(''); scrollRef.current.scrollTop = idx * itemHeight; }} style={{
                height: `${itemHeight}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                scrollSnapAlign: 'center', fontSize: '0.8rem', fontWeight: distance === 0 ? 800 : 500,
                color: distance === 0 ? '#a855f7' : 'var(--text-muted)', cursor: 'pointer',
                transform: `scale(${scale})`, opacity, transition: 'all 0.15s ease-out', width: '100%', padding: '0 0.2rem', boxSizing: 'border-box',
                position: 'relative'
              }}>
                <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: distance === 0 ? '1rem' : '0.8rem' }}>{hrs}h/Wk</span>
                  {distance === 0 && <span style={{ fontSize: '0.5rem', opacity: 0.8, color: ladderColor }}>{ladderTier}</span>}
                </div>
                <span style={{ flex: 1, textAlign: 'center' }}>{Math.floor(rDailyMins / 60)}h {rDailyMins % 60}m</span>
                <span style={{ flex: 1, textAlign: 'center' }}>${Math.round(rDailyCash).toLocaleString('es-AR')}</span>
                <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                  <span style={{ color: distance === 0 ? '#34d399' : '' }}>${Math.round(rMonthCash).toLocaleString('es-AR')}</span>
                  {(isFloor || isGrowth || isLegend) && (
                    <div style={{
                      position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)',
                      fontSize: '0.5rem', padding: '1px 3px', borderRadius: '3px',
                      background: isLegend ? '#FCD34D' : (isGrowth ? '#A855F7' : '#3B82F6'),
                      color: '#000', fontWeight: 900, boxShadow: '0 0 5px rgba(255,255,255,0.2)'
                    }}>
                      {isLegend ? 'LEGEND' : (isGrowth ? 'GROWTH' : 'FLOOR')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workdays — weekly commitment stays locked, daily + monthly follow. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '0.2rem' }}>frequency: active days (weekly commitment locked)</div>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          {WORK_DAY_OPTS.map((opt) => (
            <button
              key={opt.val}
              onClick={() => setWorkDays(opt.val)}
              aria-pressed={workDays === opt.val}
              style={{
                flex: 1, padding: '0.4rem 0', borderRadius: '6px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem',
                background: workDays === opt.val ? 'rgba(56,189,248,0.2)' : 'rgba(0,0,0,0.3)',
                color: workDays === opt.val ? '#7dd3fc' : 'var(--text-muted)',
                border: workDays === opt.val ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s', transform: workDays === opt.val ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: workDays === opt.val ? 800 : 600 }}>{opt.label}</span>
              <span style={{ fontSize: '0.55rem', opacity: workDays === opt.val ? 0.9 : 0.6 }}>{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Direct monthly-minutes input — two-way with the dial. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>🎯 Monthly mins</span>
        <input
          type="number" min="0" max="30000" step="50"
          aria-label="Monthly goal minutes (direct input)"
          value={customMonth}
          onChange={(e) => setCustomMonth(e.target.value)}
          onBlur={applyCustomToDial}
          placeholder={`${dialTargetMins}m`}
          style={{ width: '90px', padding: '0.3rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.4)', color: '#fff', borderRadius: '6px' }}
        />
        {customMonth !== '' && (
          <span style={{ fontSize: '0.6rem', color: '#a855f7' }}>custom → {Math.round(Number(customMonth) || 0)}m/mo</span>
        )}
      </div>

      {/* v4.100.0: banked month-total quick correction (goal 1). */}
      {onSaveMonth && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>banked/mo</span>
          <input
            type="number" min="0" max="30000" step="1"
            aria-label="Banked month total minutes (correction)"
            value={monthEdit}
            onChange={(e) => setMonthEdit(e.target.value)}
            style={{ width: '90px', padding: '0.3rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(52,211,153,0.4)', color: '#fff', borderRadius: '6px' }}
          />
          <button
            type="button"
            onClick={() => { const v = Number(monthEdit); if (Number.isFinite(v) && v >= 0) onSaveMonth(Math.round(v)); }}
            style={{ background: '#34d399', border: 'none', color: '#022c22', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 800 }}
          >Set</button>
          {onResyncMonth && (
            <button
              type="button"
              onClick={() => onResyncMonth()}
              title={resyncInfo ? `Daily log sums to ${resyncInfo.sum}m — click to apply` : 'Re-sum month from daily log'}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
            >{resyncInfo ? `↻ log=${resyncInfo.sum}m` : '↻ re-sum'}</button>
          )}
        </div>
      )}

      <div style={{
        padding: '0.6rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.75rem',
        background: ladderTier === 'TRAINING' ? 'rgba(148,163,184,0.1)' : ladderTier === 'FLOOR' ? 'rgba(56,189,248,0.1)' : ladderTier === 'GROWTH' ? 'rgba(168,85,247,0.1)' : 'rgba(252,211,77,0.1)',
        border: `1px solid ${ladderColor}44`
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.2rem', color: ladderColor }}>
          {ladderTier === 'TRAINING' ? '🐾 Training Mode' : ladderTier === 'FLOOR' ? '🪜 Step Achiever (Floor)' : ladderTier === 'GROWTH' ? '🚀 Pacing Growth' : '👑 Legendary Hustle'}
          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', opacity: 0.8, color: '#fff' }}>[The Pro Ladder: Step {ladderStep}/12]</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)' }}>
          At {selectedWeeklyHours}h/Wk × {daysPerWeek}d/wk you reach <strong style={{ color: ladderColor }}>AR${Math.round(monthlyMins * ratePerMinute * arsRate).toLocaleString('es-AR')}</strong> in a full month ({monthlyMins}m).
          <br />Expect to grind <strong style={{ color: '#fff' }}>{dailyHours}h {dailyMinsRem}m</strong> per active day
          {' '}({customActive
            ? <>{Math.round(effectiveMonthly)}m/mo custom goal</>
            : <>{effectiveMonthly}m to bank today · {fmtHm(bankedMins)} already worked</>}).
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>💱 ARS Rate</span>
        <input
          type="number" step="any" className="stat-input"
          style={{ width: '80px', padding: '0.3rem', fontSize: '0.8rem' }}
          value={arsRate}
          onChange={(e) => setArsRate(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn" onClick={onCancel} style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', border: 'none' }}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleApply} style={{ flex: 2, padding: '0.5rem', fontSize: '0.85rem' }}>
          Bank Goal: {Math.round(effectiveMonthly)}m/Mo
        </button>
      </div>
    </div>
  );
};

const stepBtn = {
  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)',
  color: '#c4b5fd', borderRadius: '6px', padding: '0.3rem 0.5rem',
  fontSize: '0.7rem', cursor: 'pointer', fontWeight: 800,
};
