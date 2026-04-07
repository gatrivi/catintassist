import React, { useState, useEffect, useRef } from 'react';

// ─── EmojiRow ─────────────────────────────────────────────────────────────────
// Renders fullCount full emojis + one partially-cropped emoji representing the
// fractional remainder. Uses CSS clip-path on a wrapper for zero-DOM overhead.
const EmojiRow = ({ emoji, value, unitValue, maxValue, color = '#fff', label, sublabel, warnThreshold = 0.3, title }) => {
  const fullCount  = Math.floor(value / unitValue);
  const fraction   = (value % unitValue) / unitValue; // 0–1
  const maxCount   = Math.ceil(maxValue / unitValue);
  const emptyCount = Math.max(0, maxCount - fullCount - (fraction > 0 ? 1 : 0));

  // Colour the row based on progress ratio
  const ratio = maxValue > 0 ? value / maxValue : 0;
  const rowColor = ratio >= 1 ? '#10b981'           // done – green
                : ratio >= 0.7 ? '#34d399'          // near – light green
                : ratio >= 0.4 ? '#fcd34d'          // mid  – amber
                : ratio >= warnThreshold ? '#f97316'// low  – orange
                : '#ef4444';                         // danger – red

  return (
    <div title={title} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Emoji track & label inline for maximum spatial efficiency */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', lineHeight: 1, alignItems: 'center' }}>
        <span style={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginRight: '0.3rem', whiteSpace: 'nowrap' }}>{label.split('   ')[0]}</span>

        {/* Full emojis */}
        {Array.from({ length: Math.min(fullCount, maxCount) }).map((_, i) => (
          <span key={`f${i}`} style={{ fontSize: '1.1rem', filter: `drop-shadow(0 0 4px ${rowColor}88)` }} title={title}>
            {emoji}
          </span>
        ))}

        {/* Partial emoji */}
        {fraction > 0.04 && fullCount < maxCount && (
          <span title={title} style={{
            display: 'inline-block',
            overflow: 'hidden',
            width:  `calc(${fraction} * 1.2rem)`, 
            fontSize: '1.1rem',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            filter: `drop-shadow(0 0 3px ${rowColor}66)`,
            opacity: 0.85
          }}>
            {emoji}
          </span>
        )}

        {/* Ghost (empty) emojis */}
        {Array.from({ length: Math.min(emptyCount, 30) }).map((_, i) => (
          <span key={`e${i}`} style={{ fontSize: '1.1rem', opacity: 0.08 }} title={title}>
            {emoji}
          </span>
        ))}

        <span style={{ marginLeft: 'auto', color: rowColor, fontWeight: 800, fontSize: '0.65rem', animation: ratio >= 1 ? 'pulseWarning 2s infinite' : 'none' }}>{sublabel}</span>
      </div>
      <div style={{ fontSize: '0.45rem', opacity: 0.3, letterSpacing: '0.04em', color: 'gray', marginTop: '-2px' }}>{label.split('   ')[1] || ''}</div>
    </div>
  );
};

// ─── DirectionalCue ──────────────────────────────────────────────────────────
// Coaching-style cue: encouraging on mistakes, not discouraging.
const COACHING_TIPS = [
  'Each call is a rep. Stay consistent.',
  'Pick up the next one. You got this.',
  'Pace improves with reps. Keep going.',
  'The log doesn\'t lie — every minute counts.',
  'You\'re still in the game. Connect again.',
];
const DirectionalCue = ({ pacePrediction, dailyGoal, totalDailyMins, breakLeft, qualityScore, cutoffWarning, isActive, isBreakActive }) => {
  const tip = COACHING_TIPS[Math.floor(Date.now() / 30000) % COACHING_TIPS.length];
  if (cutoffWarning?.pulse) return (
    <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', animation: 'pulseWarning 1s infinite' }}>
      🚨 DEADLINE NEAR — Work banks at 00:00. Log off soon to save streak!
    </div>
  );
  if (totalDailyMins >= dailyGoal) return (
    <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.7rem' }}>✅ Bounty secured — anything extra is pure profit 💎</div>
  );
  if (isActive) return (
    <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.7rem', animation: 'encouragePulse 2s infinite' }}>
      ⬆️ On call — climbing. ETA {pacePrediction?.label || '?'}
    </div>
  );
  if (isBreakActive) return (
    <div style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.7rem' }}>
      ☕ Break — gap is widening. Return soon.
    </div>
  );
  if (qualityScore?.goalUnreachable) return (
    <div style={{ color: '#f97316', fontWeight: 700, fontSize: '0.7rem' }}>🎯 Adapt to {qualityScore.suggestedGoal}m — still winnable, keep moving</div>
  );
  if (breakLeft <= 0) return (
    <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.7rem' }}>⚠️ Break budget spent — every idle minute costs. {tip}</div>
  );
  if (qualityScore && qualityScore.pct >= 100) return (
    <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.7rem' }}>🔥 On pace! ETA {pacePrediction?.label}. Don\'t stop now.</div>
  );
  return (
    <div style={{ color: '#93c5fd', fontWeight: 600, fontSize: '0.7rem' }}>
      📡 Idle — gap growing. {Math.round(Math.max(0, dailyGoal - totalDailyMins))}m left. {tip}
    </div>
  );
};

// ─── MomentumBar ─────────────────────────────────────────────────────────────
// Shows pace as a horizontal bar: filled = where you are, ghost = where you should be.
const MomentumBar = ({ totalDailyMins, dailyGoal, shiftElapsedMins, isActive }) => {
  const idealNow = shiftElapsedMins > 0 && dailyGoal > 0
    ? Math.min(dailyGoal, dailyGoal * (shiftElapsedMins / Math.max(shiftElapsedMins + 60, 60)))
    : 0;
  const actualRatio = dailyGoal > 0 ? Math.min(1, totalDailyMins / dailyGoal) : 0;
  const idealRatio  = dailyGoal > 0 ? Math.min(1, idealNow / dailyGoal) : 0;
  const deficit = idealRatio - actualRatio; // positive = behind
  const barColor = isActive ? '#10b981' : deficit > 0.1 ? '#ef4444' : '#f59e0b';
  return (
    <div style={{ position: 'relative', height: '6px', background: 'rgba(0,0,0,0.4)', borderRadius: '3px', overflow: 'visible', margin: '0.1rem 0' }}>
      {/* Ghost: where you should be */}
      {idealRatio > 0 && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${idealRatio * 100}%`,
          background: 'rgba(255,255,255,0.12)',
          borderRadius: '3px',
          transition: 'width 2s linear'
        }} />
      )}
      {/* Actual progress */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${actualRatio * 100}%`,
        background: barColor,
        borderRadius: '3px',
        boxShadow: isActive ? `0 0 8px ${barColor}` : 'none',
        transition: 'width 1s ease-out, background 0.5s ease'
      }} />
      {/* Cursor: where you are */}
      <div style={{
        position: 'absolute', top: '-3px', bottom: '-3px',
        left: `calc(${actualRatio * 100}% - 1px)`,
        width: '2px',
        background: '#fff',
        borderRadius: '1px',
        boxShadow: isActive ? '0 0 6px white' : 'none',
        transition: 'left 1s ease-out'
      }} />
    </div>
  );
};

// ─── GameScoreboard ───────────────────────────────────────────────────────────
// Props mirror the computed values already in DashboardHeader.
export const GameScoreboard = ({
  // Money
  liveDailyArs, dailyTargetArs, monthlyArs, monthlyTargetArs,
  // Time
  stats, dailyGoal, totalDailyMins, shiftElapsedMins,
  // Intelligence
  pacePrediction, qualityScore, cutoffWarning,
  // Break
  breakLeft, breakLimit,
  // Ladder
  nextGoalLabel, nextMilestone,
  // Monthly
  daysInMonth, currentDay, remainingDays,
  // Call state (for visual momentum)
  isActive, isBreakActive,
  // onSwitch back to numbers
  onSwitchToNumbers
}) => {
  // Drift counter: how many seconds since last call ended (affects UI urgency)
  const [idleSecs, setIdleSecs] = useState(0);
  useEffect(() => {
    if (isActive || isBreakActive) { setIdleSecs(0); return; }
    const iv = setInterval(() => setIdleSecs(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [isActive, isBreakActive]);

  // Drift label: how far behind per minute of idling
  const minsPerIdleMin = dailyGoal > 0 ? (1 / Math.max(shiftElapsedMins + 60, 60)) * dailyGoal : 0;
  const driftLabel = idleSecs > 15 ? `−${(minsPerIdleMin * idleSecs / 60).toFixed(1)}m` : null;
  const [tab, setTab] = useState('day'); // 'day' | 'month'

  // ── UNIT VALUES ─────────────────────────────────────────────────────────────
  const ARS_UNIT    = 10000;  // 1 💰 = 10k ARS
  const MIN_UNIT    = 30;     // 1 ⏱️ = 30 productive mins

  // Day view
  const dayArsMax   = Math.max(dailyTargetArs, liveDailyArs, ARS_UNIT);
  const dayMinMax   = Math.max(dailyGoal, totalDailyMins, MIN_UNIT);
  const breakUsed   = Math.max(0, breakLimit - breakLeft);

  // Month view
  const moArsMax    = Math.max(monthlyTargetArs, monthlyArs, ARS_UNIT);
  const moMinMax    = Math.max(stats.goalMinutes, stats.monthlyMinutes, MIN_UNIT);

  // Progress pct labels
  const dayArsPct   = dailyTargetArs > 0 ? Math.round((liveDailyArs  / dailyTargetArs)  * 100) : 0;
  const dayMinPct   = dailyGoal      > 0 ? Math.round((totalDailyMins / dailyGoal)        * 100) : 0;
  const moArsPct    = monthlyTargetArs > 0 ? Math.round((monthlyArs    / monthlyTargetArs) * 100) : 0;
  const moMinPct    = stats.goalMinutes  > 0 ? Math.round((stats.monthlyMinutes / stats.goalMinutes) * 100) : 0;

  // On-call: glowing green border + rising animation / Off-call: subtle red sinking
  const stateStyle = isActive
    ? { border: '1px solid rgba(16,185,129,0.5)', boxShadow: '0 0 12px rgba(16,185,129,0.18)', animation: 'riseGlow 1.5s ease-in-out infinite alternate' }
    : isBreakActive
    ? { border: '1px solid rgba(251,146,60,0.3)', boxShadow: 'none' }
    : idleSecs > 60
    ? { border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 0 8px rgba(239,68,68,0.08)', animation: 'sinkDim 3s ease-in-out infinite alternate' }
    : { border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', padding: '0.2rem 0.4rem', fontFamily: 'inherit', borderRadius: '6px', transition: 'all 0.6s ease', ...stateStyle }}>

      {/* Header row — tabs + numeric toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          {['day', 'month'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize: '0.58rem', padding: '0.15rem 0.45rem', borderRadius: '4px',
              border: tab === t ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
              background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === t ? '#fff' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer', fontWeight: tab === t ? 700 : 400, textTransform: 'uppercase'
            }}>{t === 'day' ? '☀️ Day' : '🗓️ Month'}</button>
          ))}
        </div>
        <button onClick={onSwitchToNumbers} style={{
          fontSize: '0.52rem', padding: '0.1rem 0.35rem', borderRadius: '3px',
          border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
          color: 'rgba(255,255,255,0.25)', cursor: 'pointer'
        }} title="Switch to number view">123</button>
      </div>

      {/* ── DAY TAB ── */}
      {tab === 'day' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>

          {/* Live state indicator strip */}
          <div 
            title="LIVE MOMENTUM: ⬆️ ON CALL means you are advancing towards your goal. ⬇️ IDLE means you are stopped, accumulating negative drift as time passes. ☕ BREAK pauses pressure but uses your limited budget."
            style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.06em',
            color: isActive ? '#10b981' : isBreakActive ? '#fb923c' : idleSecs > 15 ? '#ef4444' : 'rgba(255,255,255,0.4)',
            transition: 'color 0.5s ease'
          }}>
            <span style={{ fontSize: '0.75rem' }}>
              {isActive ? '⬆️' : isBreakActive ? '☕' : idleSecs > 15 ? '⬇️' : '—'}
            </span>
            <span style={{ textShadow: isActive ? '0 0 10px #10b981' : 'none' }}>
              {isActive ? 'ON CALL' : isBreakActive ? 'BREAK' : idleSecs > 15 ? `IDLE ${Math.floor(idleSecs / 60)}m${idleSecs % 60}s` : 'STANDBY'}
            </span>
            {driftLabel && !isActive && !isBreakActive && (
              <span style={{ marginLeft: 'auto', color: '#ef4444', fontWeight: 900, animation: 'pulseWarning 1s infinite' }}>{driftLabel}</span>
            )}
          </div>

          {/* Pace momentum bar */}
          <div title="MOMENTUM BAR: The bold bar is your actual progress. The faint background bar is the 'pace ghost'—representing the exact progress you should have right now to effortlessly hit your goal. Keep your bar ahead of the ghost!">
            <MomentumBar
              totalDailyMins={totalDailyMins} dailyGoal={dailyGoal}
              shiftElapsedMins={shiftElapsedMins} isActive={isActive}
            />
          </div>

          <EmojiRow
            emoji="💰" value={liveDailyArs} unitValue={ARS_UNIT}
            maxValue={dailyTargetArs > 0 ? dayArsMax : ARS_UNIT * 5}
            label={`earned   AR$${Math.round(liveDailyArs / 1000)}k / AR$${Math.round(dailyTargetArs / 1000)}k`}
            sublabel={`${dayArsPct}%`}
            title="MONEYBAGS: Each bag represent AR$10k earned. Fill the row to hit your daily bounty targets."
          />

          <EmojiRow
            emoji="⏱️" value={totalDailyMins} unitValue={MIN_UNIT}
            maxValue={dayMinMax}
            label={`mins   ${Math.round(totalDailyMins)}m / ${Math.round(dailyGoal)}m`}
            sublabel={`${dayMinPct}%`}
            title="CLOCKS: Each clock represents 30 productive minutes. Aim for consistent session blocks."
          />

          {/* Break budget */}
          <EmojiRow
            emoji="☕" value={breakLeft} unitValue={15}
            maxValue={breakLimit}
            label={`break left   ${Math.round(breakLeft)}m / ${breakLimit}m`}
            sublabel={breakLeft > 30 ? 'OK' : breakLeft > 0 ? 'LOW' : 'GONE'}
            warnThreshold={0.5}
            title="BREAK CUPS: 90m total daily budget. Each cup is 15m. When they are gone, you are in the red zone."
          />

          {/* Directional cue */}
          <div title="COACH: Provides live, adaptive guidance. Helps you adjust dynamically instead of harshly punishing you for falling behind.">
            <DirectionalCue
              pacePrediction={pacePrediction} dailyGoal={dailyGoal}
              totalDailyMins={totalDailyMins} breakLeft={breakLeft}
              qualityScore={qualityScore} cutoffWarning={cutoffWarning}
              isActive={isActive} isBreakActive={isBreakActive}
            />
          </div>
        </div>
      )}

      {/* ── MONTH TAB ── */}
      {tab === 'month' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>

          <EmojiRow
            emoji="💰" value={monthlyArs} unitValue={ARS_UNIT * 5}
            maxValue={moArsMax}
            label={`monthly ARS   $${Math.round(monthlyArs / 1000)}k / $${Math.round(monthlyTargetArs / 1000)}k`}
            sublabel={`${moArsPct}%`}
            title="MONTHLY CASH: Cumulative earnings for this month vs your target tier."
          />

          <EmojiRow
            emoji="⏱️" value={stats.monthlyMinutes} unitValue={MIN_UNIT * 4}
            maxValue={moMinMax}
            label={`monthly mins   ${Math.round(stats.monthlyMinutes)}m / ${stats.goalMinutes}m`}
            sublabel={`${moMinPct}%`}
            title="MONTHLY MINUTES: How many productive minutes you've logged this month."
          />

          {/* Days consumed */}
          <EmojiRow
            emoji="📅" value={currentDay} unitValue={1}
            maxValue={daysInMonth}
            label={`day ${currentDay} of ${daysInMonth}   (${remainingDays}d left)`}
            sublabel={`${Math.round((currentDay / daysInMonth) * 100)}% thru month`}
            title="CALENDAR PROGRESS: Your position in the current month."
          />

          {/* Next ladder step */}
          <div style={{ fontSize: '0.6rem', color: '#a855f7', fontWeight: 700, padding: '0.15rem 0', letterSpacing: '0.04em' }}>
            🪜 NEXT — {nextGoalLabel} ({nextMilestone}m)
          </div>
        </div>
      )}
    </div>
  );
};
