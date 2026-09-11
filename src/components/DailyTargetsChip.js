import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../constants/version';
import { computeCatchUp, fmtHm } from '../utils/catchUpPlan';

// v4.88.0: daily targets always visible in the status bar.
// Primary goal: $1200 USD/month. Fallback (rate floor): 5500 min/month.
const GOAL_USD = 1200;
const FALLBACK_MINUTES = 5500;

/** Shared math: how many minutes do I still need today (and this month) for the $1200 goal? */
export const computeGoalDay = ({ dailyMinutes = 0, monthlyMinutes = 0, ratePerMinute = 0.13 }) => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1);
  const minutesBeforeToday = Math.max(0, monthlyMinutes - dailyMinutes);
  const goalMinutes = GOAL_USD / ratePerMinute; // ~9231m for $1200 @ $0.13
  const remainingGoal = Math.max(0, goalMinutes - minutesBeforeToday);
  return {
    dailyMin: Math.round(remainingGoal / remainingDays),
    leftMin: Math.round(remainingGoal),
  };
};

/**
 * Endgame plan: on-call time still needed today for the $1200 pace,
 * plus how much time off still fits if you finish by 18:00 or 23:00.
 */
export const computeEndgamePlan = ({ doneMins = 0, goalDayMin = 0, now = new Date() }) => {
  const need = Math.max(0, Math.round(goalDayMin - doneMins));
  const minsUntil = (h) => {
    const t = new Date(now); t.setHours(h, 0, 0, 0);
    return Math.round((t - now) / 60000);
  };
  const to18 = minsUntil(18), to23 = minsUntil(23);
  return {
    need,
    by18Possible: need <= to18,
    slack18: Math.max(0, to18 - need),   // free time if finishing by 18h
    slack23: Math.max(0, to23 - need),   // free time if finishing by 23h
  };
};

export const formatEndgamePlan = (p) =>
  !p ? '' :
  p.need <= 0 ? '🏁 goal done — rest / bank buffer' :
  `🏁 need ${fmtHm(p.need)} on call · off≤18h: ${p.by18Possible ? fmtHm(p.slack18) : '—'} · off≤23h: ${fmtHm(p.slack23)}`;

const pairStyle = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: '0.2rem',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const valStyle = { fontSize: '0.78rem', fontWeight: 900, lineHeight: 1 };
const tgtStyle = { fontSize: '0.6rem', fontWeight: 700, opacity: 0.55 };
const lblStyle = { fontSize: '0.6rem', opacity: 0.7 };

/**
 * v4.88.3: readable status-bar strip — three current/target pairs:
 *   💵 $earned/$target · ⏱ on-call done/target · ☕ break taken/max-by-18h
 * Break target = what you can take in TOTAL today and still hit the
 * $1200-pace minutes by 18:00 (overtime to 23:00 is the fallback, shown on hover).
 */
export const DailyTargetsChip = ({
  dailyMinutes = 0,
  monthlyMinutes = 0,
  breakMinutes = 0,
  ratePerMinute = 0.13,
  goalMinutes = 0, // v4.96.0: real dial goal (stats.goalMinutes) — wins over the $1200 estimate
  workDays = 0, // v4.101.0: workday basis (e.g. 28 for 6.5/Wk) — catch-up spreads over workdays
  onOpenGoalDial = null, // v4.100.0: HUD goal pill acts as a button → inline dial
}) => {
  const usdGoal = computeGoalDay({ dailyMinutes, monthlyMinutes, ratePerMinute });
  // v4.96.0: today's target = month catch-up spread over remaining days
  // (same math as the dashboard catch-up strip → chip and dashboard always agree).
  const catchUp = goalMinutes > 0
    ? computeCatchUp({ goalMinutes, monthlyMinutes, dailyMinutes, workDays })
    : null;
  const dailyMin = catchUp ? catchUp.requiredToday : usdGoal.dailyMin;
  const leftMin = catchUp ? Math.max(0, goalMinutes - monthlyMinutes) : usdGoal.leftMin;
  const monthGoalMin = catchUp ? goalMinutes : Math.round(GOAL_USD / ratePerMinute);
  const earnedUsd = dailyMinutes * ratePerMinute;
  const targetUsd = dailyMin * ratePerMinute;
  const plan = computeEndgamePlan({ doneMins: dailyMinutes, goalDayMin: dailyMin });
  const breakTarget = breakMinutes + plan.slack18; // total break budget incl. already taken

  const minutesBeforeToday = Math.max(0, monthlyMinutes - dailyMinutes);
  const fbRemaining = Math.max(0, FALLBACK_MINUTES - minutesBeforeToday);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const fbDaily = Math.round(fbRemaining / Math.max(1, daysInMonth - now.getDate() + 1));

  const warn = plan.need > 0 && !plan.by18Possible;

  // v4.96.2: deficit pair text shared by the visible pair + hidden measurer
  const deficitText = (catchUp && Math.abs(catchUp.deficitMins) > 30)
    ? (catchUp.deficitMins > 0 ? `📉 −${fmtHm(catchUp.deficitMins)}` : `📈 +${fmtHm(-catchUp.deficitMins)}`)
    : null;

  // ── v4.96.2: width-aware degradation ──────────────────────────────────
  // The chip is nowrap/flexShrink:0, so on a narrow window it would overflow
  // onto the right-header buttons (STT:FAST / EN|ES). Drop low-priority pairs
  // first: 1 = hide ☕ break, 2 = also hide 💵 dollars. Hover tooltip keeps
  // every row, so no information is lost.
  // A hidden always-full measurer makes fitLevel a pure function of the box
  // width — recomputing it every render can never oscillate (no setState loop).
  const chipRef = useRef(null);
  const measureRef = useRef(null);
  const usdMeasureRef = useRef(null);
  const coffeeMeasureRef = useRef(null);
  const [fitLevel, setFitLevel] = useState(0);
  const checkFit = () => {
    const chip = chipRef.current;
    if (!chip) return;
    // measure against the flex box that actually constrains us, not just the
    // immediate parent (varies by mount: off-call row / call micro-bar / HUD)
    const box = chip.closest('.session-controls-center') || chip.parentElement;
    const full = measureRef.current;
    if (!box || !box.clientWidth || !full) return;
    const GAP = 11; // 0.7rem pair gap
    const wCoffee = (coffeeMeasureRef.current?.offsetWidth ?? 0) + GAP;
    const wUsd = (usdMeasureRef.current?.offsetWidth ?? 0) + GAP;
    const boxW = box.clientWidth;
    const fits = full.offsetWidth <= boxW;
    const fits1 = full.offsetWidth - wCoffee <= boxW;
    setFitLevel(fits ? 0 : (fits1 ? 1 : 2));
  };
  // re-check on every render — the chip re-renders 1Hz with the live counters,
  // so even if RO/resize miss an event, we self-heal within a second.
  useLayoutEffect(checkFit);
  useEffect(() => {
    const chip = chipRef.current;
    if (!chip) return;
    const ro = new ResizeObserver(checkFit);
    ro.observe(chip);
    if (chip.parentElement) ro.observe(chip.parentElement);
    window.addEventListener('resize', checkFit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', checkFit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── v4.91.0: SMART TOOLTIP ──────────────────────────────────────────────
  // Hover the chip → floating panel spells every chip out in USD:
  // earned vs target, minutes to go ≈ $, what a break minute costs, month pace.
  const [smartTip, setSmartTip] = useState(null); // {x,y} chip top-center
  const usd = (m) => `$${(m * ratePerMinute).toFixed(2)}`;
  const pctToday = targetUsd > 0 ? Math.round((earnedUsd / targetUsd) * 100) : 0;
  // v4.96.0: month-pace deficit leads the tooltip — the "am I behind?" answer first
  const deficitRow = catchUp
    ? catchUp.deficitMins > 30
      ? `📉 behind month pace ${fmtHm(catchUp.deficitMins)} → ${fmtHm(catchUp.requiredToday)}/day × ${catchUp.remainingWorkdays}d`
      : catchUp.deficitMins < -30
        ? `📈 ahead of month pace ${fmtHm(-catchUp.deficitMins)}`
        : `✅ on month pace · ${fmtHm(catchUp.requiredToday)}/day × ${catchUp.remainingWorkdays}d`
    : null;
  const tipRows = [
    deficitRow,
    `💵 ${usd(dailyMinutes)} / $${targetUsd.toFixed(0)} today (${pctToday}%)`,
    plan.need <= 0
      ? '🏁 daily pace met — rest / bank buffer'
      : `⏱ ${fmtHm(dailyMinutes)} on call · ${fmtHm(plan.need)} to go ≈ ${usd(plan.need)}`,
    `☕ ${fmtHm(breakMinutes)} taken · ${fmtHm(breakTarget)} fits by 18:00 · each break min = -${usd(1)}`,
    `📅 month ${usd(monthlyMinutes)} / ${usd(monthGoalMin)} · left ${fmtHm(leftMin)} ≈ ${usd(leftMin)}`,
    `🛟 floor 5500m/mo · left ${fmtHm(fbRemaining)} ≈ ${fbDaily}m/mo`,
    plan.by18Possible
      ? `⏰ by 18:00 → ${fmtHm(plan.slack18)} off · by 23:00 → ${fmtHm(plan.slack23)} off`
      : `⚠️ pace by 18:00: NO · overtime to 23:00 → ${fmtHm(plan.slack23)} off`,
  ].filter(Boolean);
  const showSmartTip = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSmartTip({
      x: Math.min(Math.max(r.left + r.width / 2, 150), (window.innerWidth || 900) - 150),
      y: r.top,
    });
  };
  // ────────────────────────────────────────────────────────────────────────

  // Pair builders — used twice: visible (conditionally, by fitLevel) and inside
  // the hidden always-full measurer with IDENTICAL styling, so `full.offsetWidth`
  // is exactly the width the chip would have with every pair shown.
  const mkUsd = (r) => (
    <span key="usd" ref={r} style={pairStyle} title={`Earned today vs today's $ target`}>
      <span style={lblStyle}>💵</span>
      <span style={valStyle}>${earnedUsd.toFixed(2)}</span>
      <span style={tgtStyle}>/${targetUsd.toFixed(0)}</span>
    </span>
  );
  const mkTime = () => (
    <span key="time" style={pairStyle} title={`On-call today vs today's target (${dailyMin}m)`}>
      <span style={lblStyle}>⏱</span>
      <span style={valStyle}>{fmtHm(dailyMinutes)}</span>
      <span style={tgtStyle}>/{fmtHm(dailyMin)}</span>
    </span>
  );
  const mkCoffee = (r) => (
    <span key="coffee" ref={r} style={pairStyle} title={`Break taken vs total break you can take and still hit the target by 18:00 (more break → overtime toward 23:00)`}>
      <span style={lblStyle}>☕</span>
      <span style={valStyle}>{fmtHm(breakMinutes)}</span>
      <span style={tgtStyle}>/{fmtHm(breakTarget)}</span>
    </span>
  );
  const mkDeficit = () => deficitText && (
    <span key="deficit" style={pairStyle} title={`Month-pace deficit: expected ${catchUp.expectedByToday}m by today · banked ${Math.round(monthlyMinutes)}m`}>
      <span style={{ ...valStyle, fontSize: '0.72rem', color: catchUp.deficitMins > 0 ? '#f87171' : '#34d399' }}>
        {deficitText}
      </span>
    </span>
  );

  return (
    <span
      id="daily-targets-chip"
      ref={chipRef}
      onMouseEnter={showSmartTip}
      onMouseLeave={() => setSmartTip(null)}
      onClick={onOpenGoalDial ? (e) => { e.stopPropagation(); onOpenGoalDial(); } : undefined}
      onKeyDown={onOpenGoalDial ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenGoalDial(); } } : undefined}
      role={onOpenGoalDial ? 'button' : undefined}
      tabIndex={onOpenGoalDial ? 0 : undefined}
      title={onOpenGoalDial ? `Month goal ${fmtHm(monthGoalMin)} · ${deficitText || 'on pace'} — click to open goal picker wheel` : undefined}
      aria-label={`Daily targets: ${usd(dailyMinutes)} of $${targetUsd.toFixed(0)} today, ${fmtHm(dailyMinutes)} on call, ${fmtHm(breakMinutes)} break taken${onOpenGoalDial ? '. Activate to open goal picker.' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.7rem',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        position: 'relative', // v4.96.2: anchors the hidden measurer span
        color: warn ? '#f97316' : '#fbbf24',
        background: 'rgba(251,191,36,0.07)',
        border: `1px solid ${warn ? 'rgba(249,115,22,0.4)' : 'rgba(251,191,36,0.25)'}`,
        borderRadius: 4,
        padding: '0.2rem 0.55rem',
        lineHeight: 1,
        minHeight: 24,
        cursor: onOpenGoalDial ? 'pointer' : 'help',
      }}
    >
      {fitLevel < 2 && mkUsd()}
      {mkTime()}
      {fitLevel < 1 && mkCoffee()}
      {mkDeficit()}
      {/* hidden full-content measurer for fitLevel (out of flow, never seen) */}
      <span
        ref={measureRef}
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', display: 'inline-flex', gap: '0.7rem', whiteSpace: 'nowrap', pointerEvents: 'none' }}
      >
        {mkUsd(usdMeasureRef)}
        {mkTime()}
        {mkCoffee(coffeeMeasureRef)}
        {mkDeficit()}
      </span>
      {smartTip && (
        <span
          style={{
            position: 'fixed',
            left: smartTip.x,
            top: smartTip.y - 6,
            transform: 'translate(-50%, -100%)',
            zIndex: 100000,
            pointerEvents: 'none',
            background: 'rgba(2, 6, 23, 0.94)',
            border: `1px solid ${warn ? 'rgba(249,115,22,0.5)' : 'rgba(251,191,36,0.4)'}`,
            borderRadius: 8,
            padding: '7px 10px',
            fontFamily: 'ui-monospace, Consolas, monospace',
            fontSize: '0.62rem',
            lineHeight: 1.55,
            color: warn ? '#fdba74' : '#fde68a',
            whiteSpace: 'nowrap',
            boxShadow: '0 10px 26px rgba(0,0,0,0.5)',
            textAlign: 'left',
            display: 'block',
          }}
        >
          {tipRows.map((row, i) => (
            <span key={i} style={{ display: 'block' }}>{row}</span>
          ))}
          <span style={{ display: 'block', opacity: 0.55, marginTop: 2 }}>
            rate ${ratePerMinute.toFixed(2)}/min · v{APP_VERSION}
          </span>
        </span>
      )}
    </span>
  );
};
