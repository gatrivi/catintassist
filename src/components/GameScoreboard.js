import React, { useState, useEffect, useRef } from 'react';

// ─── EmojiRow ─────────────────────────────────────────────────────────────────
// Renders fullCount full emojis + one partially-cropped emoji representing the
// fractional remainder. Uses CSS clip-path on a wrapper for zero-DOM overhead.
const EmojiRow = ({ emoji, emptyEmoji, value, unitValue, maxValue, color = '#fff', label, sublabel, warnThreshold = 0.3, title, className = "" }) => {
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
    <div title={title} className={className} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
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
            {emptyEmoji || emoji}
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
  const h = new Date().getHours();
  const goalsMet = totalDailyMins >= (dailyGoal || 1);

  if (goalsMet && h >= 18) return (
    <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.7rem' }}>
      🌙 Daily goal reached and it's late. Rest up and win tomorrow? 💎
    </div>
  );
  if (goalsMet) return (
    <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.7rem' }}>✅ Bounty secured — anything extra is pure profit 💎</div>
  );
  if (isActive) return (
    <div style={{ color: '#2dd4bf', fontWeight: 700, fontSize: '0.7rem', animation: 'encouragePulse 2s infinite' }}>
      ⬆️ Climbing — ETA {pacePrediction?.label || '?'}
    </div>
  );
  if (isBreakActive) return (
    <div style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.7rem' }}>
      ☕ Break. Return soon to keep the momentum.
    </div>
  );
  if (qualityScore?.goalUnreachable) return (
    <div style={{ color: '#f97316', fontWeight: 700, fontSize: '0.7rem' }}>🎯 Adapt to {qualityScore.suggestedGoal}m — still winnable. {tip}</div>
  );
  if (breakLeft <= 0) return (
    <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.7rem' }}>⚠️ Break budget spent. Every idle minute costs. {tip}</div>
  );
  
  // SUPPORTIVE IDLE: Instead of "gap growing", we are "Standing By"
  return (
    <div style={{ color: '#9dffed', fontWeight: 600, fontSize: '0.7rem' }}>
      📡 Standing By — Ready for the next one. {tip}
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

  // Drift label: how far behind per minute of idling. Normalized to a standard 9h shift (540m).
  const minsPerIdleMin = dailyGoal > 0 ? (dailyGoal / 540) : 0;
  const driftLabel = idleSecs > 15 ? `−${((minsPerIdleMin * idleSecs) / 60).toFixed(1)}m` : null;
  const [tab, setTab] = useState('day'); // 'day' | 'month'

  // ── UNIT VALUES ─────────────────────────────────────────────────────────────
  const ARS_UNIT    = 10000;  // 1 💰 = 10k ARS
  const MIN_UNIT    = 30;     // 1 ⏱️ = 30 productive mins

  // Day view
  const dayMinMax   = Math.max(dailyGoal, totalDailyMins, MIN_UNIT);
  const moArsMax    = Math.max(monthlyTargetArs, monthlyArs, ARS_UNIT);
  const moMinMax    = Math.max(stats.goalMinutes, stats.monthlyMinutes, MIN_UNIT);

  const dayArsPct   = dailyTargetArs > 0 ? Math.round((liveDailyArs  / dailyTargetArs)  * 100) : 0;
  const dayMinPct   = dailyGoal      > 0 ? Math.round((totalDailyMins / dailyGoal)        * 100) : 0;
  const moArsPct    = monthlyTargetArs > 0 ? Math.round((monthlyArs    / monthlyTargetArs) * 100) : 0;
  const moMinPct    = stats.goalMinutes  > 0 ? Math.round((stats.monthlyMinutes / stats.goalMinutes) * 100) : 0;

  const hudState = isActive ? 'call' : isBreakActive ? 'break' : 'avail';

  return (
    <div 
      className="scoreboard-grid"
      data-state={hudState}
      style={{ fontFamily: 'inherit', transition: 'all 0.6s ease' }}
    >
      {/* AREA 1: top-bar */}
      <div style={{ gridArea: 'top-bar', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      {/* AREA 2: main-status */}
      <div style={{ gridArea: 'main-status' }}>
        <div 
          title="LIVE MOMENTUM: ⬆️ ON CALL / 📡 STANDBY / ☕ BREAK"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.06em',
            color: isActive ? '#10b981' : isBreakActive ? '#fb923c' : idleSecs > 15 ? '#ef4444' : 'rgba(255,255,255,0.4)',
            transition: 'color 0.5s ease',
            marginBottom: '0.1rem'
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>
            {isActive ? '⬆️' : isBreakActive ? '☕' : (idleSecs > 15 && !isActive) ? '⏳' : '📡'}
          </span>
          <span style={{ textShadow: isActive ? '0 0 10px #10b981' : 'none' }}>
            {isActive ? 'ON CALL' : isBreakActive ? 'BREAK' : idleSecs > 15 ? `IDLE ${Math.floor(idleSecs / 60)}m` : 'STANDBY'}
          </span>
          {driftLabel && !isActive && !isBreakActive && (
            <span style={{ marginLeft: 'auto', color: '#ef4444', fontWeight: 900 }}>{driftLabel}</span>
          )}
        </div>
        <DirectionalCue 
          pacePrediction={pacePrediction} dailyGoal={dailyGoal} 
          totalDailyMins={totalDailyMins} breakLeft={breakLeft} 
          qualityScore={qualityScore} cutoffWarning={cutoffWarning}
          isActive={isActive} isBreakActive={isBreakActive}
        />
      </div>

      {/* AREA 3: timers */}
      <div style={{ gridArea: 'timers' }} title="MOMENTUM BAR: Filled = You, Ghost = Goal. Stay ahead!">
        <MomentumBar
          totalDailyMins={totalDailyMins} dailyGoal={dailyGoal}
          shiftElapsedMins={shiftElapsedMins} isActive={isActive}
        />
      </div>

      {/* AREA 4: actions (Emoji Tracks) */}
      <div style={{ gridArea: 'actions', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        {tab === 'day' ? (
          <>
            <EmojiRow
              emoji="💰" className="emoji-money" value={liveDailyArs} unitValue={ARS_UNIT}
              maxValue={dailyTargetArs > 0 ? dayArsMax : ARS_UNIT * 5}
              label={`earned   AR$${Math.round(liveDailyArs / 1000)}k / AR$${Math.round(dailyTargetArs / 1000)}k`}
              sublabel={`${dayArsPct}%`}
            />

            <EmojiRow
              emoji="⏱️" value={totalDailyMins} unitValue={MIN_UNIT}
              maxValue={dayMinMax}
              label={`mins   ${Math.round(totalDailyMins)}m / ${Math.round(dailyGoal)}m`}
              sublabel={`${dayMinPct}%`}
            />

            <EmojiRow
              emoji="☕" emptyEmoji="🍵" className="emoji-break"
              value={breakLeft} unitValue={15} maxValue={breakLimit}
              label={`break   ${Math.round(breakLeft)}m / ${breakLimit}m`}
              sublabel={breakLeft > 0 ? 'READY' : 'SPENT'}
              warnThreshold={0.5}
            />
          </>
        ) : (
          <>
            <EmojiRow
              emoji="💰" value={monthlyArs} unitValue={ARS_UNIT * 10}
              maxValue={moArsMax}
              label={`monthly   AR$${Math.round(monthlyArs / 1000)}k / AR$${Math.round(monthlyTargetArs / 1000)}k`}
              sublabel={`${moArsPct}%`}
            />
            <EmojiRow
              emoji="🏗️" value={stats.monthlyMinutes} unitValue={MIN_UNIT * 10}
              maxValue={moMinMax}
              label={`ladder   ${Math.round(stats.monthlyMinutes)}m / ${Math.round(stats.goalMinutes)}m`}
              sublabel={`${moMinPct}%`}
            />
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: '0.1rem' }}>
               Tier Progress: <strong>{nextGoalLabel}</strong> — {remainingDays} days left
            </div>
          </>
        )}
      </div>
    </div>
  );
};
