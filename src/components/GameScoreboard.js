import React, { useState, useEffect } from 'react';
import { RollingNumber } from './RollingNumber';

// ─── UTILITIES ───────────────────────────────────────────────────────────────
const renderMeter = (value, maxValue, size = 12) => {
  const ratio = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  const blocks = Math.floor(ratio * size);
  return `[${'█'.repeat(blocks)}${'░'.repeat(size - blocks)}]`;
};

// ─── DataRow (formerly EmojiRow) ─────────────────────────────────────────────
const DataRow = ({ value, maxValue, label, sublabel, color = '#fff', isEditing, helpLabel, className = "" }) => {
  const ratio = maxValue > 0 ? value / maxValue : 0;
  const rowColor = ratio >= 1 ? 'var(--success)' 
                : ratio >= 0.7 ? '#4ade80' 
                : ratio >= 0.4 ? '#fbbf24' 
                : '#ef4444';

  return (
    <div className={`${className} ${isEditing ? 'grid-edit-mode' : ''}`} style={{ 
      display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px 0',
      borderBottom: '1px solid #18181b', position: 'relative'
    }}>
      {isEditing && <span className="edit-grid-label">{helpLabel}</span>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
        <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {typeof label === 'string' ? label.split('   ')[0] : label}
        </span>
        <span className="phosphor-glow" style={{ color: rowColor, fontWeight: 800 }}>{sublabel}</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: rowColor, letterSpacing: '-1px', fontSize: '0.9rem' }}>
          {renderMeter(value, maxValue)}
        </span>
        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>
          {typeof label === 'string' ? (label.split('   ')[1] || '') : ''}
        </div>
      </div>
    </div>
  );
};

// ─── DirectionalCue ──────────────────────────────────────────────────────────
const COACHING_TIPS = [
  'REP CONSISTENCY IS KEY.',
  'NEXT CALL IS A FRESH START.',
  'PACE IMPROVES WITH VOLUME.',
  'LOG DATA NEVER LIES.',
  'SYSTEM READY. CONNECT.',
];

const DirectionalCue = ({ pacePrediction, dailyGoal, totalDailyMins, breakLeft, qualityScore, cutoffWarning, isActive, isBreakActive }) => {
  const tip = COACHING_TIPS[Math.floor(Date.now() / 30000) % COACHING_TIPS.length];
  
  if (cutoffWarning?.pulse) return (
    <div style={{ color: 'var(--danger)', fontWeight: 800, fontSize: '0.65rem' }}>
      ! DEADLINE REACHED: LOG OFF SOON.
    </div>
  );

  const goalsMet = totalDailyMins >= (dailyGoal || 1);
  if (goalsMet) return (
    <div style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.65rem' }}>
      > GOAL SECURED. PROFIT MODE ACTIVE.
    </div>
  );

  let statusText = `> ${tip}`;
  let statusColor = 'var(--text-muted)';

  if (isActive) {
    statusText = `> CLIMBING. ETA: ${pacePrediction?.label || '??:??'}`;
    statusColor = 'var(--success)';
  } else if (isBreakActive) {
    statusText = `> BREAK ACTIVE. REFRESHING...`;
    statusColor = '#fb923c';
  }

  return (
    <div style={{ color: statusColor, fontWeight: 600, fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>
      {statusText}
    </div>
  );
};

// ─── MomentumDelta ──────────────────────────────────────────────────────────
const MomentumDelta = ({ totalDailyMins, dailyGoal, shiftElapsedMins, isActive }) => {
  const idealNow = shiftElapsedMins > 0 && dailyGoal > 0
    ? Math.min(dailyGoal, dailyGoal * (shiftElapsedMins / Math.max(shiftElapsedMins + 60, 60)))
    : 0;
  
  const diff = Math.round(totalDailyMins - idealNow);
  const diffColor = diff >= 0 ? 'var(--success)' : 'var(--danger)';
  const diffSign = diff >= 0 ? '+' : '';

  return (
    <div style={{ 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
      padding: '4px 6px', background: '#18181b', border: '1px solid #27272a',
      fontFamily: 'var(--font-mono)', fontSize: '0.65rem', margin: '4px 0'
    }}>
      <span style={{ color: 'var(--text-muted)' }}>TARGET: {Math.round(idealNow)}m</span>
      <span style={{ color: '#fff', fontWeight: 700 }}>
        CURRENT: {Math.round(totalDailyMins)}m 
        <span style={{ color: diffColor, marginLeft: '6px' }}>({diffSign}{diff}m)</span>
      </span>
    </div>
  );
};

// ─── GameScoreboard ───────────────────────────────────────────────────────────
export const GameScoreboard = ({ 
  liveDailyArs, dailyTargetArs, monthlyArs, monthlyTargetArs, stats, dailyGoal, totalDailyMins, shiftElapsedMins,
  pacePrediction, qualityScore, cutoffWarning, breakLeft, breakLimit, remainingDays, isActive, isBreakActive, onSwitchToNumbers,
  isEditingScoreboard, getCompensatedLogOff
 }) => {
  const [idleSecs, setIdleSecs] = useState(0);
  useEffect(() => {
    if (isActive || isBreakActive) { setIdleSecs(0); return; }
    const iv = setInterval(() => setIdleSecs(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [isActive, isBreakActive]);

  const [tab, setTab] = useState('day'); 
  
  const dayArsPct = dailyTargetArs > 0 ? Math.round((liveDailyArs / dailyTargetArs) * 100) : 0;
  const dayMinPct = dailyGoal > 0 ? Math.round((totalDailyMins / dailyGoal) * 100) : 0;
  const moArsPct = monthlyTargetArs > 0 ? Math.round((monthlyArs / monthlyTargetArs) * 100) : 0;
  const moMinPct = stats.goalMinutes > 0 ? Math.round((stats.monthlyMinutes / stats.goalMinutes) * 100) : 0;

  const hudState = isActive ? 'call' : isBreakActive ? 'break' : 'avail';

  return (
    <div className="scoreboard-grid" data-state={hudState} style={{ background: '#09090b', padding: '6px', borderRadius: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272a', paddingBottom: '4px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['day', 'month'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize: '0.55rem', padding: '2px 8px', borderRadius: 0,
              border: tab === t ? '1px solid var(--accent-primary)' : '1px solid #27272a',
              background: tab === t ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
              color: tab === t ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'var(--font-mono)'
            }}>{t}</button>
          ))}
        </div>
        <div style={{
            fontSize: '0.6rem', fontWeight: 900, fontFamily: 'var(--font-mono)',
            color: isActive ? 'var(--success)' : isBreakActive ? '#fb923c' : idleSecs > 15 ? 'var(--danger)' : 'var(--text-muted)',
          }}>
          {isActive ? '[CALL_LIVE]' : isBreakActive ? '[BREAK_MODE]' : idleSecs > 15 ? `[IDLE_${Math.floor(idleSecs / 60)}m]` : '[STANDBY]'}
        </div>
      </div>

      {/* Main Status Row */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <DirectionalCue 
          pacePrediction={pacePrediction} dailyGoal={dailyGoal} 
          totalDailyMins={totalDailyMins} breakLeft={breakLeft} 
          qualityScore={qualityScore} cutoffWarning={cutoffWarning}
          isActive={isActive} isBreakActive={isBreakActive}
        />

        <MomentumDelta
          totalDailyMins={totalDailyMins} dailyGoal={dailyGoal}
          shiftElapsedMins={shiftElapsedMins} isActive={isActive}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {tab === 'day' ? (
            <>
              <DataRow
                value={liveDailyArs} maxValue={dailyTargetArs}
                isEditing={isEditingScoreboard} helpLabel="CASH_DAY"
                label={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span>EARNED</span>
                    <RollingNumber value={liveDailyArs} prefix="AR$" height={10} />
                  </div>
                }
                sublabel={`${dayArsPct}%`}
              />

              <DataRow
                value={totalDailyMins} maxValue={dailyGoal} 
                isEditing={isEditingScoreboard} helpLabel="MINS_DAY"
                label={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span>PRODUCT</span>
                    <RollingNumber value={totalDailyMins} suffix="m" height={10} />
                  </div>
                }
                sublabel={`${dayMinPct}%`}
              />

              <DataRow
                value={breakLeft} maxValue={breakLimit}
                isEditing={isEditingScoreboard} helpLabel="BREAK_DAY"
                label={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span>BREAK</span>
                    <RollingNumber value={breakLeft} suffix="m" height={10} />
                  </div>
                }
                sublabel={breakLeft > 0 ? 'READY' : 'EMPTY'}
              />
            </>
          ) : (
            <>
              <DataRow
                value={monthlyArs} maxValue={monthlyTargetArs}
                label={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span>MONTHLY</span>
                    <RollingNumber value={monthlyArs} prefix="AR$" height={10} />
                  </div>
                }
                sublabel={`${moArsPct}%`}
              />
              <DataRow
                value={stats.monthlyMinutes} maxValue={stats.goalMinutes}
                label={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span>LADDER</span>
                    <RollingNumber value={stats.monthlyMinutes} suffix="m" height={10} />
                  </div>
                }
                sublabel={`${moMinPct}%`}
              />
            </>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '4px', borderTop: '1px dashed #27272a' }}>
         <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
           LOG-OFF: <strong style={{ color: '#fff' }}>{getCompensatedLogOff ? getCompensatedLogOff() : '18:00'}</strong>
         </div>
         <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
           STAMINA: <strong style={{ color: 'var(--success)' }}>{(totalDailyMins / Math.max(1, stats.dailyBreakMinutes)).toFixed(1)}x</strong>
         </div>
      </div>
    </div>
  );
};
