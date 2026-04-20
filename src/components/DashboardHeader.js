import React, { useState, useEffect } from 'react';
import { RollingNumber } from './RollingNumber';
import { useRewardAudio } from '../hooks/useRewardAudio';
import { useSession } from '../contexts/SessionContext';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { PlayIcon, StopIcon, KeyIcon, formatTime, GoalEditor, EditableMinutes, ConnectionIndicator } from './HeaderWidgets';
import { DialGoalSelector } from './DialGoalSelector';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { MonthHeatmap } from './MonthHeatmap';
import { TimeEditModal } from './TimeEditModal';
import { GameScoreboard } from './GameScoreboard';

const CelebrationParticles = ({ type, label, coins, onDismiss }) => {
  const [isClosing, setIsClosing] = useState(false);
  const emojis = ['🪙', '🪙', '💸', '💵', '💰', '💎'];
  const spread = type === 'month' ? 800 : (type === 'day' ? 600 : 350);
  const originX = type === 'month' ? '0px' : '-185px';
  const audioEngine = useProgressiveAudio();

  // Cap particles
  const safeCoinCount = Math.min(60, coins);

  useEffect(() => {
    if (isClosing) return;
    // ONLY play the rapid coin loop for Day/Month jackpots. 
    // Standard calls now use the clean Denomination Summary sounds.
    if (type === 'call') return; 

    audioEngine.initAudio();
    const iv = setInterval(() => { audioEngine.playCoin(); }, 150);
    return () => clearInterval(iv);
  }, [isClosing, audioEngine.playCoin, type]);
  
  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => onDismiss(), 250);
  };

  return (
    <div style={{ position: 'absolute', inset: -50, pointerEvents: 'auto', cursor: 'pointer', zIndex: 100, animation: isClosing ? 'fadeOutFast 0.25s forwards' : 'none' }} onClick={handleDismiss}>
      {Array.from({ length: safeCoinCount }).map((_, i) => (
        <span key={i} style={{
          position: 'absolute', left: '50%', top: '50%', fontSize: `${0.9 + Math.random() * 0.8}rem`,
          animation: `coinVacuum 1.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
          '--origin-x': originX, '--origin-y': '0px',
          '--start-x': `calc(${originX} + ${(Math.random() - 0.5) * spread}px)`, 
          '--start-y': `${Math.random() * -(spread * 0.8)}px` 
        }}>{emojis[Math.floor(Math.random() * emojis.length)]}</span>
      ))}
      <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: '1.2rem', fontWeight: 900,
          color: type === 'day' || type === 'month' ? '#fcd34d' : '#6ee7b7',
          textShadow: `0 0 20px ${type === 'day' ? '#f59e0b' : '#10b981'}`,
          whiteSpace: 'nowrap', animation: `textFloatTarget 2s ease-out forwards`,
          display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        {label.includes('AR$') ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span>{label.split('AR$')[0]}</span>
            <RollingNumber value={label.split('AR$')[1].replace(/[^\d]/g, '')} prefix="AR$" height={24} />
          </div>
        ) : label}
        <div style={{ fontSize: '0.5rem', fontWeight: 400, color: 'rgba(255,255,255,0.7)', textShadow: 'none', marginTop: '0.2rem' }}>[Click to Skip]</div>
      </div>
    </div>
  );
};

const StateIndicators = ({ state, breakMinutes, isZombie }) => {
  if (state === 'call') {
    return (
      <div className="emoji-money" style={{ fontSize: '1.1rem', marginRight: '0.2rem' }}>💰</div>
    );
  }
  if (state === 'break') {
    // 90 mins total budget. Each cup = 10 mins approx (total 9 cups)
    const cups = 9;
    const spentCups = Math.min(cups, Math.floor(breakMinutes / 10));
    return (
      <div className="resource-drain" title={`Break Budget: ${Math.floor(breakMinutes)}/90m used`} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', marginBottom: '4px' }}>
        {Array.from({ length: cups }).map((_, i) => (
          <span key={i} className={`resource-item ${i < spentCups ? 'spent' : ''}`} style={{ fontSize: '0.85rem', lineHeight: 1 }}>
            {i < spentCups ? '🍵' : '☕'}
          </span>
        ))}
      </div>
    );
  }
  // Zombie
  if (isZombie) {
    return (
      <div style={{ animation: 'pulseWarning 1s infinite', fontSize: '1rem', marginRight: '0.2rem', color: '#f59e0b' }}>
        🤖
      </div>
    );
  }
  // Avail
  return (
    <div style={{ animation: 'encouragePulse 3s infinite', fontSize: '1rem', marginRight: '0.2rem' }}>
      {Math.floor(Date.now() / 2000) % 2 === 0 ? '📡' : '⏳'}
    </div>
  );
};

export const DashboardHeader = ({ onStartAudio, onStopAudio, onReconnectStream, sttLanguage, onToggleLanguage, onRecovery, connectionState, connectionMessage }) => {
  const { isActive, sessionSeconds, setSessionSeconds, sessionEarnings, stats, updateStat, startSession, stopSession, endDay, RATE_PER_MINUTE, arsRate, setArsRate, isBreakActive, breakSeconds, startBreak, stopBreak, availSeconds, isEditingScoreboard, setIsEditingScoreboard, visibleCards, toggleCard, isNotesOpen, setIsNotesOpen, isToolbarVisible, setIsToolbarVisible, workSessionMinutes, isHeatmapOpen, setIsHeatmapOpen, isZombieCall, clearZombieState, translationMood, setTranslationMood } = useSession();
  const { outputDevices, inputDevices, selectedSinkId, selectedMicId, changeSinkId, changeMicId, fetchDevices } = useAudioSettings();
  const audioEngine = useProgressiveAudio();
  const { initAudio, playChaChing, playCoinStack } = useRewardAudio();

  const [isHold, setIsHold] = useState(false);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [celebration, setCelebration] = useState(null);
  const [isTodayDialOpen, setIsTodayDialOpen] = useState(false);
  const [displayBounty, setDisplayBounty] = useState(0);
  const [isBountyAnimating, setIsBountyAnimating] = useState(false);
  const [timeEditMode, setTimeEditMode] = useState(null); // 'call' | 'break' | null
  const [scoreView, setScoreView] = useState('numbers'); // 'game' | 'numbers'

  useEffect(() => {
    let iv; if (isHold) iv = setInterval(() => setHoldSeconds(s => s + 1), 1000); else setHoldSeconds(0);
    return () => clearInterval(iv);
  }, [isHold]);

  useEffect(() => {
    if (isActive && sessionSeconds > 0 && sessionSeconds % 60 === 0) {
      // PRO LADDER / SOUNDSCAPE INTERPRETER: 
      // Every minute played is a coin earned. Richer sound as minutes pass.
      const currentMin = Math.floor(sessionSeconds / 60);
      playChaChing(currentMin);
      audioEngine.playTick(currentMin); // KEEP legacy bronze tick for depth
    }
  }, [isActive, sessionSeconds, playChaChing, audioEngine]);

  // handleStart and local starting logic REMOVED to favor unified App-level handlers passed via props

  const handleStop = () => {
    stopSession((mins) => {
      // DENOMINATION PAYOUT LOGIC
      // Diamonds = 20m, Bills = 5m, Coins = 1m
      let rem = Math.round(mins);
      const diamonds = Math.floor(rem / 20); rem %= 20;
      const bills = Math.floor(rem / 5); rem %= 5;
      const coins = rem;

      // PRO LADDER / SOUNDSCAPE INTERPRETER: Play synthesized stack crash
      playCoinStack(mins);

      // Play summary sounds sequentially
      for(let i=0; i < diamonds; i++) setTimeout(() => audioEngine.playDiamond(), i * 400);
      for(let i=0; i < bills; i++) setTimeout(() => audioEngine.playBill(), (diamonds * 400) + (i * 300));
      for(let i=0; i < coins; i++) setTimeout(() => audioEngine.playCoin(), (diamonds * 400) + (bills * 300) + (i * 200));

      setCelebration({ type: 'call', label: `+AR$${Math.round(mins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}`, coins: Math.min(60, Math.floor(mins * 1.5)) });
      setTimeout(() => setCelebration(null), 4000);
    });
    onStopAudio();
  };
  const handleEndDay = () => {
    endDay((mins) => {
      audioEngine.playMetalChest();
      const dynamicItems = Math.min(200, Math.max(20, Math.floor(mins * 0.4)));
      setCelebration({ type: 'day', label: `Day Banked! +AR$${Math.round(mins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}`, coins: dynamicItems });
      setTimeout(() => setCelebration(null), 5000 + Math.min(3000, dynamicItems * 25));
    });
  };

  const handleStartBreak = () => {
    initAudio();
    startBreak();
  };

  // Calculations
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), currentDay = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = daysInMonth - currentDay + 1;
  const remainingMinutes = Math.max(0, stats.goalMinutes - stats.monthlyMinutes);
  const minutesBeforeToday = Math.max(0, stats.monthlyMinutes - stats.dailyMinutes);
  const remainingMinutesFromStartOfDay = Math.max(0, stats.goalMinutes - minutesBeforeToday);
  const requiredDailyAverage = remainingDays > 0 ? (remainingMinutesFromStartOfDay / remainingDays).toFixed(0) : 0;
  
  const dailyGoal = parseFloat(requiredDailyAverage) || 0;
  const unbankedMins = isActive ? (sessionSeconds / 60) : 0;
  const totalDailyMins = stats.dailyMinutes + unbankedMins;

  // CATCH-UP LOGIC: Dynamic shifts and SUCCESS ZONES
  const WORKDAY_START = 9, CORE_END = 18, ABSOLUTE_END = 23;
  const currentTime = now.getHours() + (now.getMinutes() / 60);
  const totalWorkdayHours = ABSOLUTE_END - WORKDAY_START; // 14h total
  const timeElapsedRatio = Math.min(1, Math.max(0, (currentTime - WORKDAY_START) / totalWorkdayHours));
  
  const getDayEmoji = () => {
    if (currentTime < 13) return '🌅';
    if (currentTime < 17) return '☀️';
    return '🌙';
  };
  const activeDayEmoji = getDayEmoji();

  // Condensed View metrics
  const liveDailyArs = Math.round(totalDailyMins * RATE_PER_MINUTE * arsRate);
  const dailyArs = Math.round(stats.dailyMinutes * RATE_PER_MINUTE * arsRate);
  const dailyTargetArs = Math.round(dailyGoal * RATE_PER_MINUTE * arsRate);
  const monthlyArs = Math.round(stats.monthlyMinutes * RATE_PER_MINUTE * arsRate);
  const monthlyTargetArs = Math.round(stats.goalMinutes * RATE_PER_MINUTE * arsRate);
  const currentBounty = Math.max(0, dailyTargetArs - liveDailyArs);

  useEffect(() => {
    if (Math.abs(displayBounty - currentBounty) > 1) {
      setIsBountyAnimating(true);
      const timer = setTimeout(() => {
        setDisplayBounty(currentBounty);
        setIsBountyAnimating(false);
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [currentBounty]);

  // Initialize bounty on load
  useEffect(() => {
    setDisplayBounty(currentBounty);
  }, []);

  const morningLeft = Math.max(0, 13 - currentTime);
  const afternoonLeft = Math.max(0, 17 - Math.max(13, currentTime));
  const eveningLeft = Math.max(0, 23 - Math.max(17, currentTime));

  let hoursLeftToAbsolute = Math.max(0, ABSOLUTE_END - currentTime);
  
  // Estimated workable mins from now
  const workableMinsRemaining = hoursLeftToAbsolute * 35;
  const workableHoursRemaining = workableMinsRemaining / 60;
  
  const realisticMaxToday = stats.dailyMinutes + workableMinsRemaining;
  
  const remainingWorkdaysThisMonth = Math.max(0, remainingDays - 1);
  const monthlyMaxMins = stats.monthlyMinutes + workableMinsRemaining + (remainingWorkdaysThisMonth * 14 * 35);
  const monthlyRemainingCashVal = Math.round((workableMinsRemaining + remainingWorkdaysThisMonth * 14 * 35) * RATE_PER_MINUTE * arsRate);
  const monthlyRemainingCash = monthlyRemainingCashVal.toLocaleString('es-AR');
  const dailyMaxArs = Math.round(realisticMaxToday * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
  const monthlyMaxArs = Math.round(monthlyMaxMins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
  const actualDailyAverage = currentDay > 0 ? (stats.monthlyMinutes / currentDay) : 0;
  const workableArsRemaining = Math.round(workableMinsRemaining * RATE_PER_MINUTE * arsRate);
  
  const monthElapsedRatio = currentDay / daysInMonth;
  const isMonthlyGoalMet = stats.monthlyMinutes >= stats.goalMinutes;
  const monthlyProgressRatio = stats.goalMinutes > 0 ? Math.min(1, stats.monthlyMinutes / stats.goalMinutes) : 0;
  const monthlyPendingRatio = stats.goalMinutes > 0 ? Math.min(1, (stats.monthlyMinutes + unbankedMins) / stats.goalMinutes) : 0;
  const isDailyGoalMet = stats.dailyMinutes >= dailyGoal;

  const getCompensatedLogOff = () => {
    if (!stats.dayStartTime) return '18:00';
    const start = new Date(stats.dayStartTime);
    const nineAM = new Date(stats.dayStartTime);
    nineAM.setHours(9, 0, 0, 0);
    const lateStartMs = Math.max(0, start.getTime() - nineAM.getTime());
    const totalBreakMs = (stats.dailyBreakMinutes || 0) * 60000;
    const safeDateString = stats.lastDate || new Date().toDateString();
    const end = new Date(safeDateString + ' 18:00:00');
    const compensatedTime = new Date(end.getTime() + lateStartMs + totalBreakMs);
    if (isNaN(compensatedTime.getTime())) return '18:00';
    return compensatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const shiftStartStr = stats.dayStartTime ? new Date(stats.dayStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
  const shiftElapsedMins = stats.dayStartTime ? Math.max(0, (Date.now() - stats.dayStartTime) / 60000) : 0;
  const breakLimit = 90;
  const breakUsed = stats.dailyBreakMinutes || 0;
  const breakLeft = Math.max(0, breakLimit - breakUsed);
  const cashToTodayGoal = Math.max(0, dailyTargetArs - liveDailyArs);

  const formatHoursMins = (totalMins) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    return `${h}h${m > 0 ? `${m}m` : ''}`;
  };

  // SIMPLIFIED 12-STEP ENGINE (5500m floor based)
  const FLOOR = 5500;
  const WEEK_STEP = 1375; // 5500 / 4
  
  const milestones = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => (i + 1) * WEEK_STEP);
  }, []);

  const milestoneLabels = [
    "Step 1: Floor Prep", "Step 2: Floor Rise", "Step 3: Floor Push", "🪜 LADDER: FLOOR (5500m)",
    "Step 5: Growth Prep", "Step 6: Growth Rise", "Step 7: Growth Push", "🚀 LADDER: GROWTH (11k)",
    "Step 9: Legend Prep", "Step 10: Legend Rise", "Step 11: Legend Push", "👑 LADDER: LEGEND (16.5k)"
  ];

  const nextMilestone = milestones.find(m => m > stats.monthlyMinutes) || milestones[milestones.length - 1];
  const currentIdx = milestones.indexOf(nextMilestone);
  const nextGoalLabel = milestoneLabels[currentIdx];
  const isAllGoalsMet = stats.monthlyMinutes >= milestones[11];

  // ── HARD CUTOFF (00:00 Midnight) ──────────────────────────────────────────
  // User availability stops at 00:00. This tracks how much time is left in the "day".
  const HARD_CUTOFF_HOUR = 24; 
  const currentHour = new Date().getHours();
  const currentMin = new Date().getMinutes();
  const minsToHardCutoff = Math.max(0, ((HARD_CUTOFF_HOUR * 60) - (currentHour * 60 + currentMin)));
  
  const cutoffWarning = (() => {
    if (minsToHardCutoff <= 1)   return { label: 'MIDNIGHT DEADLINE', color: '#ef4444', pulse: true };
    if (minsToHardCutoff <= 20)  return { label: `🚨 ${Math.round(minsToHardCutoff)}m left`, color: '#ef4444', pulse: true };
    if (minsToHardCutoff <= 45)  return { label: `⚠️ ${Math.round(minsToHardCutoff)}m`, color: '#f59e0b', pulse: false };
    if (minsToHardCutoff <= 90)  return { label: `🌙 Nightly Stop`, color: '#fcd34d', pulse: false };
    return null;
  })();
  const availableWindowMins = minsToHardCutoff;

  // ── MONTHLY DEFICIT & RECOVERY ───────────────────────────────────
  const GROWTH_TARGET = 11000; // Growth tier = real goal, Floor (5500) = survival
  const expectedByToday = Math.round((stats.goalMinutes / daysInMonth) * currentDay);
  const monthlyDeficitMins = expectedByToday - stats.monthlyMinutes; // positive = behind
  const isInDeficit = monthlyDeficitMins > 30;
  // Per-day needed to reach Growth (11k) by month end
  const recoveryDailyTarget = remainingDays > 0 ? Math.ceil(Math.max(0, GROWTH_TARGET - stats.monthlyMinutes) / remainingDays) : 0;
  const survivalDailyTarget = remainingDays > 0 ? Math.ceil(Math.max(0, 5500 - stats.monthlyMinutes) / remainingDays) : 0;

  // ── SMART METRICS ────────────────────────────────────────────────
  // Use TOTAL (banked + live) so everything updates tick-by-tick during a call
  const totalDailyMinsLive = stats.dailyMinutes + unbankedMins;

  // PACE ETA: predicts when you'll hit today's goal at current earned rate
  const pacePrediction = (() => {
    const remaining = Math.max(0, dailyGoal - totalDailyMinsLive);
    if (remaining <= 0) return { label: '✅ Done!', color: '#10b981', detail: null };
    if (totalDailyMinsLive < 5 || shiftElapsedMins < 10) return { label: '–', color: 'var(--text-muted)', detail: 'Warming up...' };
    const ratePerShiftMin = totalDailyMinsLive / shiftElapsedMins; // live rate
    if (ratePerShiftMin <= 0) return { label: '–', color: 'var(--text-muted)', detail: null };
    const minsToGoal = remaining / ratePerShiftMin;
    const goalTime = new Date(Date.now() + minsToGoal * 60000);
    const hh = goalTime.getHours().toString().padStart(2, '0');
    const mm = goalTime.getMinutes().toString().padStart(2, '0');
    const isBeforeCutoff = goalTime.getHours() < HARD_CUTOFF_HOUR;
    const isBeforeShift = goalTime.getHours() < 18;
    return {
      label: `${hh}:${mm}`,
      color: isBeforeCutoff ? (isBeforeShift ? '#10b981' : '#34d399') : '#ef4444',
      detail: isBeforeCutoff ? 'achievable today' : 'past 20:00 cutoff'
    };
  })();

  // QUALITY: late-start aware pacing score (uses live mins)
  const maxEarnableToday = totalDailyMinsLive + (availableWindowMins * 0.58);
  const qualityScore = (() => {
    if (shiftElapsedMins < 5 || dailyGoal <= 0) return null;
    const sessionWindowMins = shiftElapsedMins + availableWindowMins;
    const idealNow = Math.min(dailyGoal, dailyGoal * (shiftElapsedMins / Math.max(sessionWindowMins, 30)));
    if (idealNow <= 0) return null;
    const pct = Math.round((totalDailyMinsLive / idealNow) * 100);
    const capped = Math.min(150, pct);
    let color = '#ef4444';
    if (capped >= 100) color = '#10b981';
    else if (capped >= 80) color = '#34d399';
    else if (capped >= 60) color = '#f59e0b';
    const goalUnreachable = maxEarnableToday < dailyGoal;
    // Suggest a realistic goal rounded to nearest 5m
    const suggestedGoal = Math.floor(maxEarnableToday / 5) * 5;
    return { pct: capped, color, goalUnreachable, suggestedGoal };
  })();

  // STREAK: past days + live "today on track" indicator
  const streak = stats.streak || 0;
  const todayOnTrack = dailyGoal > 0 && totalDailyMinsLive >= dailyGoal;

  // CALL RATE, EFFECTIVE RATE
  const callsToday = stats.callsToday || 0;
  const avgCallMins = callsToday > 0 ? Math.round(totalDailyMinsLive / Math.max(callsToday, 1)) : 0;
  const effectiveRateArsHr = shiftElapsedMins > 10
    ? Math.round((liveDailyArs / shiftElapsedMins) * 60)
    : null;

  const copyValue = (v) => navigator.clipboard.writeText(String(v).replace(/[^\d]/g, ''));

  return (
    <header className="dashboard-header glass-panel" style={{ position: 'relative', zIndex: 100 }}>
      {isZombieCall && (
        <div className="zombie-banner-premium" onClick={onRecovery}>
          <span style={{ fontSize: '1.1rem' }}>🤖</span> 
          <span>Master, app was restarted mid-call. <b>Press to Reconnect.</b></span>
        </div>
      )}

      {/* COLLAPSED VIEW */}
      {isCollapsed && (
        <div className="condensed-header-card" style={{ gap: '0.15rem' }}>
          
          {/* Controls & Mini-Stats Column (LEFT) */}
          <div id="controls-left-col" className={`header-column-side ${isActive ? 'active-working-state' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0, justifyContent: 'flex-start', alignItems: 'center' }}>
            <div id="connection-controls-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'center' }}>
              <StateIndicators state={isActive ? 'call' : isBreakActive ? 'break' : 'avail'} breakMinutes={stats.dailyBreakMinutes || 0} isZombie={isZombieCall} />
              <ConnectionIndicator state={connectionState} message={connectionMessage} />
              {!isActive ? (
                <button id="header-connect-btn" className="btn-emoji" onClick={isZombieCall ? onRecovery : onStartAudio} style={{ background: isZombieCall ? '#f59e0b' : '#10b981', color: '#fff', width: '22px', height: '22px' }} title={isZombieCall ? "RECONNECT" : "CONNECT"}>{isZombieCall ? '🟠' : '🟢'}</button>
              ) : (
                <button id="header-stop-btn" className="btn-emoji" onClick={handleStop} style={{ background: '#ef4444', color: '#fff', width: '22px', height: '22px' }} title="STOP">🛑</button>
              )}

              {!isActive ? (
                <>
                  <button id="header-break-btn" className="btn-emoji" onClick={isBreakActive ? stopBreak : handleStartBreak} style={{ background: '#fb923c', color: '#fff', width: '22px', height: '22px' }} title="BREAK">☕</button>
                  {stats.dailyMinutes > 0 && !isBreakActive && (
                    <button id="header-end-day-btn" className="btn-emoji" onClick={handleEndDay} style={{ background: '#8b5cf6', color: '#fff', width: '22px', height: '22px' }} title="END DAY">🌙</button>
                  )}
                </>
              ) : (
                <>
                  <button id="header-hold-btn" className="btn btn-condensed" onClick={() => setIsHold(!isHold)} style={{ background: isHold ? '#f59e0b' : 'rgba(255,255,255,0.08)', height: '22px', padding: '0 0.3rem', fontSize: '0.6rem' }}>{isHold ? `⏸${formatTime(holdSeconds)}` : '⏸'}</button>
                  <button id="header-zap-btn" className="btn-emoji" onClick={onReconnectStream} style={{ background: '#0ea5e9', width: '22px', height: '22px' }} title="ZAP">⚡</button>
                </>
              )}
            </div>
            
            <div id="left-pills-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
               <div id="pill-shift" className="metric-pill compact-pill" title="SHIFT PROGRESS: Total time elapsed since you first connected today. Reset at midnight.">
                 <span style={{ fontSize: '0.58rem' }}>🏃{formatHoursMins(shiftElapsedMins)}</span>
               </div>
               <div id="pill-sprint" className="metric-pill compact-pill" title="SPRINT: Unbroken session time elapsed since your day started or since your last coffee break. Resets when you start a break.">
                 <span style={{ fontSize: '0.58rem' }}>🔋{Math.floor(workSessionMinutes)}m</span>
               </div>
               <div id="pill-logoff" className="metric-pill compact-pill" title="ESTIMATED LOG OFF: Calculated time to end your shift (usually 18:00), adjusted by your late start time and break usage today." style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                 <span style={{ color: '#fcd34d', fontSize: '0.58rem' }}>🚪{getCompensatedLogOff()}</span>
               </div>
               <div id="edit-buttons-row" style={{ display: 'flex', gap: '0.08rem' }}>
                 <button id="header-call-edit-btn" className="edit-btn-tiny" onClick={() => setTimeEditMode('call')} title="Edit call time">✏️📞</button>
                 <button id="header-break-edit-btn" className="edit-btn-tiny" onClick={() => setTimeEditMode('break')} title="Edit break time">✏️☕</button>
               </div>
            </div>
          </div>

          {/* SCOREBOARD: Game view (CENTER) */}
          <div id="header-scoreboard-center" style={{ flex: '1 1 0', minWidth: 0, margin: '0 0.1rem' }}>
            {scoreView === 'game' ? (
              <GameScoreboard
                liveDailyArs={liveDailyArs} dailyTargetArs={dailyTargetArs}
                monthlyArs={monthlyArs} monthlyTargetArs={monthlyTargetArs}
                stats={stats} dailyGoal={dailyGoal} totalDailyMins={totalDailyMins}
                shiftElapsedMins={shiftElapsedMins}
                pacePrediction={pacePrediction} qualityScore={qualityScore} cutoffWarning={cutoffWarning}
                breakLeft={breakLeft} breakLimit={breakLimit}
                nextGoalLabel={nextGoalLabel} nextMilestone={nextMilestone}
                daysInMonth={daysInMonth} currentDay={currentDay} remainingDays={remainingDays}
                isActive={isActive} isBreakActive={isBreakActive}
                onSwitchToNumbers={() => setScoreView('numbers')}
              />
            ) : (
              <div id="numeric-metric-grid" className="metric-grid">
                {/* 1. Mins worked today */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Minutes worked today" style={{ position: 'relative', background: 'rgba(59,130,246,0.06)' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">1. MINS TODAY</span>}
                  <div className="metric-cell-val" style={{ color: '#60a5fa' }}>{Math.round(totalDailyMins)}m</div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '1. MINS TODAY'}</div>
                </div>

                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Minutes left for daily goal" style={{ position: 'relative', background: 'rgba(239,68,68,0.04)' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">2. LEFT TODAY</span>}
                  <div className="metric-cell-val" style={{ color: '#fca5a5' }}>{Math.round(Math.max(0, dailyGoal - totalDailyMins))}m</div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '2. LEFT TODAY'}</div>
                </div>

                {/* 3. Goal mins */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Target goal minutes for today" style={{ position: 'relative', background: 'rgba(52,211,153,0.04)' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">3. TODAY GOAL</span>}
                  <div className="metric-cell-val">{Math.round(dailyGoal)}m</div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '3. TODAY GOAL'}</div>
                </div>

                {/* 4. Money today */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Money earned today" style={{ position: 'relative', background: 'rgba(16,185,129,0.06)' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">4. $ TODAY</span>}
                  <div className="metric-cell-val" style={{ color: '#34d399' }}><RollingNumber value={liveDailyArs} prefix="$" height={24} /></div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '4. $ TODAY'}</div>
                </div>

                {/* 5. Money to be made today */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Money remaining for today's goal" style={{ position: 'relative', background: 'rgba(245,158,11,0.04)' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">5. $ LEFT TODAY</span>}
                  <div className="metric-cell-val" style={{ color: '#fcd34d' }}><RollingNumber value={cashToTodayGoal} prefix="$" height={24} /></div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '5. $ LEFT TODAY'}</div>
                </div>

                {/* 6. Money month */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Money earned this month" style={{ position: 'relative' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">6. $ MONTH</span>}
                  <div className="metric-cell-val"><RollingNumber value={monthlyArs} prefix="$" height={24} /></div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '6. $ MONTH'}</div>
                </div>

                {/* 7. Money left month */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Money remaining for monthly goal" style={{ position: 'relative' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">7. $ LEFT MONTH</span>}
                  <div className="metric-cell-val"><RollingNumber value={Math.max(0, monthlyTargetArs - monthlyArs)} prefix="$" height={24} /></div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '7. $ LEFT MONTH'}</div>
                </div>

                {/* 8. Breaks used today */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Break minutes used today" style={{ position: 'relative', background: 'rgba(251,146,60,0.06)' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">8. BREAK USED</span>}
                  <div className="metric-cell-val" style={{ color: '#fdba74' }}>{Math.round(stats.dailyBreakMinutes || 0)}m</div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '8. BREAK USED'}</div>
                </div>

                {/* 9. Avg so far mo */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Average minutes per day so far this month" style={{ position: 'relative', background: 'rgba(139,92,246,0.04)' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">9. MO AVG</span>}
                  <div className="metric-cell-val">{Math.round(actualDailyAverage)}m</div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '9. MO AVG'}</div>
                </div>

                {/* 10. Avg to meet min goal */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Average needed per day for Level 1 (Min Goal)" style={{ position: 'relative' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">10. REQ TO MIN</span>}
                  <div className="metric-cell-val" style={{ color: '#9ca3af' }}>{Math.round(survivalDailyTarget)}m</div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '10. REQ TO MIN'}</div>
                </div>

                {/* 11. Avg to meet goal lvl 2 */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Average needed per day for Level 2 (Growth Goal)" style={{ position: 'relative', background: 'rgba(168,85,247,0.06)' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">11. REQ TO LVL2</span>}
                  <div className="metric-cell-val" style={{ color: '#c084fc' }}>{Math.round(recoveryDailyTarget)}m</div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '11. REQ TO LVL2'}</div>
                </div>

                {/* 12. Current call min and cash */}
                <div className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`} title="Current call duration and unbanked cash" style={{ position: 'relative', background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)', border: isActive ? '1px solid rgba(16,185,129,0.3)' : 'none' }}>
                  {isEditingScoreboard && <span className="edit-grid-label">12. CURR CALL</span>}
                  <div className="metric-cell-val" style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                    <span>{formatTime(sessionSeconds)}</span>
                    <span style={{ fontSize: '1rem', color: '#34d399' }}>${Math.round(sessionEarnings * arsRate)}</span>
                  </div>
                  <div className="metric-cell-label">{!isEditingScoreboard && '12. CURR CALL'}</div>
                </div>
                
                {/* Switch back row */}
                <div id="cell-switch-game" className="metric-cell" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.04)', gridColumn: 'span 4', flexDirection: 'row', minHeight: '30px' }} onClick={() => setScoreView('game')} title="Switch back to gamified game view">
                  <span style={{ fontSize: '0.9rem', marginRight: '6px' }}>🎮</span>
                  <div className="metric-cell-label" style={{ opacity: 0.8 }}>RETURN TO GAMIFIED VIEW</div>
                </div>
              </div>
            )}
          </div>

          {/* Stats Column (RIGHT) - Constrained to prevent workspace waste */}
          <div id="controls-right-col" className="header-column-side" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flexShrink: 0, justifyContent: 'flex-start', alignItems: 'center', width: '60px' }}>
             <div id="right-pills-stack" style={{ display: 'flex', flexDirection: 'column', gap: '0.04rem', alignItems: 'center' }}>
               {/* CALL RATE PILL */}
               {callsToday > 0 ? (
                 <div id="pill-call-rate" className="metric-pill compact-pill" title={`CALL METRICS: You've taken ${callsToday} calls today. Your average call duration is ${avgCallMins} minutes per call.`} style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                   <span style={{ fontSize: '0.58rem', color: '#93c5fd', fontWeight: 700 }}>📞{callsToday}×{avgCallMins}m</span>
                 </div>
               ) : (
                 <div id="pill-no-calls" className="metric-pill compact-pill" style={{ opacity: 0.2 }}>
                   <span style={{ fontSize: '0.58rem' }}>📞 –</span>
                 </div>
               )}
               {/* EFFECTIVE RATE PILL */}
               {effectiveRateArsHr ? (
                 <div id="pill-eff-rate" className="metric-pill compact-pill" title={`EFFECTIVE RATE: Your actual AR$ earned per hour, including the dead time (Avail) spent waiting for calls. Currently AR$${effectiveRateArsHr.toLocaleString('es-AR')}/hr.`} style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                   <span style={{ fontSize: '0.58rem', color: '#c4b5fd', fontWeight: 700 }}>⚡${effectiveRateArsHr.toLocaleString('es-AR')}/h</span>
                 </div>
               ) : (
                 <div id="pill-no-rate" className="metric-pill compact-pill" style={{ opacity: 0.2 }}>
                   <span style={{ fontSize: '0.58rem' }}>⚡ –</span>
                 </div>
               )}
             </div>

             <div id="feature-toggles-row" style={{ display: 'flex', gap: '0.1rem', marginTop: '0.15rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button id="header-notes-btn" className="btn-icon tiny-btn" onClick={() => setIsNotesOpen(!isNotesOpen)} style={{ opacity: isNotesOpen ? 1 : 0.3 }} title="Notes">📝</button>
                <button id="header-tools-btn" className="btn-icon tiny-btn" onClick={() => setIsToolbarVisible(!isToolbarVisible)} style={{ opacity: isToolbarVisible ? 1 : 0.3 }} title="Tools">🛠️</button>
                <button id="header-heatmap-btn" className="btn-icon tiny-btn" onClick={() => setIsHeatmapOpen(true)} title="Monthly Heatmap">📅</button>
                <button id="header-expand-btn" className="btn-icon tiny-btn" onClick={() => setIsCollapsed(false)} title="Expand HUD">🔼</button>
             </div>
          </div>
        </div>
      )}

      {/* ── EXPANDED TWO-ROW DASHBOARD ── */}
      {!isCollapsed && (
        <div className="income-dashboard">
          
          {/* UPPER ROW: High-Level Progress & The Bounty */}
          <div className="dashboard-row dashboard-row-upper">
            
            {/* Today's Bounty (THE STAR) */}
            <div className="income-card" style={{ flex: '2 1 0', minWidth: 0, background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', padding: '0.3rem 0.4rem', borderRadius: '10px' }} title={`TODAY'S BOUNTY: The remaining AR$ you need to earn today to hit your personalized daily goal (Target: AR$${dailyTargetArs.toLocaleString('es-AR')}).`}>
              <span className="income-label" style={{ color: '#6ee7b7', fontWeight: 800 }}>💰 TODAY'S BOUNTY</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 900, 
                  color: isBountyAnimating ? '#fcd34d' : '#fff',
                  transition: 'color 0.3s ease',
                  textShadow: isBountyAnimating ? '0 0 15px rgba(252, 211, 77, 0.5)' : 'none',
                  whiteSpace: 'nowrap'
                }}>
                  <RollingNumber value={displayBounty} prefix="AR$" height={26} />
                </div>
                {isBountyAnimating && <span style={{ fontSize: '0.7rem', color: '#6ee7b7', animation: 'slideUpBounce 0.5s' }}>-tick</span>}
              </div>
              <span style={{ fontSize: '0.55rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Target: AR${dailyTargetArs.toLocaleString('es-AR')}</span>
            </div>

            {/* Monthly Profit */}
            {(isEditingScoreboard || visibleCards.month) && (
              <div className="income-card income-tier-1" style={{ flex: '1 1 0', minWidth: 0 }} title="MONTHLY PROFIT: Your total banked earnings for the month against your ultimate monthly target.">
                <span className="income-label">🗓️ MO.PROFIT</span>
                <span className="income-ars" style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>🌊</span>
                  <RollingNumber value={monthlyArs} prefix="$" height={24} />
                </span>
                <span style={{ fontSize: '0.55rem', opacity: 0.5, whiteSpace: 'nowrap', display: 'flex', gap: '0.1rem' }}>
                  <span>/</span>
                  <RollingNumber value={monthlyTargetArs} prefix="$" height={10} />
                </span>
              </div>
            )}

            {/* Today's Shift Progress */}
            {(isEditingScoreboard || visibleCards.today) && (
              <div className="income-card income-tier-2" style={{ flex: '1 1 0', minWidth: 0, cursor: 'pointer' }} onClick={() => !isEditingScoreboard && setIsTodayDialOpen(true)} title="DAILY PROGRESS: Minutes banked today out of your total daily target minutes required based on your monthly pacing.">
                <span className="income-label">{activeDayEmoji} DAILY</span>
                <span className="income-ars" style={{ whiteSpace: 'nowrap' }}>🌊{Math.round(stats.dailyMinutes)}m/🎯{Math.round(dailyGoal)}m</span>
                <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>({(stats.dailyMinutes / (dailyGoal || 1) * 100).toFixed(0)}%)</span>
              </div>
            )}

            {/* Goal Ladder */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }} title={`PRO LADDER: Your next immediate target on the 12-step ladder. Reaching ${nextMilestone}m levels you up!`}>
               <span className="income-label">🪜 NEXT</span>
               <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#a855f7', whiteSpace: 'nowrap' }}>{nextGoalLabel}</span>
               <span style={{ fontSize: '0.55rem', opacity: 0.6, whiteSpace: 'nowrap' }}>{nextMilestone}m</span>
            </div>
          </div>

          {/* MIDDLE ROW: Smart Intelligence Metrics */}
          <div style={{ display: 'flex', gap: '0.4rem', padding: '0.2rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

            {/* PACE ETA */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: 'rgba(59,130,246,0.06)' }}
              title={`PACE ETA: Predicts the exact clock time you will hit your daily goal if you maintain your current rate of earning minutes. Currently projecting ${pacePrediction.label}. ${pacePrediction.detail || ''}`}>
              <span className="income-label">🎯 PACE ETA</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: pacePrediction.color }}>{pacePrediction.label}</span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{pacePrediction.detail || 'at current rate'}</span>
            </div>

            {/* QUALITY */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: 'rgba(59,130,246,0.06)' }}
              title={qualityScore?.goalUnreachable
                ? `DAY QUALITY: Goal (${Math.round(dailyGoal)}m) unreachable before midnight cutoff. Suggested adaptive realistic goal: ${qualityScore.suggestedGoal}m.`
                : qualityScore ? `DAY QUALITY: ${qualityScore.pct}% of your ideal required pace for your current session window. Keep it near 100%!` : 'DAY QUALITY: Not enough data yet to calculate pacing quality.'}>
              <span className="income-label">📈 QUALITY</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: qualityScore?.goalUnreachable ? '#f59e0b' : (qualityScore?.color || 'var(--text-muted)') }}>
                {qualityScore?.goalUnreachable ? `→ ${qualityScore.suggestedGoal}m` : qualityScore ? `${qualityScore.pct}%` : '–'}
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>
                {qualityScore?.goalUnreachable ? 'adapt today\'s goal' : 'vs ideal pace'}
              </span>
            </div>

            {/* STREAK */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: todayOnTrack ? 'rgba(16,185,129,0.08)' : 'rgba(251,146,60,0.06)' }}
              title={`STREAK: You have hit your goal for ${streak} consecutive past days. ${todayOnTrack ? "You have already hit today's goal! (+1 day added to streak at midnight)" : "Today is still in progress."}`}>
              <span className="income-label">🔥 STREAK</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: todayOnTrack ? '#10b981' : streak >= 3 ? '#fb923c' : streak > 0 ? '#fcd34d' : 'var(--text-muted)' }}>
                {streak > 0 ? `${streak}d` : ''}{todayOnTrack ? (streak > 0 ? '+today ✅' : 'today ✅') : streak === 0 ? 'none yet' : ''}
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{todayOnTrack ? 'goal already hit!' : 'past days at goal'}</span>
            </div>

            {/* CALL RATE */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: 'rgba(59,130,246,0.06)' }}
              title={`CALLS: You have taken ${callsToday} calls today, with an average duration of ${avgCallMins} minutes each.`}>
              <span className="income-label">📞 CALLS</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: callsToday > 0 ? '#93c5fd' : 'var(--text-muted)' }}>
                {callsToday > 0 ? `${callsToday}×${avgCallMins}m` : '–'}
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>count × avg mins</span>
            </div>

            {/* EFFECTIVE RATE */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: 'rgba(139,92,246,0.06)' }}
              title={`EFFECTIVE RATE: AR$${effectiveRateArsHr?.toLocaleString('es-AR') || '–'}/hr. This represents your true hourly wage today, factoring in both active call time and unpaid waiting time (Avail).`}>
              <span className="income-label">⚡ EFF. RATE</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: effectiveRateArsHr ? '#c4b5fd' : 'var(--text-muted)' }}>
                {effectiveRateArsHr ? `$${effectiveRateArsHr.toLocaleString('es-AR')}/h` : '–'}
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>incl. avail time</span>
            </div>

            {/* BREAK BUDGET */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: breakLeft < 15 ? 'rgba(239,68,68,0.06)' : 'rgba(251,146,60,0.06)' }}
              title={`BREAK BUDGET: You have ${Math.round(breakLeft)} minutes left of your ${breakLimit}-minute daily coffee break allowance.`}>
              <span className="income-label">☕ BREAK LEFT</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: breakLeft < 15 ? '#ef4444' : breakLeft < 30 ? '#f59e0b' : '#6ee7b7' }}>
                {Math.round(breakLeft)}m
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>of {breakLimit}m budget</span>
            </div>

          </div>

          {/* LOWER ROW: Interaction & Live Metrics */}
          <div className="dashboard-row dashboard-row-lower">
            
            {/* Main Controls Group */}
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <StateIndicators state={isActive ? 'call' : isBreakActive ? 'break' : 'avail'} breakMinutes={stats.dailyBreakMinutes || 0} />
              {!isActive ? (
                 <button id="connect-btn" className="btn btn-primary" onClick={onStartAudio} style={{ padding: '0.4rem 0.8rem' }}><PlayIcon /> Connect</button>
              ) : (
                <button id="stop-btn" className="btn btn-danger" onClick={handleStop}><StopIcon /> STOP</button>
              )}
              {isBreakActive ? (
                <button id="stop-break-btn" className="btn" onClick={stopBreak} style={{ background: '#fb923c', color: 'white' }}>STOP BREAK</button>
              ) : (
                <button id="break-btn" className="btn" onClick={startBreak} disabled={isActive} style={{ opacity: isActive ? 0.3 : 1 }}>COFFEE</button>
              )}
              <button id="call-edit-btn-expanded" onClick={() => setTimeEditMode('call')} title="Edit call time" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.6rem', color: '#93c5fd' }}>✏️📞</button>
              <button id="break-edit-btn-expanded" onClick={() => setTimeEditMode('break')} title="Edit break time" style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.6rem', color: '#fdba74' }}>✏️☕</button>
            </div>

            {/* Current Call (Live) */}
            {(isEditingScoreboard || visibleCards.call) && (
              <div className={`income-card ${isActive ? 'active' : ''}`} style={{ flex: '1 1 0', minWidth: 0, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }} title="CURRENT CALL: Active duration and unbanked earnings of the ongoing call. Resets every time you hit STOP.">
                <span className="income-label" style={{ fontSize: '0.55rem' }}>CALL ({formatTime(sessionSeconds)})</span>
                <span className="income-ars" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  <RollingNumber value={Math.round(sessionEarnings * arsRate)} prefix="AR$" height={18} />
                </span>
              </div>
            )}

            {/* Audio Sinks */}
            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', flexShrink: 1, minWidth: 0 }}>
              <select className="btn" style={{ fontSize: '0.6rem', maxWidth: '80px', minWidth: '50px', flex: '1 1 0' }} value={selectedMicId} onChange={e => changeMicId(e.target.value)} onFocus={fetchDevices}>
                <option value="">🎤 Mic</option>
                {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
              </select>
              <select className="btn" style={{ fontSize: '0.6rem', maxWidth: '80px', minWidth: '50px', flex: '1 1 0' }} value={selectedSinkId} onChange={e => changeSinkId(e.target.value)} onFocus={fetchDevices}>
                <option value="">🔊 Spk</option>
                {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Spk ${d.deviceId.slice(0,5)}`}</option>)}
              </select>
            </div>

            {/* Footer Stats: Break, Work Session */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }}>
              <div className="income-card" title="SESSION (SPRINT): Unbroken session time elapsed since your day started or since your last coffee break. Tracks your endurance! Resets when you start a break.">
                <span className="income-label">🔋SESSION</span>
                <span style={{ fontSize: '0.8rem', color: '#60a5fa' }}>{Math.floor(workSessionMinutes)}m</span>
              </div>
              <div className="income-card" title="ESTIMATED LOG OFF: The exact clock time you should log off to meet your daily targeted hours, pushed backward or forward by late arrivals and break times.">
                <span className="income-label">🚪LOGOUT</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{getCompensatedLogOff()}</span>
              </div>
            </div>

            {/* Tool toggles — consolidated single row to maximize workspace */}
            <div className="consolidated-toolbar" style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', flexShrink: 0, paddingLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
              <button id="notes-toggle-btn" className={`btn-compact ${isNotesOpen ? 'active' : ''}`} onClick={() => setIsNotesOpen(!isNotesOpen)} title="Toggle Notes">📝</button>
              <button id="tools-toggle-btn" className={`btn-compact ${isToolbarVisible ? 'active' : ''}`} onClick={() => setIsToolbarVisible(!isToolbarVisible)} title="Toggle Tools">🛠️</button>
              <button id="heatmap-btn-expanded" className="btn-compact" onClick={() => setIsHeatmapOpen(true)} title="Monthly Heatmap">📅</button>
              <button id="edit-scoreboard-btn" className={`btn-compact ${isEditingScoreboard ? 'active-edit' : ''}`} onClick={() => setIsEditingScoreboard(!isEditingScoreboard)} title={isEditingScoreboard ? 'Save Grid' : 'Edit Grid'}>
                {isEditingScoreboard ? '💾' : '✏️'}
              </button>
              <button id="collapse-btn" className="btn-compact danger" onClick={() => setIsCollapsed(true)} title="Collapse Scoreboard">▲</button>
            </div>
          </div>
        </div>
      )}


      {/* Progress bars (Always Visible) */}

      {/* Progress bars (Always Visible) */}
      {dailyGoal > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.3rem 0.4rem 0.1rem' }}>
          {/* Monthly bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>🗓️ Day {currentDay}/{daysInMonth}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {!isMonthlyGoalMet ? (
                  <>
                    <span 
                      title={`This is your next immediate target on The Pro Ladder. Reach this to level up! (1% = ${Math.floor(stats.goalMinutes / 100)}m)`}
                      style={{ color: '#fff', background: 'rgba(59,130,246,0.3)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.4)', fontWeight: 800, cursor: 'help' }}>
                       🪜 {nextGoalLabel} ({nextMilestone}m)
                    </span>
                    <span 
                      title={`Current Progress towards your Monthly Goal. (1% = ${Math.floor(stats.goalMinutes / 100)}m)`}
                      style={{ margin: '0 0.4rem', fontSize: '0.75rem', color: isMonthlyGoalMet ? '#10b981' : '#a855f7', fontWeight: 800, cursor: 'help' }}>
                      {((stats.monthlyMinutes / (stats.goalMinutes || 1)) * 100).toFixed(1)}%
                    </span>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span 
                      title="Maximum potential ARS you can earn this month if you maintain your current daily pace."
                      style={{ background: 'rgba(139,92,246,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)', cursor: 'help' }}>
                      Paced Max: <strong style={{ color: '#d8b4fe', textShadow: '0 0 8px rgba(139,92,246,0.5)', display: 'inline-flex', alignItems: 'center' }}>
                        <RollingNumber value={monthlyRemainingCashVal} prefix="AR$" height={12} />
                      </strong>
                    </span>
                  </>
                ) : (
                  <span style={{ color: stats.monthlyMinutes > stats.goalMinutes * 1.2 ? '#fcd34d' : '#34d399', fontWeight: 800 }}>
                    {stats.monthlyMinutes > milestones[11] ? '👑 LEGENDARY STATUS REACHED!' : stats.monthlyMinutes > stats.goalMinutes * 1.2 ? '🔥 UNSTOPPABLE!' : stats.monthlyMinutes > stats.goalMinutes * 1.1 ? '🚀 ORBIT (110%!)' : '🎉 Goal Met!'}
                  </span>
                )}
              </div>
              <span style={{ opacity: 0.5 }}>Goal: {stats.goalMinutes}m</span>
            </div>
            <div style={{ position: 'relative', marginTop: '0.3rem' }}>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 11 }}>
                {[5500, 11000, 16500].map((m, i) => {
                  const ratio = m / 16500;
                  const labels = ['MIN GOAL', 'GOOD', 'EXCELLENT'];
                  return (
                    <div key={`lbl-${m}`} style={{ position: 'absolute', left: `${ratio * 100}%`, top: '-11px' }}>
                      <span style={{ position: 'absolute', left: '-50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: '4px', fontSize: '0.45rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>
                        {labels[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ height: '7px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${monthlyPendingRatio * 100}%`, backgroundColor: '#f97316', opacity: 0.9, transition: 'width 1s linear', zIndex: 1, boxShadow: unbankedMins > 0 ? '0 0 10px #f97316' : 'none' }} />
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${monthlyProgressRatio * 100}%`, backgroundColor: isMonthlyGoalMet ? '#10b981' : '#a855f7', transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 2 }} />
              {stats.monthlyMinutes > stats.goalMinutes && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, (stats.monthlyMinutes - stats.goalMinutes) / (stats.goalMinutes * 0.2)) * 100}%`, backgroundColor: 'rgba(245,158,11,0.8)', zIndex: 3 }} />}
              
              {/* Milestone Indicators (Checkpoints at 5.5k, 11k, 16.5k) */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 4 }}>
                {[5500, 11000, 16500].map((m, i) => {
                  const ratio = m / 16500;
                  return (
                    <div 
                      key={m} 
                      title={`Monthly Rank: ${['Floor (5.5k)', 'Growth (11k)', 'Legend (16.5k)'][i]}`}
                      style={{ 
                        position: 'absolute', left: `${ratio * 100}%`, top: 0, bottom: 0, width: '1px', 
                        background: 'rgba(255,255,255,0.6)',
                        boxShadow: '0 0 4px white',
                        pointerEvents: 'auto', cursor: 'help'
                      }}>
                    </div>
                  );
                })}
              </div>

              {/* 500min Nudges (8h shifts) overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none', zIndex: 4 }}>
                {Array.from({ length: Math.max(0, Math.floor((stats.goalMinutes || 16500) / 500)) }).map((_, i) => {
                  const m = (i + 1) * 500;
                  const ratio = m / (stats.goalMinutes || 16500);
                  if (ratio >= 1) return null;
                  
                  // Calculate absolute distance to the NEXT milestone on the Pro Ladder (steps of 1375)
                  const nextMilestoneAbsolute = Math.ceil((m + 1) / 1375) * 1375;
                  const minsToNextMilestone = nextMilestoneAbsolute - m;
                  const shiftsToNextMilestone = (minsToNextMilestone / 500).toFixed(1);

                  return (
                    <div 
                      key={m} 
                      title={`Shift Checkpoint: ${m}m. You are ${shiftsToNextMilestone} shifts (${minsToNextMilestone}m) away from the next Ladder Milestone (${nextMilestoneAbsolute}m).`}
                      style={{ 
                        position: 'absolute', left: `${ratio * 100}%`, top: 0, bottom: 0, width: '1px', 
                        background: 'rgba(59,130,246,0.5)',
                        pointerEvents: 'auto', cursor: 'help'
                      }}>
                    </div>
                  );
                })}
              </div>

              {/* Day Notches overlay */}
              <div 
                title="Each vertical notch represents one day of the month. The thick white line is TODAY."
                style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'auto', zIndex: 5, cursor: 'help' }}>
                {Array.from({ length: daysInMonth }).map((_, i) => (
                  <div key={i} style={{ flex: 1, borderRight: i < daysInMonth - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }} />
                ))}
              </div>

              <div 
                title={`Today is Day ${currentDay}. Stay ahead of this line to keep your pace!`}
                style={{ position: 'absolute', top: 0, bottom: 0, left: `${monthElapsedRatio * 100}%`, width: '2px', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, cursor: 'help', pointerEvents: 'auto' }} />
            </div>
          </div>
          </div>

          {/* Step Goal (Weekly Replenishing Bar) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 600 }}>🪜 STEP {currentIdx + 1}/12 (1 WEEK OF MINIMUM WORK)</span>
                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', color: '#fff', fontSize: '0.55rem', fontWeight: 800 }}>
                  🗓️ Day {currentDay} (Week {Math.ceil(currentDay / 7)})
                </span>
              </div>
              <span title={`Each step on the Ladder is 1,375m. 4 steps = Min Goal (5.5k). 8 steps = Growth (11k). 12 steps = Legend (16.5k).`}>
                <strong style={{ color: stats.monthlyMinutes >= 11000 ? '#FCD34D' : (stats.monthlyMinutes >= 5500 ? '#C084FC' : '#60A5FA') }}>
                  {milestoneLabels[currentIdx]}
                </strong> ({Math.round(stats.monthlyMinutes % 1375)}m / 1375m)
              </span>
            </div>
            <div 
              title="Weekly Ladder: This bar fills up every 1375m. It's your current sprint target."
              style={{ height: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden', position: 'relative', cursor: 'help' }}>
              <div style={{ 
                position: 'absolute', left: 0, top: 0, bottom: 0, 
                width: `${((stats.monthlyMinutes % 1375) / 1375) * 100}%`, 
                background: stats.monthlyMinutes >= 11000 ? '#fcd34d' : (stats.monthlyMinutes >= 5500 ? '#a855f7' : '#3b82f6'),
                boxShadow: `0 0 10px ${stats.monthlyMinutes >= 11000 ? 'rgba(251,191,36,0.4)' : (stats.monthlyMinutes >= 5500 ? 'rgba(139,92,246,0.4)' : 'rgba(59,130,246,0.4)')}`,
                transition: 'width 0.5s ease-out',
                zIndex: 2
              }} />
              
              {/* 500min Nudges (8h shifts) overlay for the Step Bar */}
              <div style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none', zIndex: 5 }}>
                {(() => {
                  const stepStart = currentIdx * 1375;
                  const stepEnd = stepStart + 1375;
                  const firstShiftIdx = Math.floor(stepStart / 500) + 1;
                  const nudges = [];
                  let shiftM = firstShiftIdx * 500;
                  while (shiftM < stepEnd) {
                    nudges.push(shiftM);
                    shiftM += 500;
                  }
                  
                  const valuePerShift = Math.round(500 * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
                  
                  return nudges.map(m => {
                    const ratio = (m - stepStart) / 1375;
                    const shiftNumber = m / 500;
                    return (
                      <div 
                        key={m} 
                        title={`Shift #${shiftNumber} Threshold (${m}m elapsed total). Completing an 8-hour shift guarantees ~AR$${valuePerShift}. Keep pushing!`}
                        style={{ 
                          position: 'absolute', left: `${ratio * 100}%`, top: 0, bottom: 0, width: '2px', 
                          background: 'rgba(59,130,246,0.8)',
                          boxShadow: '0 0 4px rgba(59,130,246,0.8)',
                          pointerEvents: 'auto', cursor: 'help'
                        }}>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Daily bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <span title="Workday starts at 9:00 AM">☀️ 09:00 (Min: {dailyGoal}m)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {stats.dailyMinutes >= 480 ? (
                  <span style={{ color: '#fcd34d', fontWeight: 800 }}>👑 LEGENDARY DAY (480m+)</span>
                ) : stats.dailyMinutes >= 350 ? (
                  <span style={{ color: '#c084fc', fontWeight: 800 }}>🚀 GROWTH DAY (350m+)</span>
                ) : stats.dailyMinutes >= dailyGoal ? (
                  <span style={{ color: '#34d399', fontWeight: 800 }}>🎉 SHIFT MET ({dailyGoal}m)</span>
                ) : (
                  <>
                    <span title="Literally how many hours are left until 11:00 PM.">⏳ {hoursLeftToAbsolute.toFixed(1)}h left</span>
                    <span title="Assuming you work 35 mins per hour (allowing for breaks/avail), this is how many minutes/money you can bank today.">({Math.round(workableMinsRemaining)}m / AR$${Math.round(workableMinsRemaining * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')})</span>
                  </>
                )}
              </div>
              <span title="Workday ends at 11:00 PM">🌙 23:00 (Focus: 480m)</span>
            </div>
            <div 
              title="Daily Multi-Tier Bar: Blue (Floor), Purple (350m Growth), Gold (480m focus)."
              style={{ height: '6px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', position: 'relative', overflow: 'hidden', cursor: 'help' }}>
              
              {/* Target Notches */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 4 }}>
                {[dailyGoal, 350].map(m => (
                  <div key={m} style={{ position: 'absolute', left: `${(m / 480) * 100}%`, top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }} />
                ))}
              </div>

              {/* Progress Fill (Unbanked) */}
              <div 
                title={`Unbanked Progress: You have ${formatTime(sessionSeconds)} in the current call.`}
                style={{ 
                  position: 'absolute', left: 0, top: 0, bottom: 0, 
                  width: `${Math.min(1, (stats.dailyMinutes + unbankedMins) / 480) * 100}%`, 
                  backgroundColor: '#f97316', 
                  opacity: 0.9, transition: 'width 1s linear', zIndex: 1, 
                  boxShadow: unbankedMins > 0 ? '0 0 10px #f97316' : 'none', pointerEvents: 'auto' 
                }} />
              
              {/* Progress Fill (Banked) */}
              <div 
                title={`Daily Total: ${Math.round(stats.dailyMinutes)}m`}
                style={{ 
                  position: 'absolute', left: 0, top: 0, bottom: 0, 
                  width: `${Math.min(1, stats.dailyMinutes / 480) * 100}%`, 
                  backgroundColor: stats.dailyMinutes >= 480 ? '#fcd34d' : (stats.dailyMinutes >= 350 ? '#a855f7' : '#3b82f6'), 
                  transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 2, pointerEvents: 'auto' 
                }} />
              
              {/* Hour Notches overlay with Financial Overlays */}
              <div 
                title={`Progress: ${liveDailyArs.toLocaleString('es-AR')} / ${dailyTargetArs.toLocaleString('es-AR')} ARS. Each notch represents 1 hour of the workday (9 AM - 11 PM).`}
                style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'auto', zIndex: 11, cursor: 'help' }}>
                
                {/* Banked Money Label (Left) */}
                <div style={{ 
                  position: 'absolute', left: '0.4rem', top: '-11px', 
                  fontSize: '0.48rem', fontWeight: 900, 
                  color: '#fff', textShadow: '0 0 8px rgba(16,185,129,0.8)',
                  background: 'rgba(16,185,129,0.3)', padding: '0 0.3rem', 
                  borderRadius: '2px', border: '1px solid rgba(16,185,129,0.4)',
                  pointerEvents: 'none', letterSpacing: '0.04em'
                }}>
                  BANKED: AR${liveDailyArs.toLocaleString('es-AR')}
                </div>
                
                {/* Est Max Label (Right) */}
                <div style={{ 
                  position: 'absolute', right: '0.4rem', top: '-11px', 
                  fontSize: '0.48rem', fontWeight: 700, 
                  color: 'rgba(255,255,255,0.6)', 
                  background: 'rgba(0,0,0,0.4)', padding: '0 0.3rem', 
                  borderRadius: '2px', border: '1px solid rgba(255,255,255,0.1)',
                  pointerEvents: 'none', letterSpacing: '0.02em'
                }}>
                  EST. MAX: AR${Math.round(realisticMaxToday * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}
                </div>

                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, borderRight: i < 13 ? '1px solid rgba(255,255,255,0.15)' : 'none' }} />
                ))}
              </div>

              <div 
                title="Current Time indicator. Keep the daily bar touching or ahead of this line."
                style={{ position: 'absolute', top: 0, bottom: 0, left: `${timeElapsedRatio * 100}%`, width: '2px', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, cursor: 'help', pointerEvents: 'auto' }} />
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL DIAL SELECTOR TRIGGER */}
      {isTodayDialOpen && (
        <DialGoalSelector
          ratePerMinute={RATE_PER_MINUTE}
          arsRate={arsRate}
          setArsRate={setArsRate}
          initialGoalMinutes={stats.goalMinutes}
          onSave={(m) => { updateStat('goalMinutes', m); setIsTodayDialOpen(false); }}
          onCancel={() => setIsTodayDialOpen(false)}
        />
      )}

      {/* MONTH HEATMAP */}
      {isHeatmapOpen && <MonthHeatmap />}

      {/* TIME EDIT MODAL */}
      {timeEditMode && <TimeEditModal mode={timeEditMode} onClose={() => setTimeEditMode(null)} />}
    </header>
  );
};
