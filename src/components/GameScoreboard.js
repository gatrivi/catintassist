import React, { useState, useEffect } from 'react';
import { AppGuideButton } from './AppGuide';
import { StatNumber } from './StatNumber';
import { ConnectInterpretButton } from './ConnectInterpretButton';

// ─── ScoreboardTooltip ────────────────────────────────────────────────────────
// A lightweight 'toastie' popover for dynamic info on hover.
const ScoreboardTooltip = ({ show, x, y, title, content, color = '#3b82f6' }) => {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed',
      left: x,
      top: y,
      transform: 'translate(-50%, -110%)',
      zIndex: 10000,
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(8px)',
      border: `1px solid ${color}`,
      padding: '0.5rem 0.7rem',
      borderRadius: '6px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
      pointerEvents: 'none',
      width: 'max-content',
      maxWidth: '220px',
      animation: 'slideUpBounce 0.2s cubic-bezier(0.17, 0.88, 0.32, 1.28) forwards'
    }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#fff', lineHeight: 1.4, fontWeight: 500 }}>
        {content}
      </div>
    </div>
  );
};

// ─── EmojiRow ─────────────────────────────────────────────────────────────────
// Renders fullCount full emojis + one partially-cropped emoji representing the
// fractional remainder. Uses CSS clip-path on a wrapper for zero-DOM overhead.
const EmojiRow = ({ emoji, emptyEmoji, value, unitValue, maxValue, color = '#fff', label, sublabel, warnThreshold = 0.3, title, className = "", markers = [], isEditing, helpLabel, tooltipContent }) => {
  const [hover, setHover] = useState({ show: false, x: 0, y: 0 });
  
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

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ show: true, x: rect.left + rect.width / 2, y: rect.top });
  };

  return (
    <div 
      className={`${className} ${isEditing ? 'grid-edit-mode' : ''}`} 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHover({ ...hover, show: false })}
      style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative', padding: isEditing ? '2px' : '0', cursor: 'help' }}
    >
      <ScoreboardTooltip 
        show={hover.show && !!tooltipContent} 
        x={hover.x} y={hover.y} 
        title={helpLabel || "Metric Info"} 
        content={tooltipContent} 
        color={rowColor} 
      />
      
      {isEditing && <span className="edit-grid-label">{helpLabel}</span>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', lineHeight: 1, alignItems: 'center', position: 'relative' }}>
        <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.6)', fontWeight: 800, textTransform: 'uppercase', marginRight: '0.3rem', whiteSpace: 'nowrap', zIndex: 10 }}>
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

        <span style={{ marginLeft: 'auto', color: rowColor, fontWeight: 900, fontSize: '0.7rem', animation: ratio >= 1 ? 'pulseWarning 2s infinite' : 'none', textShadow: '0 0 5px rgba(0,0,0,0.5)' }}>{sublabel}</span>
      </div>
      <div style={{ fontSize: '0.45rem', opacity: 0.5, letterSpacing: '0.04em', color: '#fff', marginTop: '-2px', fontWeight: 600 }}>
        {typeof label === 'string' ? (label.split('   ')[1] || '') : ''}
      </div>
    </div>
  );
};

// ─── DirectionalCue ──────────────────────────────────────────────────────────
// Directional cue shown under the scoreboard header.
const IDLE_TIPS = [
  'At 9am the app auto-attaches your interpreting tab — watch the status bar above.',
  'Press C or ▶ CONNECT to attach; press again (CALL START) when the patient connects.',
  'Press M or 🎤 to use your device microphone instead of tab audio.',
  'Double-tap CONNECT to re-open the browser tab picker (Chrome preferred).',
  'Use Space/Alt+Space to toggle EN/ES detection while you wait.',
  'Pin key details with 📍 so voicemail numbers stay visible.',
  'Soundboard Studio (dock switch) — record greetings off-call only.',
];

const IDLE_CHECKLIST = [
  '① CONNECT tab · ② CALL START when patient is on · ③ STOP when done',
  'Status bar alternates connect vs mic tips until audio is attached.',
  'After attach: status says CALL START — timer begins only then.',
];

const ConnectingChecklist = ({ connectProgress }) => {
  const s = connectProgress || {};
  const step1 = !!s.audioStreamReady;
  const step2 = !!s.socketsOpen;
  const step3 = !!s.audioChunksSent;
  const step4 = !!s.transcriptReceived;

  const mk = (done, prevDone) => {
    if (done) return { mark: '✓', color: '#34d399' };
    if (prevDone) return { mark: '→', color: '#f59e0b' };
    return { mark: '•', color: 'rgba(255,255,255,0.35)' };
  };

  const row1 = mk(step1, false);
  const row2 = mk(step2, step1);
  const row3 = mk(step3, step2);
  const row4 = mk(step4, step3);

  // Keep it short: only show transcript row once audio is definitely flowing.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <div style={{ fontWeight: 900, fontSize: '0.7rem', color: '#f59e0b', lineHeight: 1.15 }}>
        Connecting to Deepgram
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
        <span style={{ color: row1.color, fontFamily: 'var(--font-mono, monospace)' }}>{row1.mark}</span>
        <span>1) Audio stream ready</span>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
        <span style={{ color: row2.color, fontFamily: 'var(--font-mono, monospace)' }}>{row2.mark}</span>
        <span>2) Deepgram sockets open</span>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
        <span style={{ color: row3.color, fontFamily: 'var(--font-mono, monospace)' }}>{row3.mark}</span>
        <span>3) Audio sending</span>
      </div>
      {step3 && (
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
          <span style={{ color: row4.color, fontFamily: 'var(--font-mono, monospace)' }}>{row4.mark}</span>
          <span>4) Waiting for transcript</span>
        </div>
      )}
    </div>
  );
};

const DirectionalCue = ({
  connectionState,
  connectProgress,
  pacePrediction, dailyGoal, totalDailyMins, breakLeft,
  qualityScore, cutoffWarning, isActive, isBreakActive,
  isZombieCall, audioAttached,
  onAttachAudio, onAttachAudioFresh, onStartCall,
  onRecovery, onConnectAnotherTab,
  shiftElapsedMins,
}) => {
  const [rotateTick, setRotateTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setRotateTick((n) => n + 1), 12000);
    return () => clearInterval(iv);
  }, []);

  const bucket = rotateTick % 3;
  const idleSecondary = (() => {
    if (bucket === 0) {
      return { label: 'Tip', text: IDLE_TIPS[rotateTick % IDLE_TIPS.length], color: '#9dffed' };
    }
    if (bucket === 1) {
      return { label: 'Flow', text: IDLE_CHECKLIST[rotateTick % IDLE_CHECKLIST.length], color: '#a5f3fc' };
    }
    const left = Math.max(0, Math.round(dailyGoal - totalDailyMins));
    const pace = pacePrediction?.label || '—';
    return {
      label: 'Shift',
      text: `${left}m to daily goal · pace ETA ${pace} · ${Math.round(breakLeft)}m break left`,
      color: '#fcd34d',
    };
  })();

  const showConnectChecklist =
    !isActive &&
    !isBreakActive &&
    connectProgress?.phase === 'connecting' &&
    !connectProgress?.transcriptReceived;

  const h = new Date().getHours();
  const goalsMet = totalDailyMins >= (dailyGoal || 1);

  if (isActive) {
    return (
      <div style={{ color: '#2dd4bf', fontWeight: 700, fontSize: '0.7rem', animation: 'encouragePulse 2s infinite' }}>
        ⬆️ Climbing — ETA {pacePrediction?.label || '?'}
      </div>
    );
  }

  if (isBreakActive) {
    return (
      <div style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.7rem' }}>
        ☕ Break. Return soon to keep the momentum.
      </div>
    );
  }

  const idleExtra = (() => {
    if (cutoffWarning?.pulse) {
      return { text: '🚨 DEADLINE NEAR — Work banks at 00:00. Log off soon to save streak!', color: '#ef4444', pulse: true };
    }
    if (goalsMet && h >= 18) return { text: '🌙 Daily goal reached and it\'s late. Rest up and win tomorrow? 💎', color: '#10b981' };
    if (goalsMet) return { text: '✅ Bounty secured — anything extra is pure profit 💎', color: '#10b981' };
    if (qualityScore?.goalUnreachable) return { text: `🎯 Adapt to ${qualityScore.suggestedGoal}m — still winnable.`, color: '#f97316' };
    if (breakLeft <= 0) return { text: '⚠️ Break budget spent. Every idle minute costs.', color: '#f59e0b' };
    return { text: null, color: '#9dffed' };
  })();

  const requiredIdleText = isZombieCall
    ? 'Call still active — press C or ▶ RE-ATTACH (timer saved)'
    : audioAttached
      ? 'Tab hooked — press C or ▶ CALL START when call begins'
      : 'Press C or ▶ CONNECT to attach interpreting platform';

  const connectLabel = isZombieCall ? 'RE-ATTACH' : audioAttached ? 'CALL START' : 'CONNECT';
  const handleSingle = () => {
    if (isZombieCall) return onRecovery?.();
    if (!audioAttached) return onAttachAudio?.();
    return onStartCall?.();
  };
  const handleDouble = () => {
    if (isZombieCall) return onRecovery?.();
    if (!audioAttached) return (onAttachAudioFresh || onAttachAudio)?.();
    return onConnectAnotherTab?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ color: '#10b981', fontWeight: 900, fontSize: '0.7rem', lineHeight: 1.2 }}>
        {requiredIdleText}
      </div>

      <ConnectInterpretButton
        size="idle"
        flash={!audioAttached && !isZombieCall}
        label={connectLabel}
        onSingle={handleSingle}
        onDouble={handleDouble}
        singleTitle={connectLabel}
        doubleTitle="attach another browser tab"
      />

      {showConnectChecklist ? (
        <ConnectingChecklist connectProgress={connectProgress} />
      ) : (
        <div style={{ color: idleSecondary.color, fontWeight: 600, fontSize: '0.7rem', lineHeight: 1.2 }}>
          {idleSecondary.label}: {idleSecondary.text}
        </div>
      )}

      {idleExtra?.text && (
        <div style={{
          color: idleExtra.color,
          fontWeight: 800,
          fontSize: '0.7rem',
          animation: idleExtra.pulse ? 'pulseWarning 1s infinite' : 'none',
          lineHeight: 1.2,
        }}>
          {idleExtra.text}
        </div>
      )}
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
  isEditingScoreboard, getCompensatedLogOff,
  isZombieCall,
  connectionState,
  connectProgress,
  audioAttached = false,
  onAttachAudio, onAttachAudioFresh, onStartCall,
  onRecovery, onConnectAnotherTab,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <AppGuideButton />
          <button onClick={onSwitchToNumbers} style={{
            fontSize: '0.52rem', padding: '0.1rem 0.35rem', borderRadius: '3px',
            border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
            color: 'rgba(255,255,255,0.25)', cursor: 'pointer'
          }} title="Switch to number view">123</button>
        </div>
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
          isZombieCall={isZombieCall}
          connectionState={connectionState}
          connectProgress={connectProgress}
          audioAttached={audioAttached}
          onAttachAudio={onAttachAudio}
          onAttachAudioFresh={onAttachAudioFresh}
          onStartCall={onStartCall}
          onRecovery={onRecovery}
          onConnectAnotherTab={onConnectAnotherTab}
          shiftElapsedMins={shiftElapsedMins}
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
              tooltipContent={`Banked: AR$${liveDailyArs.toLocaleString('es-AR')}. Target: AR$${dailyTargetArs.toLocaleString('es-AR')}. ${dailyTargetArs > liveDailyArs ? `AR$${(dailyTargetArs - liveDailyArs).toLocaleString('es-AR')} to bounty.` : 'Bounty secured!'}`}
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>earned</span>
                  <StatNumber value={liveDailyArs} prefix="AR$" size="xs" />
                  <span>/</span>
                  <StatNumber value={dailyTargetArs} prefix="AR$" size="xs" />
                </div>
              }
              sublabel={`${dayArsPct}%`}
            />

            <EmojiRow
              emoji="⏱️" value={totalDailyMins} unitValue={MIN_UNIT}
              maxValue={dayMinMax} isEditing={isEditingScoreboard} helpLabel="MINS_DAY"
              tooltipContent={`Worked: ${Math.round(totalDailyMins)}m. Goal: ${Math.round(dailyGoal)}m. ETA for goal: ${pacePrediction?.label || 'Calculating...'}.`}
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>mins</span>
                  <StatNumber value={totalDailyMins} suffix="m" size="xs" />
                  <span>/</span>
                  <StatNumber value={dailyGoal} suffix="m" size="xs" />
                </div>
              }
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
              tooltipContent={`Remaining: ${Math.round(breakLeft)}m of ${breakLimit}m budget. ${breakLeft < 15 ? '⚠️ Budget low!' : 'Healthy reserve.'}`}
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>break</span>
                  <StatNumber value={breakLeft} suffix="m" size="xs" />
                  <span>/</span>
                  <StatNumber value={breakLimit} suffix="m" size="xs" />
                </div>
              }
              sublabel={breakLeft > 0 ? 'READY' : 'SPENT'}
              warnThreshold={0.5}
            />

            <EmojiRow
              emoji="🔋" value={totalDailyMins} unitValue={Math.max(1, stats.dailyBreakMinutes || 1)} maxValue={totalDailyMins * 1.2}
              isEditing={isEditingScoreboard} helpLabel="STAMINA_RATIO"
              tooltipContent={`Work-to-Break Ratio: ${(totalDailyMins / Math.max(1, stats.dailyBreakMinutes || 1)).toFixed(1)}x. (Goal: 5.3x). This measures how many minutes of work you produce for every 1 minute of break. Higher is better.`}
              label={`stamina  ${(totalDailyMins / Math.max(1, stats.dailyBreakMinutes || 1)).toFixed(1)}x pace`}
              sublabel={(totalDailyMins / Math.max(1, stats.dailyBreakMinutes || 1)) >= 5.3 ? 'ELITE' : 'REST NEEDED'}
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
              helpLabel="MONEY_MONTH"
              tooltipContent={`Banked this month: AR$${monthlyArs.toLocaleString('es-AR')}. Target: AR$${monthlyTargetArs.toLocaleString('es-AR')}.`}
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>monthly</span>
                  <StatNumber value={monthlyArs} prefix="AR$" size="xs" />
                  <span>/</span>
                  <StatNumber value={monthlyTargetArs} prefix="AR$" size="xs" />
                </div>
              }
              sublabel={`${moArsPct}%`}
            />
            <EmojiRow
              emoji="🏗️" value={stats.monthlyMinutes} unitValue={MIN_UNIT * 10}
              maxValue={moMinMax}
              helpLabel="LADDER_MONTH"
              tooltipContent={`Current: ${Math.round(stats.monthlyMinutes)}m. Next milestone: ${nextMilestone}m (${nextGoalLabel}).`}
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>ladder</span>
                  <StatNumber value={stats.monthlyMinutes} suffix="m" size="xs" />
                  <span>/</span>
                  <StatNumber value={stats.goalMinutes} suffix="m" size="xs" />
                </div>
              }
              sublabel={`${moMinPct}%`}
            />
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, textAlign: 'right', marginTop: '0.1rem' }}>
               Tier Progress: <strong style={{ color: '#fff' }}>{nextGoalLabel}</strong> — {remainingDays} days left
            </div>
          </>
        )}
      </div>
    </div>
  );
};
