import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { PlayIcon, StopIcon, KeyIcon, formatTime, GoalEditor, EditableMinutes, ConnectionIndicator } from './HeaderWidgets';
import { DialGoalSelector } from './DialGoalSelector';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';

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
      }}>
        {label}
        <div style={{ fontSize: '0.5rem', fontWeight: 400, color: 'rgba(255,255,255,0.7)', textShadow: 'none', marginTop: '0.2rem' }}>[Click to Skip]</div>
      </div>
    </div>
  );
};

export const DashboardHeader = ({ onStartAudio, onStopAudio, onReconnectStream, sttLanguage, onToggleLanguage, connectionState, connectionMessage }) => {
  const { isActive, sessionSeconds, setSessionSeconds, sessionEarnings, stats, updateStat, startSession, stopSession, endDay, RATE_PER_MINUTE, arsRate, setArsRate, isBreakActive, breakSeconds, startBreak, stopBreak, availSeconds, isEditingScoreboard, setIsEditingScoreboard, visibleCards, toggleCard, isNotesOpen, setIsNotesOpen, isToolbarVisible, setIsToolbarVisible, workSessionMinutes } = useSession();
  const { outputDevices, inputDevices, selectedSinkId, selectedMicId, changeSinkId, changeMicId, fetchDevices } = useAudioSettings();
  const audioEngine = useProgressiveAudio();

  const [isHold, setIsHold] = useState(false);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [celebration, setCelebration] = useState(null);
  const [isTodayDialOpen, setIsTodayDialOpen] = useState(false);
  const [displayBounty, setDisplayBounty] = useState(0);
  const [isBountyAnimating, setIsBountyAnimating] = useState(false);

  useEffect(() => {
    let iv; if (isHold) iv = setInterval(() => setHoldSeconds(s => s + 1), 1000); else setHoldSeconds(0);
    return () => clearInterval(iv);
  }, [isHold]);

  useEffect(() => {
    if (isActive && sessionSeconds > 0 && sessionSeconds % 60 === 0) {
      // Dynamic tick: minute 1 is quiet, minute 10+ is ringing
      audioEngine.playTick(Math.floor(sessionSeconds / 60));
    }
  }, [isActive, sessionSeconds, audioEngine.playTick]);

  const handleStart = async () => { 
    audioEngine.playBagOpen(); 
    const ok = await onStartAudio(); 
    if (ok) startSession(); 
  };

  const handleStop = () => {
    stopSession((mins) => {
      // DENOMINATION PAYOUT LOGIC
      // Diamonds = 20m, Bills = 5m, Coins = 1m
      let rem = Math.round(mins);
      const diamonds = Math.floor(rem / 20); rem %= 20;
      const bills = Math.floor(rem / 5); rem %= 5;
      const coins = rem;

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
  const dailyArs = Math.round(stats.dailyMinutes * RATE_PER_MINUTE * arsRate);
  const dailyTargetArs = Math.round(dailyGoal * RATE_PER_MINUTE * arsRate);
  const monthlyArs = Math.round(stats.monthlyMinutes * RATE_PER_MINUTE * arsRate);
  const monthlyTargetArs = Math.round(stats.goalMinutes * RATE_PER_MINUTE * arsRate);
  const currentBounty = Math.max(0, dailyTargetArs - dailyArs);

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
  const monthlyRemainingCash = Math.round((workableMinsRemaining + remainingWorkdaysThisMonth * 14 * 35) * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
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
  const cashToTodayGoal = Math.max(0, dailyTargetArs - dailyArs);

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

  // ── HARD CUTOFF (20:00) ──────────────────────────────────────────
  // 20:00 stop → 4h wind-down → 7h sleep → 2h wind-up → 9am restart
  const HARD_CUTOFF_HOUR = 20;
  const minsToHardCutoff = Math.max(0, (HARD_CUTOFF_HOUR - currentTime) * 60);
  const availableWindowMins = minsToHardCutoff; // mins left before hard stop
  // Cutoff warning: only show when within 1 hour of cutoff
  const cutoffWarning = (() => {
    if (minsToHardCutoff <= 0)  return { label: 'STOP 20:00', color: '#ef4444', pulse: true };
    if (minsToHardCutoff <= 15) return { label: `🚨 ${Math.round(minsToHardCutoff)}m`, color: '#ef4444', pulse: true };
    if (minsToHardCutoff <= 30) return { label: `⚠️ ${Math.round(minsToHardCutoff)}m`, color: '#f59e0b', pulse: false };
    if (minsToHardCutoff <= 60) return { label: `🕐 1h`, color: '#fcd34d', pulse: false };
    return null;
  })();

  // ── MONTHLY DEFICIT & RECOVERY ───────────────────────────────────
  const GROWTH_TARGET = 11000; // Growth tier = real goal, Floor (5500) = survival
  const expectedByToday = Math.round((stats.goalMinutes / daysInMonth) * currentDay);
  const monthlyDeficitMins = expectedByToday - stats.monthlyMinutes; // positive = behind
  const isInDeficit = monthlyDeficitMins > 30;
  // Per-day needed to reach Growth (11k) by month end
  const recoveryDailyTarget = remainingDays > 0 ? Math.ceil(Math.max(0, GROWTH_TARGET - stats.monthlyMinutes) / remainingDays) : 0;
  const survivalDailyTarget = remainingDays > 0 ? Math.ceil(Math.max(0, 5500 - stats.monthlyMinutes) / remainingDays) : 0;

  // ── SMART METRICS ────────────────────────────────────────────────
  // PACE: predicted time to hit today's goal at current earned rate
  // Warns red if predicted ETA is past hard cutoff (20:00)
  const pacePrediction = (() => {
    const remaining = Math.max(0, dailyGoal - stats.dailyMinutes);
    if (remaining <= 0) return { label: '✅ Done!', color: '#10b981', detail: null };
    if (stats.dailyMinutes < 5 || shiftElapsedMins < 10) return { label: '–', color: 'var(--text-muted)', detail: 'Warming up...' };
    const ratePerShiftMin = stats.dailyMinutes / shiftElapsedMins;
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

  // QUALITY: late-start aware — compares to actual available window, not 8hr flat
  // If you log in at 14:00 with 20:00 cutoff, 100% = perfect for a 6hr session
  const maxEarnableToday = stats.dailyMinutes + (availableWindowMins * 0.58); // ~35m/hr density
  const qualityScore = (() => {
    if (shiftElapsedMins < 5 || dailyGoal <= 0) return null;
    const sessionWindowMins = shiftElapsedMins + availableWindowMins;
    const idealNow = Math.min(dailyGoal, dailyGoal * (shiftElapsedMins / Math.max(sessionWindowMins, 30)));
    if (idealNow <= 0) return null;
    const pct = Math.round((stats.dailyMinutes / idealNow) * 100);
    const capped = Math.min(150, pct);
    let color = '#ef4444';
    if (capped >= 100) color = '#10b981';
    else if (capped >= 80) color = '#34d399';
    else if (capped >= 60) color = '#f59e0b';
    const goalUnreachable = maxEarnableToday < dailyGoal;
    return { pct: capped, color, goalUnreachable };
  })();

  // STREAK, CALL RATE, EFFECTIVE RATE
  const streak = stats.streak || 0;
  const callsToday = stats.callsToday || 0;
  const avgCallMins = callsToday > 0 ? Math.round(stats.dailyMinutes / callsToday) : 0;
  const effectiveRateArsHr = shiftElapsedMins > 10
    ? Math.round((dailyArs / shiftElapsedMins) * 60)
    : null;

  const copyValue = (v) => navigator.clipboard.writeText(String(v).replace(/[^\d]/g, ''));

  return (
    <header className="dashboard-header glass-panel" style={{ position: 'relative', zIndex: 100 }}>

      {/* COLLAPSED VIEW */}
      {isCollapsed && (
        <div className="condensed-header-card" style={{ gap: '0.15rem' }}>
          
          {/* Controls & Mini-Stats Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem', flexShrink: 0, minWidth: '130px' }}>
            <div style={{ display: 'flex', gap: '0.15rem', alignItems: 'center' }}>
              <ConnectionIndicator state={connectionState} message={connectionMessage} />
              {!isActive ? (
                <button className="btn-emoji" onClick={handleStart} style={{ background: '#10b981', color: '#fff' }} title="CONNECT">🟢</button>
              ) : (
                <button className="btn-emoji" onClick={handleStop} style={{ background: '#ef4444', color: '#fff' }} title="STOP">🛑</button>
              )}
              
              {!isActive ? (
                <>
                  <button className="btn-emoji" onClick={isBreakActive ? stopBreak : startBreak} style={{ background: '#fb923c', color: '#fff' }} title="BREAK">☕</button>
                  {stats.dailyMinutes > 0 && !isBreakActive && (
                    <button className="btn-emoji" onClick={handleEndDay} style={{ background: '#8b5cf6', color: '#fff' }} title="END DAY">🌙</button>
                  )}
                </>
              ) : (
                <>
                  <button className="btn btn-condensed" onClick={() => setIsHold(!isHold)} style={{ background: isHold ? '#f59e0b' : 'rgba(255,255,255,0.1)', height: '26px' }}>{isHold ? `⏸${formatTime(holdSeconds)}` : '⏸'}</button>
                  <button className="btn-emoji" onClick={onReconnectStream} style={{ background: '#0ea5e9' }} title="ZAP">⚡</button>
                </>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.15rem', alignItems: 'center' }}>
               <div className="metric-pill" title="SHIFT PROGRESS" style={{ height: '22px' }}>
                 <span style={{ fontSize: '0.65rem' }}>🏃{formatHoursMins(shiftElapsedMins)}</span>
               </div>
               <div className="metric-pill" title="SPRINT" style={{ height: '22px' }}>
                 <span style={{ fontSize: '0.65rem' }}>🔋{Math.floor(workSessionMinutes)}m</span>
               </div>
               <div className="metric-pill" title="LOG OFF" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', height: '22px' }}>
                 <span style={{ color: '#fcd34d', fontSize: '0.65rem' }}>🚪{getCompensatedLogOff()}</span>
               </div>
            </div>
          </div>

          {/* THE SMART 2x3 GRID — Row 1: Money | Row 2: Intelligence */}
          <div className="metric-grid">

            {/* ── ROW 1: MONEY ── */}
            {/* BOUNTY: remaining ARS to earn today — the most actionable single number */}
            <div className="metric-cell" title="BOUNTY: ARS left to earn today to hit your quota" style={{ background: cashToTodayGoal <= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(52,211,153,0.04)' }}>
              <div className="metric-watermark"><span>🏹</span></div>
              <div className="metric-cell-val" style={{ color: cashToTodayGoal <= 0 ? '#10b981' : 'rgba(255,255,255,0.8)' }}>
                {cashToTodayGoal <= 0 ? '✅' : `$${cashToTodayGoal.toLocaleString('es-AR')}`}
              </div>
              <div style={{ fontSize: '0.42rem', opacity: 0.4, letterSpacing: '0.04em' }}>BOUNTY</div>
            </div>

            {/* DAY CASH: how much earned vs today's quota */}
            <div className="metric-cell" title="DAY CASH: Banked ARS vs daily quota">
              <div className="metric-watermark"><span>☀️💰</span></div>
              <div className="metric-cell-val">${dailyArs.toLocaleString('es-AR')} / ${dailyTargetArs.toLocaleString('es-AR')}</div>
              <div style={{ fontSize: '0.42rem', opacity: 0.4, letterSpacing: '0.04em' }}>DAY $</div>
            </div>

            {/* MONTH CASH: long-game progress */}
            <div className="metric-cell" title="MONTH CASH: Total earned vs monthly ladder goal">
              <div className="metric-watermark"><span>🗓️💰</span></div>
              <div className="metric-cell-val">${monthlyArs.toLocaleString('es-AR')} / ${monthlyTargetArs.toLocaleString('es-AR')}</div>
              <div style={{ fontSize: '0.42rem', opacity: 0.4, letterSpacing: '0.04em' }}>MONTH $</div>
            </div>

            {/* ── ROW 2: INTELLIGENCE ── */}
            {/* PACE ETA: predicts when you'll hit today's goal */}
            <div className="metric-cell" title={`PACE: At this rate you'll hit today's goal at ${pacePrediction.label}. ${pacePrediction.detail || ''}`} style={{ background: 'rgba(59,130,246,0.04)' }}>
              <div className="metric-watermark"><span>🎯</span></div>
              <div className="metric-cell-val" style={{ color: pacePrediction.color }}>{pacePrediction.label}</div>
              <div style={{ fontSize: '0.42rem', opacity: 0.4, letterSpacing: '0.04em' }}>PACE ETA</div>
            </div>

            {/* QUALITY: late-start aware pacing score */}
            <div className="metric-cell"
              title={qualityScore?.goalUnreachable
                ? `Today's goal (${Math.round(dailyGoal)}m) unreachable before 20:00. Max ~${Math.round(maxEarnableToday)}m. Consider adapting today's target.`
                : qualityScore ? `DAY QUALITY: ${qualityScore.pct}% of ideal pace for your actual session window.` : 'Not enough data yet'}
              style={{ background: 'rgba(59,130,246,0.04)' }}>
              <div className="metric-watermark"><span>📈</span></div>
              <div className="metric-cell-val" style={{ color: qualityScore?.goalUnreachable ? '#f59e0b' : (qualityScore?.color || 'var(--text-muted)') }}>
                {qualityScore?.goalUnreachable ? '⚡Adapt' : qualityScore ? `${qualityScore.pct}%` : '–'}
              </div>
              <div style={{ fontSize: '0.42rem', opacity: 0.4, letterSpacing: '0.04em' }}>QUALITY</div>
            </div>

            {/* STREAK: consecutive good days — loss aversion motivation */}
            <div className="metric-cell" title={`STREAK: ${streak} consecutive day(s) hitting daily goal`} style={{ background: 'rgba(59,130,246,0.04)' }}>
              <div className="metric-watermark"><span>🔥</span></div>
              <div className="metric-cell-val" style={{ color: streak >= 3 ? '#fb923c' : streak > 0 ? '#fcd34d' : 'var(--text-muted)' }}>
                {streak > 0 ? `${streak}🔥` : '–'}
              </div>
              <div style={{ fontSize: '0.42rem', opacity: 0.4, letterSpacing: '0.04em' }}>STREAK</div>
            </div>

          </div>

          {/* Right Section: Call Rate + Effective Rate + Tool toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.08rem', alignItems: 'flex-end', minWidth: '115px' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.08rem', alignItems: 'flex-end' }}>
               {/* CALL RATE PILL */}
               {callsToday > 0 ? (
                 <div className="metric-pill" title={`${callsToday} calls today, avg ${avgCallMins}m each`} style={{ height: '22px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)' }}>
                   <span style={{ fontSize: '0.62rem', color: '#93c5fd', fontWeight: 700 }}>📞{callsToday}×{avgCallMins}m</span>
                 </div>
               ) : (
                 <div className="metric-pill" title="No calls banked yet" style={{ height: '22px', opacity: 0.3 }}>
                   <span style={{ fontSize: '0.62rem' }}>📞 No calls yet</span>
                 </div>
               )}
               {/* EFFECTIVE RATE PILL */}
               {effectiveRateArsHr ? (
                 <div className="metric-pill" title={`Effective Rate: AR$${effectiveRateArsHr.toLocaleString('es-AR')}/hr including avail time`} style={{ height: '22px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)' }}>
                   <span style={{ fontSize: '0.62rem', color: '#c4b5fd', fontWeight: 700 }}>⚡${effectiveRateArsHr.toLocaleString('es-AR')}/h</span>
                 </div>
               ) : (
                 <div className="metric-pill" style={{ height: '22px', opacity: 0.3 }}>
                   <span style={{ fontSize: '0.62rem' }}>⚡ –/h</span>
                 </div>
               )}
             </div>

             <div style={{ display: 'flex', gap: '0.2rem' }}>
                <button className="btn-icon" onClick={() => setIsNotesOpen(!isNotesOpen)} style={{ opacity: isNotesOpen ? 1 : 0.4 }}>📝</button>
                <button className="btn-icon" onClick={() => setIsToolbarVisible(!isToolbarVisible)} style={{ opacity: isToolbarVisible ? 1 : 0.4 }}>🛠️</button>
                <button className="btn-icon" onClick={() => setIsCollapsed(false)}>🔼</button>
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
            <div className="income-card" style={{ flex: '2 1 0', minWidth: 0, background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', padding: '0.3rem 0.4rem', borderRadius: '10px' }}>
              <span className="income-label" style={{ color: '#6ee7b7', fontWeight: 800 }}>💰 TODAY'S BOUNTY</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 900, 
                  color: isBountyAnimating ? '#fcd34d' : '#fff',
                  transition: 'color 0.3s ease',
                  textShadow: isBountyAnimating ? '0 0 15px rgba(252, 211, 77, 0.5)' : 'none',
                  whiteSpace: 'nowrap'
                }}>
                  AR${displayBounty.toLocaleString('es-AR')}
                </span>
                {isBountyAnimating && <span style={{ fontSize: '0.7rem', color: '#6ee7b7', animation: 'slideUpBounce 0.5s' }}>-tick</span>}
              </div>
              <span style={{ fontSize: '0.55rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Target: AR${dailyTargetArs.toLocaleString('es-AR')}</span>
            </div>

            {/* Monthly Profit */}
            {(isEditingScoreboard || visibleCards.month) && (
              <div className="income-card income-tier-1" style={{ flex: '1 1 0', minWidth: 0 }}>
                <span className="income-label">🗓️ MO.PROFIT</span>
                <span className="income-ars" style={{ whiteSpace: 'nowrap' }}>🌊${monthlyArs.toLocaleString('es-AR')}</span>
                <span style={{ fontSize: '0.55rem', opacity: 0.5, whiteSpace: 'nowrap' }}>/{monthlyTargetArs.toLocaleString('es-AR')}</span>
              </div>
            )}

            {/* Today's Shift Progress */}
            {(isEditingScoreboard || visibleCards.today) && (
              <div className="income-card income-tier-2" style={{ flex: '1 1 0', minWidth: 0, cursor: 'pointer' }} onClick={() => !isEditingScoreboard && setIsTodayDialOpen(true)}>
                <span className="income-label">{activeDayEmoji} DAILY</span>
                <span className="income-ars" style={{ whiteSpace: 'nowrap' }}>🌊{Math.round(stats.dailyMinutes)}m/🎯{Math.round(dailyGoal)}m</span>
                <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>({(stats.dailyMinutes / (dailyGoal || 1) * 100).toFixed(0)}%)</span>
              </div>
            )}

            {/* Goal Ladder */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }}>
               <span className="income-label">🪜 NEXT</span>
               <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#a855f7', whiteSpace: 'nowrap' }}>{nextGoalLabel}</span>
               <span style={{ fontSize: '0.55rem', opacity: 0.6, whiteSpace: 'nowrap' }}>{nextMilestone}m</span>
            </div>
          </div>

          {/* LOWER ROW: Interaction & Live Metrics */}
          <div className="dashboard-row dashboard-row-lower">
            
            {/* Main Controls Group */}
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              {!isActive ? (
                <button className="btn btn-primary" onClick={handleStart} style={{ padding: '0.4rem 0.8rem' }}><PlayIcon /> Connect</button>
              ) : (
                <button className="btn btn-danger" onClick={handleStop}><StopIcon /> STOP</button>
              )}
              {isBreakActive ? (
                <button className="btn" onClick={stopBreak} style={{ background: '#fb923c', color: 'white' }}>STOP BREAK</button>
              ) : (
                <button className="btn" onClick={startBreak} disabled={isActive} style={{ opacity: isActive ? 0.3 : 1 }}>COFFEE</button>
              )}
            </div>

            {/* Current Call (Live) */}
            {(isEditingScoreboard || visibleCards.call) && (
              <div className={`income-card ${isActive ? 'active' : ''}`} style={{ flex: '1 1 0', minWidth: 0, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem' }}>
                <span className="income-label" style={{ fontSize: '0.55rem' }}>CALL ({formatTime(sessionSeconds)})</span>
                <span className="income-ars" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>AR${Math.round(sessionEarnings * arsRate).toLocaleString('es-AR')}</span>
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
              <div className="income-card">
                <span className="income-label">🔋SESSION</span>
                <span style={{ fontSize: '0.8rem', color: '#60a5fa' }}>{Math.floor(workSessionMinutes)}m</span>
              </div>
              <div className="income-card">
                <span className="income-label">🚪LOGOUT</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{getCompensatedLogOff()}</span>
              </div>
            </div>

            {/* Tool toggles — readable text labels */}
            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => setIsNotesOpen(!isNotesOpen)}
                className="btn" style={{ fontSize: '0.55rem', padding: '0.2rem 0.4rem', background: isNotesOpen ? 'rgba(59,130,246,0.3)' : undefined }}>
                📝 {isNotesOpen ? 'Notes ✓' : 'Notes'}
              </button>
              <button onClick={() => setIsToolbarVisible(!isToolbarVisible)}
                className="btn" style={{ fontSize: '0.55rem', padding: '0.2rem 0.4rem', background: isToolbarVisible ? 'rgba(59,130,246,0.3)' : undefined }}>
                🛠️ {isToolbarVisible ? 'Tools ✓' : 'Tools'}
              </button>
              <button onClick={() => setIsEditingScoreboard(!isEditingScoreboard)}
                className="btn" style={{ fontSize: '0.55rem', padding: '0.2rem 0.4rem' }}>
                {isEditingScoreboard ? '💾 Save' : '✏️ Edit'}
              </button>
              <button onClick={() => setIsCollapsed(true)}
                className="btn" style={{ fontSize: '0.55rem', padding: '0.2rem 0.4rem', color: '#fca5a5' }}>
                ▲ Close
              </button>
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
                      Paced Max: <strong style={{ color: '#d8b4fe', textShadow: '0 0 8px rgba(139,92,246,0.5)' }}>AR${monthlyRemainingCash}</strong>
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

          {/* Step Goal (Weekly Replenishing Bar) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>🪜 PRO LADDER PROGRESS ({currentIdx + 1}/12)</span>
              <span title={`Each step on the Ladder represents 1,375 min. (1% of Total Goal = ${Math.floor(stats.goalMinutes / 100)}m)`}>
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
              {/* Day Notches (1375 / 5 = 275m intervals) */}
              <div 
                title="Each section represents roughly one full day of interpretive work (~275m)."
                style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'auto', zIndex: 5, cursor: 'help' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, borderRight: i < 4 ? '1px solid rgba(255,255,255,0.15)' : 'none' }} />
                ))}
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
                    <span title="Literally how many hours are left until 11:00 PM.">⏳ {hoursLeftToAbsolute.toFixed(1)}h left (${Math.round(hoursLeftToAbsolute * 60)}m)</span>
                    <span title="Assuming you work 35 mins per hour (allowing for breaks/avail), this is how many minutes you can realistically bank today.">({Math.round(workableMinsRemaining)}m workable)</span>
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
              
              {/* Hour Notches overlay */}
              <div 
                title="Each notch represents 1 hour of the workday (9 AM - 11 PM)."
                style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'auto', zIndex: 5, cursor: 'help' }}>
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
    </header>
  );
};
