import React, { useState, useEffect } from 'react';
import { RollingNumber } from './RollingNumber';
import { ScrambleText } from './ScrambleText';
import { useSession } from '../contexts/SessionContext';

// ─── UTILITIES ───────────────────────────────────────────────────────────────
const renderMeter = (value, maxValue, size = 8) => {
  const ratio = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  const blocks = Math.floor(ratio * size);
  return `[${'█'.repeat(blocks)}${'░'.repeat(size - blocks)}]`;
};

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// ─── GameScoreboard ───────────────────────────────────────────────────────────
export const GameScoreboard = ({ 
  liveDailyArs, dailyTargetArs, monthlyArs, monthlyTargetArs, stats, dailyGoal, totalDailyMins, shiftElapsedMins,
  pacePrediction, cutoffWarning, breakLeft, breakLimit, remainingDays, isActive, isBreakActive,
  isEditingScoreboard, getCompensatedLogOff, dailyLog = {}
}) => {
  const { availSeconds, RATE_PER_MINUTE, arsRate, breakSeconds } = useSession();

  // Column 1: Financials & Yield
  const dailyEarnK = liveDailyArs ? (liveDailyArs / 1000).toFixed(1) : 0;
  const dailyTargetK = dailyTargetArs ? (dailyTargetArs / 1000).toFixed(1) : 0;
  const monthlyEarnK = monthlyArs ? (monthlyArs / 1000).toFixed(1) : 0;
  const idleArs = (availSeconds / 60) * RATE_PER_MINUTE * arsRate;
  const idleArsK = (idleArs / 1000).toFixed(1);
  
  // HUD State
  const [idleSecs, setIdleSecs] = useState(0);
  useEffect(() => {
    if (isActive || isBreakActive) { setIdleSecs(0); return; }
    const iv = setInterval(() => setIdleSecs(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [isActive, isBreakActive]);

  const hudState = isActive ? 'ACTIVE' : isBreakActive ? 'BREAK' : 'STANDBY';
  const isIdleActive = hudState === 'STANDBY';

  // Column 2: Pacing & Time-Box
  // Calculate expectedNow logic
  const calculateExpectedMinutes = (dGoal) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0); // 09:00
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0); // 18:00
    if (now < start) return 0;
    if (now > end) return dGoal;
    const totalMs = end - start;
    const elapsedMs = now - start;
    return (elapsedMs / totalMs) * dGoal;
  };
  const expectedNow = calculateExpectedMinutes(dailyGoal);
  const diff = Math.round(totalDailyMins - expectedNow);
  const diffColor = diff >= 0 ? 'var(--success)' : 'var(--danger)';
  const diffSign = diff >= 0 ? '+' : '';
  const monthlyRemainingMins = Math.max(0, stats.goalMinutes - stats.monthlyMinutes);
  const urgencyShadow = monthlyRemainingMins < 550 ? '0 0 8px #fb923c' : 'none';

  // Column 3: Biological & Stamina
  const breakUsedMins = stats.dailyBreakMinutes + (isBreakActive ? (breakSeconds / 60) : 0);
  const breakRemaining = Math.max(0, breakLimit - breakUsedMins);
  const staminaRatio = (totalDailyMins / Math.max(1, breakUsedMins)).toFixed(1);
  const staminaShadow = parseFloat(staminaRatio) >= 5.3 ? '0 0 8px #fbbf24' : 'none';

  // Column 4: System & Context
  const legendTarget = 480; 
  let coachingStr = "Ready for the next one.";
  if (isActive) coachingStr = "Climbing.";
  else if (isBreakActive) coachingStr = "Recharging.";
  else if (idleSecs > 60) coachingStr = "Idle Decay Active.";

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gridTemplateRows: 'repeat(3, 1fr)',
      gap: '2px',
      padding: '4px',
      background: 'transparent',
      height: '100%',
      fontFamily: 'monospace',
      lineHeight: '1.2',
      fontSize: '0.85rem',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      color: '#fff'
    }}>
      {/* ROW 1 */}
      {/* Col 1 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} className={liveDailyArs >= dailyTargetArs ? 'goal-achieved' : ''}>
        AR$ <span style={{ color: 'var(--success)' }}>{renderMeter(liveDailyArs, dailyTargetArs, 8)}</span> <RollingNumber value={dailyEarnK} height={12} />k / {dailyTargetK}k
      </div>
      {/* Col 2 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        MIN <span style={{ color: 'var(--success)' }}>{renderMeter(totalDailyMins, dailyGoal, 8)}</span> <ScrambleText value={Math.round(totalDailyMins)} /> / {Math.round(dailyGoal)}m
      </div>
      {/* Col 3 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        BRK <span style={{ color: '#fb923c' }}>{renderMeter(breakRemaining, breakLimit, 8)}</span> <ScrambleText value={Math.round(breakRemaining)} />m / {breakLimit}m
      </div>
      {/* Col 4 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        SYS [{hudState}]
      </div>

      {/* ROW 2 */}
      {/* Col 1 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        MTD <span style={{ color: 'var(--success)' }}>{renderMeter(monthlyArs, monthlyTargetArs, 8)}</span> <RollingNumber value={monthlyEarnK} height={12} />k
      </div>
      {/* Col 2 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        TGT [{diff >= 0 ? 'Ahead' : 'Behind'}] <span style={{ color: diffColor }}>{diffSign}<ScrambleText value={Math.abs(diff)} />m</span>
      </div>
      {/* Col 3 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        STM [<span style={{ color: '#fff', textShadow: staminaShadow }}><ScrambleText value={staminaRatio} />x</span>] (Prod/Break)
      </div>
      {/* Col 4 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        NXT [Legend Target: {legendTarget}m]
      </div>

      {/* ROW 3 */}
      {/* Col 1 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        DRF [<span style={{ color: '#fff', textShadow: isIdleActive ? '0 0 8px red' : 'none' }}>-<ScrambleText value={idleArsK} />k</span>] (Idle Decay)
      </div>
      {/* Col 2 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        MTD <span style={{ color: 'var(--success)' }}>{renderMeter(stats.monthlyMinutes, stats.goalMinutes, 8)}</span> <span style={{ textShadow: urgencyShadow }}><ScrambleText value={Math.round(stats.monthlyMinutes)} /> / {stats.goalMinutes}m</span>
      </div>
      {/* Col 3 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        IDL [<ScrambleText value={formatTime(availSeconds)} />] Logged
      </div>
      {/* Col 4 */}
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: '#64748b' }}>
        "{coachingStr}"
      </div>
    </div>
  );
};
