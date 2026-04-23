import React, { useState, useEffect, useRef } from 'react';
import { RollingNumber } from './RollingNumber';

// ─── EmojiRow ─────────────────────────────────────────────────────────────────
// Renders fullCount full emojis + one partially-cropped emoji representing the
// fractional remainder. Uses CSS clip-path on a wrapper for zero-DOM overhead.
const EmojiRow = ({ emoji, emptyEmoji, value, unitValue, maxValue, color = '#fff', label, sublabel, warnThreshold = 0.3, title, className = "", markers = [], isEditing, helpLabel }) => {
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
    <div title={title} className={`${className} ${isEditing ? 'grid-edit-mode' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative', padding: isEditing ? '2px' : '0' }}>
      {isEditing && <span className="edit-grid-label">{helpLabel}</span>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', lineHeight: 1, alignItems: 'center', position: 'relative' }}>
        <span style={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginRight: '0.3rem', whiteSpace: 'nowrap', zIndex: 10 }}>
          {typeof label === 'string' ? label.split('   ')[0] : label}
        </span>

        {/* Milestone Markers */}
        {markers.map((m, i) => (
          <div key={i} style={{
            position: 'absolute', top: '-1px', bottom: '-1px',
            left: `calc(${(m.value / (maxValue || 1)) * 100}% + 1.2rem)`, // Offset by label
            width: '2px', background: m.color, zIndex: 5, opacity: 0.6,
            borderRadius: '1px'
          }} title={m.label} />
        ))}

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
      <div style={{ fontSize: '0.45rem', opacity: 0.3, letterSpacing: '0.04em', color: 'gray', marginTop: '-2px' }}>
        {typeof label === 'string' ? (label.split('   ')[1] || '') : ''}
      </div>
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
const MomentumBar = ({ totalDailyMins, dailyGoal, shiftElapsedMins, isActive, milestoneTargets }) => {
  const idealNow = shiftElapsedMins > 0 && dailyGoal > 0
    ? Math.min(dailyGoal, dailyGoal * (shiftElapsedMins / Math.max(shiftElapsedMins + 60, 60)))
    : 0;
  const actualRatio = dailyGoal > 0 ? Math.min(1, totalDailyMins / dailyGoal) : 0;
  const idealRatio  = dailyGoal > 0 ? Math.min(1, idealNow / dailyGoal) : 0;
  const deficit = idealRatio - actualRatio; // positive = behind
  const barColor = isActive ? '#10b981' : deficit > 0.1 ? '#ef4444' : '#f59e0b';

  // Milestone Ratios (where you should be for each benchmark)
  const m5500Ratio = (dailyGoal > 0 && milestoneTargets) ? (milestoneTargets.m5500Ideal / dailyGoal) : 0;
  const m480Ratio  = (dailyGoal > 0 && milestoneTargets) ? (milestoneTargets.m480Ideal / dailyGoal) : 0;

  return (
    <div style={{ position: 'relative', height: '6px', background: 'rgba(0,0,0,0.4)', borderRadius: '3px', overflow: 'visible', margin: '0.1rem 0' }}>
      {/* Ghost: where you should be for current goal */}
      {idealRatio > 0 && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${Math.min(100, idealRatio * 100)}%`,
          background: 'rgba(255,255,255,0.12)',
          borderRadius: '3px',
          transition: 'width 2s linear'
        }} />
      )}

      {/* Milestone 1: 5500 Marker (Blue) */}
      {m5500Ratio > 0 && (
        <div style={{
          position: 'absolute', top: '-2px', bottom: '-2px',
          left: `calc(${Math.min(110, m5500Ratio * 100)}% - 1px)`,
          width: '2px', background: '#3b82f6', borderRadius: '1px', opacity: 0.6,
          zIndex: 10, transition: 'left 2s linear'
        }} title={`5500m Benchmark: Where you should be for survival floor (${Math.round(milestoneTargets.m5500Ideal)}m)`} />
      )}

      {/* Milestone 2: 480 Marker (Gold) */}
      {m480Ratio > 0 && (
        <div style={{
          position: 'absolute', top: '-2px', bottom: '-2px',
          left: `calc(${Math.min(110, m480Ratio * 100)}% - 1px)`,
          width: '2px', background: '#f59e0b', borderRadius: '1px', opacity: 0.6,
          zIndex: 10, transition: 'left 2s linear'
        }} title={`480m Benchmark: Where you should be for growth target (${Math.round(milestoneTargets.m480Ideal)}m)`} />
      )}

      {/* Actual progress */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${Math.min(100, actualRatio * 100)}%`,
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
        transition: 'left 1s ease-out',
        zIndex: 20
      }} />
    </div>
  );
};

// ─── GameScoreboard ───────────────────────────────────────────────────────────
// Props mirror the computed values already in DashboardHeader.
export const GameScoreboard = ({ 
  liveDailyArs, dailyTargetArs, monthlyArs, monthlyTargetArs, stats, dailyGoal, totalDailyMins, totalOffCallMins, shiftElapsedMins,
  pacePrediction, qualityScore, cutoffWarning, breakLeft, breakLimit, nextGoalLabel, nextMilestone, daysInMonth, currentDay, remainingDays, isActive, isBreakActive, onSwitchToNumbers, milestoneTargets,
  isEditingScoreboard, getCompensatedLogOff
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

  // Computed Maxes
  const dayArsMax   = Math.max(dailyTargetArs, liveDailyArs, ARS_UNIT);
  const dayMinMax   = Math.max(dailyGoal, totalDailyMins, MIN_UNIT, milestoneTargets?.m5500Ideal || 0, milestoneTargets?.m480Ideal || 0);
  const moArsMax    = Math.max(monthlyTargetArs, monthlyArs, ARS_UNIT);
  const moMinMax    = Math.max(stats.goalMinutes, stats.monthlyMinutes, MIN_UNIT);

  const dayArsPct   = dailyTargetArs > 0 ? Math.round((liveDailyArs  / dailyTargetArs)  * 100) : 0;
  const dayMinPct   = dailyGoal      > 0 ? Math.round((totalDailyMins / dailyGoal)        * 100) : 0;
  const moArsPct    = monthlyTargetArs > 0 ? Math.round((monthlyArs    / monthlyTargetArs) * 100) : 0;
  const moMinPct    = stats.goalMinutes  > 0 ? Math.round((stats.monthlyMinutes / stats.goalMinutes) * 100) : 0;

  const hudState = isActive ? 'call' : isBreakActive ? 'break' : 'avail';

  return (
    <div className="scoreboard-grid" data-state={hudState}>
      
      {/* AREA: top-bar */}
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

      {/* AREA: main-status */}
      <div style={{ gridArea: 'main-status', display: 'flex', flexDirection: 'column' }}>
        <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.06em',
            color: isActive ? '#10b981' : isBreakActive ? '#fb923c' : idleSecs > 15 ? '#ef4444' : 'rgba(255,255,255,0.4)',
            marginBottom: '0.1rem'
          }}>
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

      {/* AREA: timers */}
      <div style={{ gridArea: 'timers' }}>
        <MomentumBar
          totalDailyMins={totalDailyMins} dailyGoal={dailyGoal}
          shiftElapsedMins={shiftElapsedMins} isActive={isActive}
          milestoneTargets={milestoneTargets}
        />
      </div>

      {/* AREA: actions */}
      <div style={{ gridArea: 'actions', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        {tab === 'day' ? (
          <>
            <EmojiRow
              emoji="💰" className="emoji-money" value={liveDailyArs} unitValue={ARS_UNIT}
              maxValue={dailyTargetArs > 0 ? dayArsMax : ARS_UNIT * 5}
              isEditing={isEditingScoreboard} helpLabel="MONEY_DAY"
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>earned</span>
                  <RollingNumber value={liveDailyArs} prefix="AR$" height={10} />
                  <span>/</span>
                  <RollingNumber value={dailyTargetArs} prefix="AR$" height={10} />
                </div>
              }
              sublabel={`${dayArsPct}%`}
            />

            <EmojiRow
              emoji="⏱️" value={totalDailyMins} unitValue={MIN_UNIT}
              maxValue={dayMinMax} isEditing={isEditingScoreboard} helpLabel="MINS_DAY"
              label={`mins   ${Math.round(totalDailyMins)}m / ${Math.round(dailyGoal)}m`}
              sublabel={`${dayMinPct}%`}
              markers={[
                { value: milestoneTargets?.m5500Ideal, color: '#3b82f6', label: `5500m Benchmark (${Math.round(milestoneTargets?.m5500Ideal)}m)` },
                { value: milestoneTargets?.m480Ideal, color: '#f59e0b', label: `480m Benchmark (${Math.round(milestoneTargets?.m480Ideal)}m)` }
              ]}
            />

            <EmojiRow
              emoji="☕" emptyEmoji="🍵" className="emoji-break"
              value={breakLeft} unitValue={15} maxValue={breakLimit}
              isEditing={isEditingScoreboard} helpLabel="BREAK_DAY"
              label={`break   ${Math.round(breakLeft)}m / ${breakLimit}m`}
              sublabel={breakLeft > 0 ? 'READY' : 'SPENT'}
              warnThreshold={0.5}
            />

            <EmojiRow
              emoji="🔋" value={totalDailyMins} unitValue={Math.max(1, stats.dailyBreakMinutes || 1)} maxValue={totalDailyMins * 1.2}
              isEditing={isEditingScoreboard} helpLabel="STAMINA_RATIO"
              label={`stamina  ${(totalDailyMins / Math.max(1, stats.dailyBreakMinutes)).toFixed(1)}x ratio`}
              sublabel={(totalDailyMins / Math.max(1, stats.dailyBreakMinutes)) >= 5.3 ? 'ELITE' : 'TIRED'}
              color="#fb923c"
            />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.1rem' }}>
               <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.4)' }}>
                 🚪 LOG-OFF ESTIMATE: <strong style={{ color: '#fcd34d' }}>{getCompensatedLogOff ? getCompensatedLogOff() : '18:00'}</strong>
               </div>
               <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.4)' }}>
                 Ratio Target: <strong>5.3x</strong>
               </div>
            </div>
          </>
        ) : (
          <>
            <EmojiRow
              emoji="💰" value={monthlyArs} unitValue={ARS_UNIT * 10}
              maxValue={moArsMax}
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>monthly</span>
                  <RollingNumber value={monthlyArs} prefix="AR$" height={10} />
                  <span>/</span>
                  <RollingNumber value={monthlyTargetArs} prefix="AR$" height={10} />
                </div>
              }
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
