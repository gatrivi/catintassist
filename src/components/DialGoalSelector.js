import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { APP_VERSION_LABEL } from '../constants/version';
import { computeCatchUp, fmtHm, monthBasis } from '../utils/catchUpPlan';
import {
  deriveBankTargetMinutes, perWorkdayFromTarget, anchorForCatchUp, goalSetLabel,
  savedGoalWorkDays, perWorkdayFromStats, weeklyHoursFromCommitment,
} from '../utils/goalAnchor';
// v4.162.0 — undo for the two destructive writes, plus the guard that stops an
// emptied "banked/mo" box from writing 0. The snapshots themselves are taken in
// SessionContext (bankGoal / reconcileMonthTotal), so any other caller of those
// is covered too, not just this panel.
import {
  readStatUndo, parseMinuteCorrection, formatMinuteChange,
} from '../utils/statUndo';

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
  ratePerMinute, arsRate, arsRateFetchedAt = null, onRefreshArs = null,
  initialGoalMinutes, initialWorkDays = 28,
  monthlyMinutes = 0, dailyMinutes = 0,
  bankedMonthOverride = null, // when set, shows "banked" editor row value
  onSaveMonth = null, // (mins) => void — 2-click month-total correction
  onResyncMonth = null, // () => {sum, applied} — re-sum daily log
  resyncInfo = null, // {sum} — what re-sum would write (for preview)
  onUndoStat = null, // v4.162.0: () => restoredStats | null
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

  /**
   * Which dial row the dial OPENS on — the commitment that was banked, never a
   * value reverse-derived from the prorated month total. (Deriving it from the
   * month turned a 35h/Wk goal banked on the 20th into "20h/Wk", and re-banking
   * silently downgraded it.) Shared by the mount seed and by Discard.
   */
  const seedIndexForCommitted = useCallback(() => {
    if (!(initialGoalMinutes > 0)) return 4; // no goal yet → default 40h
    const commitment = perWorkdayFromStats(
      { goalPerWorkdayMinutes: committedPerWorkdayMinutes, goalMinutes: initialGoalMinutes },
      { workDays: initialBasis },
    );
    return nearestTargetIndex(weeklyHoursFromCommitment(commitment, daysPerWeekOf(initialBasis)));
  }, [initialGoalMinutes, committedPerWorkdayMinutes, initialBasis, nearestTargetIndex]);

  const [activeIndex, setActiveIndex] = useState(seedIndexForCommitted);

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

  /**
   * v4.163.0 — the wheel was a <div onClick>: unreachable by keyboard, no role,
   * no value. It is a single-value control, so it is a SLIDER (weekly hours),
   * which is also how it behaves: arrows step, Home/End jump to the ends,
   * PageUp/PageDown jump four rows.
   */
  const onWheelKeyDown = (e) => {
    const jump = (to) => {
      e.preventDefault();
      const next = Math.min(targets.length - 1, Math.max(0, to));
      if (next !== activeIndex) { setActiveIndex(next); setCustomMonth(''); audioEngine.playTick(1); }
    };
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); step(1); return; }
    if (e.key === 'PageUp') { jump(activeIndex - 4); return; }
    if (e.key === 'PageDown') { jump(activeIndex + 4); return; }
    if (e.key === 'Home') { jump(0); return; }
    if (e.key === 'End') { jump(targets.length - 1); }
  };

  // v4.163.0: the wrapper had tabIndex={0} but nothing ever focused it, so the
  // arrow keys only worked after a manual Tab and nobody knew that. Put the
  // focus on the wheel itself, which is the control you came here to move.
  const wheelRef = useRef(null);
  useEffect(() => {
    const el = wheelRef.current;
    if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
  }, []);

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

  // v4.162.0 — nothing is written from this panel without showing the change
  // and asking once. Three states, one variable:
  //   null            nothing pending
  //   'bank'          Bank Goal is armed, waiting for Yes
  //   'resync'        re-sum is armed, waiting for Yes
  //   'month'         banked/mo Set is armed
  const [armed, setArmed] = useState(null);
  const [note, setNote] = useState(null); // { tone, text }
  const [undoInfo, setUndoInfo] = useState(null); // { label, savedAt }

  // An undo survives a reload — the mistake is usually noticed a beat later.
  useEffect(() => {
    const snap = readStatUndo();
    if (snap) setUndoInfo({ label: snap.label, savedAt: snap.savedAt });
  }, []);

  const finishWrite = (label) => {
    const snap = readStatUndo();
    if (snap) setUndoInfo({ label: snap.label, savedAt: snap.savedAt });
    setArmed(null);
    setNote({ tone: 'ok', text: `${label} applied. Undo is below if it was wrong.` });
  };

  /**
   * "banked/mo" Set. An emptied field used to write 0 and wipe the month,
   * because Number('') === 0 passes a >= 0 check. Now it refuses.
   */
  const handleSetMonth = () => {
    const v = parseMinuteCorrection(monthEdit);
    if (v === null) {
      setArmed(null);
      setNote({ tone: 'warn', text: 'Type a number of minutes first — an empty box is not a request to zero the month.' });
      return;
    }
    if (v === Math.round(Number(monthlyMinutes) || 0)) {
      setNote({ tone: 'warn', text: 'That is already the banked month total.' });
      return;
    }
    if (armed !== 'month') {
      setArmed('month');
      setNote({ tone: 'warn', text: `About to set banked month to ${formatMinuteChange(monthlyMinutes, v)} — press again to confirm.` });
      return;
    }
    onSaveMonth?.(v);
    finishWrite(`Set month ${v}m`);
  };

  const handleResync = () => {
    const sum = resyncInfo?.sum;
    if (!Number.isFinite(Number(sum))) {
      setNote({ tone: 'warn', text: 'The daily log has nothing to re-sum yet.' });
      return;
    }
    if (armed !== 'resync') {
      setArmed('resync');
      setNote({ tone: 'warn', text: `Re-sum month: ${formatMinuteChange(monthlyMinutes, sum)} — press again to confirm.` });
      return;
    }
    onResyncMonth?.();
    finishWrite(`Re-summed month to ${sum}m`);
  };

  const handleUndo = () => {
    const restored = onUndoStat?.();
    if (!restored) {
      setUndoInfo(null);
      setNote({ tone: 'warn', text: 'Nothing left to undo.' });
      return;
    }
    setUndoInfo(null);
    setArmed(null);
    setNote({ tone: 'ok', text: `Undone — month total back to ${Math.round(restored.monthlyMinutes || 0)}m.` });
  };

  const handleApply = () => {
    const current = Math.round(Number(initialGoalMinutes) || 0);
    if (armed !== 'bank') {
      setArmed('bank');
      setNote({
        tone: 'warn',
        text: `Bank goal: ${formatMinuteChange(current, effectiveMonthly)} on the ${daysPerWeek}/wk basis — press again to confirm.`,
      });
      return;
    }
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
    setArmed(null);
    const snap = readStatUndo();
    if (snap) setUndoInfo({ label: snap.label, savedAt: snap.savedAt });
    setNote({ tone: 'ok', text: `Banked ${Math.round(effectiveMonthly)}m/mo. Undo is below if it was wrong.` });
  };

  /**
   * v4.162.0 — "Discard" is not "leave". It used to call onCancel, which exits
   * the whole goals view and throws away every edit, including the minutes you
   * had already committed. It now resets the dial to what is actually banked
   * and stays put.
   */
  const handleDiscard = () => {
    setArmed(null);
    setCustomMonth('');
    setWorkDays(initialBasis);
    setMonthEdit(String(bankedMonthOverride ?? Math.round(monthlyMinutes || 0)));
    setActiveIndex(seedIndexForCommitted());
    // null tells the parent to fall back to the numbers it already has banked.
    onPreview?.(null);
    setNote({ tone: 'ok', text: 'Changes discarded. Your banked goal is untouched.' });
  };

  return (
    <div
      role="dialog"
      aria-label={`Goal configurator ${APP_VERSION_LABEL}`}
      tabIndex={0}
      className={`dial-goal-selector${modal ? ' dial-goal-selector--modal' : ''}`}
      onKeyDown={(e) => {
        // v4.162.0: the handler sat on the wrapper, so ↑/↓ inside a number field
        // moved the dial AND wiped what you were typing (step() clears the custom
        // override). A number field — or the wheel itself, which handles its own
        // keys — owns its arrows.
        const t = e.target;
        const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (!typing && t !== wheelRef.current) {
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        }
        if (e.key === 'Escape') {
          // Stop here: App.js also listens for Escape to leave the goals view,
          // so without this one keypress fired both.
          e.stopPropagation();
          onCancel?.();
        }
      }}
    >
      <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Goal Configurator <span id="goal-config-version-pill" style={{ fontSize: '0.6rem', opacity: 0.6 }}>{APP_VERSION_LABEL}</span>
      </h4>

      {/* v4.100.0: catch-up preview — "how much per day to get back?"
          ANCHORED-GOAL: also spells out WHAT gets banked and why, so a
          mid-month goal is never a surprise number. */}
      {catchUp && (
        <div
          className="dial-catchup"
          // v4.163.0: this box is the answer to "am I doing enough", and it
          // changed silently every time the dial moved.
          aria-live="polite"
        >
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
          ref={(el) => { scrollRef.current = el; wheelRef.current = el; }}
          onScroll={handleScroll}
          onKeyDown={onWheelKeyDown}
          // v4.163.0: one value, so a slider — not a pile of divs. The rows stay
          // clickable for the mouse, but the value is announced once, here,
          // instead of 17 times.
          role="slider"
          tabIndex={0}
          aria-label="Weekly commitment hours"
          aria-valuemin={targets[0]}
          aria-valuemax={targets[targets.length - 1]}
          aria-valuenow={selectedWeeklyHours}
          aria-valuetext={`${selectedWeeklyHours} hours per week · ${dailyMins} minutes a day · ${Math.round(effectiveMonthly)}m a month`}
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
          className="dial-wheel"
          // Only the row padding stays inline: it is derived from itemHeight.
          style={{ paddingTop: `${itemHeight}px`, paddingBottom: `${itemHeight}px` }}
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
              type="button"
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
      <div className="dial-field">
        <label htmlFor="dial-monthly-mins" className="dial-field-label">🎯 Monthly mins</label>
        <input
          id="dial-monthly-mins"
          type="number" min="0" max="30000" step="50"
          aria-label="Monthly goal minutes (direct input)"
          value={customMonth}
          onChange={(e) => setCustomMonth(e.target.value)}
          onBlur={applyCustomToDial}
          placeholder={`${dialTargetMins}m`}
          className="dial-field-input"
        />
        {customMonth !== '' && (
          <span className="dial-field-note">custom → {Math.round(Number(customMonth) || 0)}m/mo</span>
        )}
      </div>

      {/* v4.100.0: banked month-total quick correction (goal 1). */}
      {onSaveMonth && (
        <div className="dial-field">
          <label htmlFor="dial-banked-month" className="dial-field-label">banked/mo</label>
          <input
            id="dial-banked-month"
            type="number" min="0" max="30000" step="1"
            aria-label="Banked month total minutes (correction)"
            value={monthEdit}
            onChange={(e) => setMonthEdit(e.target.value)}
            className="dial-field-input is-money"
          />
          <button type="button" className="dial-mini-btn is-set" onClick={handleSetMonth}>
            {armed === 'month' ? 'Confirm?' : 'Set'}
          </button>
          {onResyncMonth && (
            <button
              type="button"
              className="dial-mini-btn"
              onClick={handleResync}
              title={resyncInfo ? `Daily log sums to ${resyncInfo.sum}m — click, then confirm` : 'Re-sum month from daily log'}
            >{armed === 'resync' ? 'Confirm?' : resyncInfo ? `↻ log=${resyncInfo.sum}m` : '↻ re-sum'}</button>
          )}
        </div>
      )}

      <div
        className="dial-ladder"
        data-tier={ladderTier}
        // v4.163.0: the tier and step changed silently on every dial move.
        aria-live="polite"
      >
        <div className="dial-ladder-head">
          {ladderTier === 'TRAINING' ? '🐾 Training Mode' : ladderTier === 'FLOOR' ? '🪜 Step Achiever (Floor)' : ladderTier === 'GROWTH' ? '🚀 Pacing Growth' : '👑 Legendary Hustle'}
          <span className="dial-ladder-step">[The Pro Ladder: Step {ladderStep}/12]</span>
        </div>
        <div className="dial-ladder-body">
          At {selectedWeeklyHours}h/Wk × {daysPerWeek}d/wk you reach <strong style={{ color: ladderColor }}>AR${Math.round(monthlyMins * ratePerMinute * arsRate).toLocaleString('es-AR')}</strong> in a full month ({monthlyMins}m).
          <br />Expect to grind <strong style={{ color: '#fff' }}>{dailyHours}h {dailyMinsRem}m</strong> per active day
          {' '}({customActive
            ? <>{Math.round(effectiveMonthly)}m/mo custom goal</>
            : <>{effectiveMonthly}m to bank today · {fmtHm(bankedMins)} already worked</>}).
        </div>
      </div>

      {/* v4.162.0: the ARS rate is a LIVE feed (SessionContext fetches it on
          mount), never a setting. It used to be an editable box that was never
          persisted, was clobbered by the next fetch, and made every $ in the app
          read $0 the moment you cleared it. Read-only + a manual refresh. */}
      <div className="dial-field">
        <span className="dial-field-label">💱 ARS rate</span>
        <strong className="dial-field-value">
          {Math.round(Number(arsRate) || 0).toLocaleString('es-AR')}
        </strong>
        <span className="dial-field-note">
          live{arsRateFetchedAt ? ` · ${new Date(arsRateFetchedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
        {onRefreshArs && (
          <button
            type="button"
            onClick={onRefreshArs}
            title="Fetch the USD→ARS rate again"
            aria-label="Refresh the ARS exchange rate"
            className="dial-mini-btn is-refresh"
          >↻</button>
        )}
      </div>

      {/* v4.162.0: every write in this panel says what it is about to do, asks
          once, and can be taken back afterwards.
          v4.163.0: this block is STICKY to the bottom of the scrolling pane. At
          900x600 the content is ~600px in a ~520px column, so Bank Goal — the
          one control that must always be reachable — used to sit below the fold. */}
      <div className="dial-actions">
        <div className="dial-actions-inner">
          {note && (
            <div
              role="status"
              className={`dial-note${note.tone === 'warn' ? ' is-warn' : ''}`}
            >
              {note.text}
            </div>
          )}

          {undoInfo && onUndoStat && (
            <div className="dial-undo">
              <span>Last change: {undoInfo.label}</span>
              <button type="button" className="dial-undo-btn" onClick={handleUndo}>
                ↩ Undo it
              </button>
            </div>
          )}

          <div className="dial-actions-row">
            <button type="button" className="btn dial-discard" onClick={handleDiscard}>
              Discard
            </button>
            <button type="button" className="btn btn-primary" onClick={handleApply}>
              {armed === 'bank' ? 'Confirm bank?' : `Bank Goal: ${Math.round(effectiveMonthly)}m/Mo`}
            </button>
          </div>
          {/* No second "leave" button here: the view header already has
              "← Back to work" and Escape does the same. This panel's only job
              now is Discard (drop the edits, stay) and Bank (commit them). */}
        </div>
      </div>
    </div>
  );
};

const stepBtn = {
  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)',
  color: '#c4b5fd', borderRadius: '6px', padding: '0.3rem 0.5rem',
  fontSize: '0.7rem', cursor: 'pointer', fontWeight: 800,
};
