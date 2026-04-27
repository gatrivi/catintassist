import React, { useState, useEffect } from 'react';
import { RollingNumber } from './RollingNumber';
import { ScrambleText } from './ScrambleText';

// ─── UTILITIES ───────────────────────────────────────────────────────────────
const renderMeter = (value, maxValue, size = 12) => {
  const ratio = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  const blocks = Math.floor(ratio * size);
  return `[${'█'.repeat(blocks)}${'░'.repeat(size - blocks)}]`;
};

// ─── DataRow ─────────────────────────────────────────────────────────────
const DataRow = ({ value, maxValue, label, sublabel, isEditing, helpLabel, className = "", useScramble = false }) => {
  const ratio = maxValue > 0 ? value / maxValue : 0;
  const rowColor = ratio >= 1 ? 'var(--success)' 
                : ratio >= 0.7 ? '#4ade80' 
                : ratio >= 0.4 ? '#fbbf24' 
                : '#ef4444';

  return (
    <div className={`${className} ${isEditing ? 'grid-edit-mode' : ''}`} style={{ 
      display: 'flex', flexDirection: 'column', gap: '1px', padding: '1px 0',
      borderBottom: '1px solid #18181b', position: 'relative'
    }}>
      {isEditing && <span className="edit-grid-label" style={{ fontSize: '0.4rem', color: 'var(--accent-primary)' }}>{helpLabel}</span>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem' }}>
        <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <span className="phosphor-glow" style={{ color: rowColor, fontWeight: 800 }}>
          {useScramble ? <ScrambleText value={sublabel} duration={300} /> : sublabel}
        </span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: rowColor, letterSpacing: '-1px', fontSize: '0.85rem', opacity: 0.8 }}>
          {renderMeter(value, maxValue)}
        </span>
      </div>
    </div>
  );
};

// ─── MomentumDelta ──────────────────────────────────────────────────────────
const MomentumDelta = ({ totalDailyMins, dailyGoal, shiftElapsedMins }) => {
  const idealNow = shiftElapsedMins > 0 && dailyGoal > 0
    ? Math.min(dailyGoal, dailyGoal * (shiftElapsedMins / Math.max(shiftElapsedMins + 60, 60)))
    : 0;
  
  const diff = Math.round(totalDailyMins - idealNow);
  const diffColor = diff >= 0 ? 'var(--success)' : 'var(--danger)';
  const diffSign = diff >= 0 ? '+' : '';

  return (
    <div style={{ 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
      padding: '2px 6px', background: '#111', border: '1px solid #18181b',
      fontFamily: 'var(--font-mono)', fontSize: '0.6rem', margin: '2px 0'
    }}>
      <span style={{ color: 'var(--text-muted)' }}>TARGET: {Math.round(idealNow)}m</span>
      <span style={{ color: '#fff', fontWeight: 700 }}>
        CURRENT: <ScrambleText value={Math.round(totalDailyMins)} />m 
        <span style={{ color: diffColor, marginLeft: '6px' }}>({diffSign}{diff}m)</span>
      </span>
    </div>
  );
};

// ─── GameScoreboard ───────────────────────────────────────────────────────────
export const GameScoreboard = ({ 
  liveDailyArs, dailyTargetArs, monthlyArs, monthlyTargetArs, stats, dailyGoal, totalDailyMins, shiftElapsedMins,
  pacePrediction, cutoffWarning, breakLeft, breakLimit, remainingDays, isActive, isBreakActive,
  isEditingScoreboard, getCompensatedLogOff, dailyLog = {}
 }) => {
  const [idleSecs, setIdleSecs] = useState(0);
  const [viewMode, setViewMode] = useState('shift'); // 'shift' | 'ledger'

  useEffect(() => {
    if (isActive || isBreakActive) { setIdleSecs(0); return; }
    const iv = setInterval(() => setIdleSecs(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [isActive, isBreakActive]);

  const dayArsPct = dailyTargetArs > 0 ? Math.round((liveDailyArs / dailyTargetArs) * 100) : 0;
  const dayMinPct = dailyGoal > 0 ? Math.round((totalDailyMins / dailyGoal) * 100) : 0;
  const moMinPct = stats.goalMinutes > 0 ? Math.round((stats.monthlyMinutes / stats.goalMinutes) * 100) : 0;

  // Monthly Metrics
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysWorked = Object.keys(dailyLog).filter(d => dailyLog[d] > 0).length;

  const hudState = isActive ? 'call' : isBreakActive ? 'break' : 'avail';

  return (
    <div className="scoreboard-grid" data-state={hudState} style={{ 
      background: '#09090b', padding: '6px', borderRadius: 0, height: '100%', 
      display: 'flex', flexDirection: 'column', position: 'relative' 
    }}>
      
      {/* Top Navigation / Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #18181b', paddingBottom: '3px', marginBottom: '3px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['shift', 'ledger'].map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              fontSize: '0.5rem', padding: '1px 6px', borderRadius: 0,
              border: viewMode === m ? '1px solid var(--accent-primary)' : '1px solid #18181b',
              background: viewMode === m ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
              color: viewMode === m ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'var(--font-mono)'
            }}>{m}</button>
          ))}
        </div>
        <div style={{
            fontSize: '0.6rem', fontWeight: 900, fontFamily: 'var(--font-mono)',
            color: isActive ? 'var(--success)' : isBreakActive ? '#fb923c' : idleSecs > 15 ? 'var(--danger)' : 'var(--text-muted)',
          }}>
          {isActive ? '[CALL_LIVE]' : isBreakActive ? '[BREAK_MODE]' : idleSecs > 15 ? `[IDLE_${Math.floor(idleSecs / 60)}m]` : '[STANDBY]'}
        </div>
      </div>

      {/* Mode Specific Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {viewMode === 'shift' ? (
          <>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.55rem', fontFamily: 'var(--font-mono)' }}>
              {isActive ? `> CLIMBING. ETA: ${pacePrediction?.label || '??:??'}` : `> SYSTEM_READY. CONNECT.`}
            </div>

            <MomentumDelta
              totalDailyMins={totalDailyMins} dailyGoal={dailyGoal}
              shiftElapsedMins={shiftElapsedMins}
            />

            <DataRow
              value={liveDailyArs} maxValue={dailyTargetArs} useScramble
              label="EARNED" sublabel={`${dayArsPct}%`}
            />

            <DataRow
              value={totalDailyMins} maxValue={dailyGoal} useScramble
              label="PRODUCT" sublabel={`${dayMinPct}%`}
            />

            <DataRow
              value={breakLeft} maxValue={breakLimit} useScramble
              label="BREAK" sublabel={`${Math.round(breakLeft)}m`}
            />
          </>
        ) : (
          <>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.55rem', fontFamily: 'var(--font-mono)' }}>
              > LEDGER_MTD: {now.toLocaleString('default', { month: 'long' }).toUpperCase()}
            </div>

            <div style={{ padding: '2px 0', borderBottom: '1px solid #18181b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>TOTAL_AR$</span>
                <span className="phosphor-glow" style={{ fontWeight: 800 }}>
                  <RollingNumber value={monthlyArs} prefix="AR$" height={12} />
                </span>
              </div>
            </div>

            <DataRow
              value={daysWorked} maxValue={daysInMonth}
              label="ATTENDANCE" sublabel={`${daysWorked}/${daysInMonth}d`}
            />

            <DataRow
              value={stats.monthlyMinutes} maxValue={stats.goalMinutes} useScramble
              label="LADDER" sublabel={`${moMinPct}%`}
            />

            <div style={{ marginTop: '2px', fontSize: '0.55rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
               REMAINING: {remainingDays} DAYS
            </div>
          </>
        )}
      </div>

      {/* Footer Stats & Ghost Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '3px', borderTop: '1px dashed #18181b' }}>
         <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
           LOG-OFF: <strong style={{ color: '#fff' }}>{getCompensatedLogOff ? getCompensatedLogOff() : '18:00'}</strong>
         </div>
         <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
           STAMINA: <strong style={{ color: 'var(--success)' }}>{(totalDailyMins / Math.max(1, stats.dailyBreakMinutes)).toFixed(1)}x</strong>
         </div>
      </div>

      {/* Ghost Monthly Progress Bar */}
      <div className="ghost-progress-container">
        <div className="ghost-progress-fill" style={{ width: `${moMinPct}%` }} />
      </div>
    </div>
  );
};
