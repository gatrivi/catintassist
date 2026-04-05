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

  // Condensed View metrics (Calculated for AGENTS.md checklist)
  const dailyArs = Math.round(stats.dailyMinutes * RATE_PER_MINUTE * arsRate);
  const dailyTargetArs = Math.round(dailyGoal * RATE_PER_MINUTE * arsRate);
  const monthlyArs = Math.round(stats.monthlyMinutes * RATE_PER_MINUTE * arsRate);
  const monthlyTargetArs = Math.round(stats.goalMinutes * RATE_PER_MINUTE * arsRate);

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

          {/* THE 2x3 METRIC GRID */}
          <div className="metric-grid">
            {/* ROW 1: CASH (Row Context: 💰) */}
            <div className="metric-cell" title={`CURRENT CALL CASH: Tracking active session.`}>
              <div className="metric-watermark"><span>📞</span><span>💰</span><span>🌊</span><span>🎯</span></div>
              <div className="metric-cell-val">${Math.round(sessionEarnings * arsRate)} / ${Math.round(45 * RATE_PER_MINUTE * arsRate)}</div>
            </div>
            <div className="metric-cell" title={`DAILY CASH: Quota $${dailyTargetArs.toLocaleString('es-AR')}`}>
              <div className="metric-watermark"><span>☀️</span><span>💰</span><span>🌊</span><span>🎯</span></div>
              <div className="metric-cell-val">${dailyArs.toLocaleString('es-AR')} / ${dailyTargetArs.toLocaleString('es-AR')}</div>
            </div>
            <div className="metric-cell" title={`MONTHLY CASH: Target $${monthlyTargetArs.toLocaleString('es-AR')}`}>
               <div className="metric-watermark"><span>🗓️</span><span>💰</span><span>🌊</span><span>🎯</span></div>
               <div className="metric-cell-val">${monthlyArs.toLocaleString('es-AR')} / ${monthlyTargetArs.toLocaleString('es-AR')}</div>
            </div>

            {/* ROW 2: MINS (Row Context: 🕒) */}
            <div className="metric-cell" title={`CURRENT CALL MINS: 45m Ideal target.`}>
               <div className="metric-watermark"><span>📞</span><span>🕒</span><span>🌊</span><span>🎯</span></div>
               <div className="metric-cell-val">{(sessionSeconds / 60).toFixed(1)} / 45.0</div>
            </div>
            <div className="metric-cell" title={`DAILY MINS: Goal ${Math.round(requiredDailyAverage)}m`}>
               <div className="metric-watermark"><span>☀️</span><span>🕒</span><span>🌊</span><span>🎯</span></div>
               <div className="metric-cell-val">{Math.round(stats.dailyMinutes)} / {Math.round(requiredDailyAverage)}</div>
            </div>
            <div className="metric-cell" title={`MONTHLY MINS: Goal ${stats.goalMinutes}m`}>
               <div className="metric-watermark"><span>🗓️</span><span>🕒</span><span>🌊</span><span>🎯</span></div>
               <div className="metric-cell-val">{Math.round(stats.monthlyMinutes)} / {stats.goalMinutes}</div>
            </div>
          </div>

          {/* Right Section: Time Left, Segments, Tool Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem', alignItems: 'flex-end', minWidth: '135px' }}>
             <div style={{ display: 'flex', gap: '0.15rem', alignItems: 'center' }}>
                <div className="metric-pill" title="CASH TO GOAL" style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', height: '22px' }}>
                  <span style={{ color: '#6ee7b7', fontWeight: 800, fontSize: '0.65rem' }}>🏁${cashToTodayGoal.toLocaleString('es-AR')}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.1rem', background: 'rgba(0,0,0,0.2)', padding: '0 0.2rem', borderRadius: '3px', fontSize: '0.65rem' }} title="SHIFT SEGMENTS">
                   <span>🌅{Math.ceil(morningLeft)}</span>
                   <span>☀️{Math.ceil(afternoonLeft)}</span>
                   <span>🌙{Math.ceil(eveningLeft)}</span>
                </div>
             </div>

             <div style={{ display: 'flex', gap: '0.2rem' }}>
                <button className="btn-icon" onClick={() => setIsNotesOpen(!isNotesOpen)} style={{ opacity: isNotesOpen ? 1 : 0.4 }}>📝</button>
                <button className="btn-icon" onClick={() => setIsToolbarVisible(!isToolbarVisible)} style={{ opacity: isToolbarVisible ? 1 : 0.4 }}>🛠️</button>
                <button className="btn-icon" onClick={() => setIsCollapsed(false)}>🔼</button>
             </div>
          </div>
        </div>
      )}

      {/* ── SINGLE UNIFIED ROW ── */}
      <div className="income-dashboard" style={{ display: isCollapsed ? 'none' : '' }}>

        {/* Controls card — sits in place of a scoreboard slot but is permanently visible */}
        <div className="income-card" style={{ gap: '0.4rem', alignItems: 'flex-start', justifyContent: 'center', position: 'relative' }}>
          
          {isEditingScoreboard && (
            <div className="glass-panel" style={{ display: 'flex', gap: '0.15rem', justifyContent: 'center', zIndex: 100, flexWrap: 'wrap', padding: '0.2rem', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.2rem', width: '100%' }}>
               <button className="btn" onClick={() => audioEngine.playBagOpen()} style={{ fontSize: '0.55rem', background: '#333', color: '#10b981', padding: '0.1rem 0.2rem' }}>[Bag]</button>
               <button className="btn" onClick={() => audioEngine.playTick(1)} style={{ fontSize: '0.55rem', background: '#333', color: '#6ee7b7', padding: '0.1rem 0.2rem' }}>[Min1]</button>
               <button className="btn" onClick={() => audioEngine.playTick(20)} style={{ fontSize: '0.55rem', background: '#333', color: '#fcd34d', padding: '0.1rem 0.2rem' }}>[Min20]</button>
               <button className="btn" onClick={() => audioEngine.playBill()} style={{ fontSize: '0.55rem', background: '#333', color: '#fb923c', padding: '0.1rem 0.2rem' }}>[Bill]</button>
               <button className="btn" onClick={() => audioEngine.playDiamond()} style={{ fontSize: '0.55rem', background: '#333', color: '#38bdf8', padding: '0.1rem 0.2rem' }}>[Gem]</button>
               <button className="btn" onClick={() => audioEngine.playCoin()} style={{ fontSize: '0.55rem', background: '#333', color: '#ddd', padding: '0.1rem 0.2rem' }}>[Coin]</button>
               
               <div style={{ width: '4px', height: '10px', background: 'rgba(255,255,255,0.1)', margin: '0 0.1rem' }} />

               <button className="btn" onClick={() => { 
                 const keys = [
                   { name: 'Deepgram API Key', key: 'DEEPGRAM_API_KEY' },
                   { name: 'DeepL API Key (Optional)', key: 'DEEPL_API_KEY' },
                   { name: 'Microsoft Translator Key (Optional)', key: 'MICROSOFT_TRANSLATOR_KEY' },
                   { name: 'Microsoft Region (e.g. eastus)', key: 'MICROSOFT_TRANSLATOR_REGION' },
                   { name: 'OpenAI API Key (Optional for GPT-4o)', key: 'OPENAI_API_KEY' }
                 ];
                 keys.forEach(k => {
                   const cur = localStorage.getItem(k.key) || '';
                   const nk = window.prompt(`Enter ${k.name}:`, cur);
                   if (nk !== null) { if (!nk.trim()) localStorage.removeItem(k.key); else localStorage.setItem(k.key, nk.trim()); }
                 });
               }} title="Set API Keys">🔑 Keys</button>

               <button className="btn" onClick={() => { 
                 // Mock 45 min payout
                 const mins = 45; let rem = mins;
                 const diamonds = Math.floor(rem / 20); rem %= 20;
                 const bills = Math.floor(rem / 5); rem %= 5;
                 const coins = rem;
                 for(let i=0; i<diamonds; i++) setTimeout(()=>audioEngine.playDiamond(), i*400);
                 for(let i=0; i<bills; i++) setTimeout(()=>audioEngine.playBill(), (diamonds*400)+(i*300));
                 for(let i=0; i<coins; i++) setTimeout(()=>audioEngine.playCoin(), (diamonds*400)+(bills*300)+(i*200));
                 setCelebration({ type: 'call', label: '+45min Mock', coins: 40 }); 
                 setTimeout(()=>setCelebration(null), 4000);
               }} style={{ fontSize: '0.55rem', background: '#444', color: '#fff', padding: '0.1rem 0.3rem' }}>[Mock 45m]</button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', minHeight: '36px' }}>
            <ConnectionIndicator state={connectionState} message={connectionMessage} />
            {!isActive ? (
              <>
                <button className="btn btn-primary" onClick={handleStart} style={{ fontSize: '0.7rem' }}><PlayIcon /> Connect</button>
                {isBreakActive ? (
                  <button className="btn" onClick={stopBreak} style={{ fontSize: '0.7rem', background: '#fb923c', color: 'white', boxShadow: '0 0 8px rgba(251,146,60,0.6)' }}>
                    Stop Break ({formatTime(breakSeconds)})
                  </button>
                ) : (
                  <button className="btn" onClick={startBreak} style={{ fontSize: '0.7rem', background: 'rgba(251,146,60,0.2)', color: '#fdba74', border: '1px solid rgba(251,146,60,0.4)' }}>
                    🪑 Break
                  </button>
                )}
                {stats.dailyMinutes > 0 && (
                  <button className="btn" onClick={handleEndDay}
                    style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)', fontSize: '0.6rem' }}>
                    🌙 End Day
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="btn"
                  style={{
                    backgroundColor: isHold ? 'rgba(245,158,11,0.8)' : 'rgba(255,255,255,0.1)',
                    color: isHold ? 'white' : 'var(--text-muted)',
                    border: isHold ? 'none' : '1px solid var(--panel-border)',
                    animation: (isHold && holdSeconds >= 900 && holdSeconds < 930) ? 'pulseDanger 1s infinite' : 'none',
                    fontSize: '0.7rem'
                  }}
                  onClick={() => setIsHold(!isHold)}>
                  {isHold ? `⏸ ${formatTime(holdSeconds)}` : '⏸ Hold'}
                </button>
                <button className="btn" onClick={onReconnectStream} title="Restart websockets without dropping call" style={{ background: 'rgba(56,189,248,0.1)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)', fontSize: '0.7rem' }}>
                  ⚡ Zap Stream
                </button>
                <button className="btn btn-danger recording" onClick={handleStop} style={{ fontSize: '0.7rem' }}><StopIcon /> Stop</button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
            <button className="btn" 
              style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: audioEngine.isMuted ? 'rgba(239,68,68,0.2)' : 'var(--panel-bg)', color: audioEngine.isMuted ? '#fca5a5' : 'var(--text-muted)', border: '1px solid var(--panel-border)' }}
              onClick={audioEngine.toggleMute} title={audioEngine.isMuted ? "Unmute" : "Silence"}>
              {audioEngine.isMuted ? '🔇' : '🔊'}
            </button>
            <select className="btn" style={{ background: 'var(--panel-bg)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.4)', padding: '0.2rem 0.4rem', height: '32px', width: '110px', fontSize: '0.65rem' }}
              value={selectedMicId} onChange={e => changeMicId(e.target.value)} onFocus={fetchDevices}>
              <option value="">Default Mic</option>
              {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
            </select>
            <select className="btn" style={{ background: 'var(--panel-bg)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', padding: '0.2rem 0.4rem', height: '32px', width: '110px', fontSize: '0.65rem' }}
              value={selectedSinkId} onChange={e => changeSinkId(e.target.value)} onFocus={fetchDevices}>
              <option value="">Default Speaker</option>
              {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,5)}`}</option>)}
            </select>
            {isEditingScoreboard && (
              <button className="btn" 
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', height: '32px' }}
                onClick={onToggleLanguage} title="Auto → EN → ES">
                {sttLanguage === 'auto' ? 'Auto Mux' : sttLanguage === 'en' ? '🔒 ENG' : '🔒 SPA'}
              </button>
            )}
          </div>
        </div>

        {/* Monthly Mins */}
        {(isEditingScoreboard || visibleCards.month) && (
        <div className="income-card income-tier-1" style={{ opacity: (!visibleCards.month && isEditingScoreboard) ? 0.3 : 1 }}
          title={`Monthly Mins: Total progressive work. Paced Max: AR$${monthlyRemainingCash}`}>
          {isEditingScoreboard && <input type="checkbox" checked={visibleCards.month} onChange={() => toggleCard('month')} style={{ position: 'absolute', top: 4, right: 4, zIndex: 10 }} />}
          <span className="income-label">🗓️🕒 Mins</span>
          <span className="income-ars">🌊{Math.round(stats.monthlyMinutes)} / 🎯{stats.goalMinutes}</span>
          <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>({monthlyProgressRatio.toLocaleString(undefined, {style: 'percent'})})</span>
          <EditableMinutes value={stats.monthlyMinutes} updateFn={updateStat} statKey="monthlyMinutes" />
        </div>
        )}

        {/* Monthly Cash */}
        {(isEditingScoreboard || visibleCards.moneyMonth) && (
        <div className="income-card income-tier-1" style={{ opacity: (!visibleCards.month && isEditingScoreboard) ? 0.3 : 1 }}
          title={`Monthly Cash: Estimated total profit. Paced Max: AR$${monthlyMaxArs}`}>
          <span className="income-label">🗓️💰 Profit</span>
          <span className="income-ars">🌊${monthlyArs.toLocaleString('es-AR')} / 🎯${monthlyTargetArs.toLocaleString('es-AR')}</span>
          <EditableMinutes value={monthlyArs / (RATE_PER_MINUTE * arsRate)} updateFn={updateStat} statKey="monthlyMinutes" />
        </div>
        )}

        {/* Today Mins */}
        {(isEditingScoreboard || visibleCards.today) && (
        <div className="income-card income-tier-2" style={{ cursor: 'pointer', margin: '0 0.2rem', opacity: (!visibleCards.today && isEditingScoreboard) ? 0.3 : 1 }}
          title={`Today's Mins: Banked vs Goal. Max possible today: ${Math.round(realisticMaxToday)}m`}>
          {isEditingScoreboard && <input type="checkbox" checked={visibleCards.today} onChange={() => toggleCard('today')} style={{ position: 'absolute', top: 4, right: 4, zIndex: 10 }} />}
          <div onClick={() => !isEditingScoreboard && setIsTodayDialOpen(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="income-label">{activeDayEmoji}🕒 Shift</span>
            <span className="income-ars">🌊{Math.round(stats.dailyMinutes)} / 🎯{Math.round(dailyGoal)}</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>({(stats.dailyMinutes / (dailyGoal || 1) * 100).toFixed(0)}%)</span>
          </div>
          <EditableMinutes value={stats.dailyMinutes} updateFn={updateStat} statKey="dailyMinutes" />
        </div>
        )}

        {/* Today Cash */}
        {(isEditingScoreboard || visibleCards.moneyToday) && (
        <div className="income-card income-tier-2" style={{ cursor: 'pointer', margin: '0 0.2rem', opacity: (!visibleCards.today && isEditingScoreboard) ? 0.3 : 1 }}
          title={`Today's Cash: Target quota for today. Max possible: AR$${dailyMaxArs}`}>
          <div onClick={() => !isEditingScoreboard && setIsTodayDialOpen(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="income-label">{activeDayEmoji}💰 Income</span>
            <span className="income-ars">🌊${dailyArs.toLocaleString('es-AR')} / 🎯${dailyTargetArs.toLocaleString('es-AR')}</span>
          </div>
          <EditableMinutes value={stats.dailyMinutes} updateFn={updateStat} statKey="dailyMinutes" />
        </div>
        )}

        {/* Current Call */}
        {(isEditingScoreboard || visibleCards.call) && (
        <div className={`income-card income-tier-3 ${isActive ? 'active' : ''}`} style={{ opacity: (!visibleCards.call && isEditingScoreboard) ? 0.3 : 1 }}>
          {isEditingScoreboard && <input type="checkbox" checked={visibleCards.call} onChange={() => toggleCard('call')} style={{ position: 'absolute', top: 4, right: 4, transform: 'scale(1.2)', cursor: 'pointer', zIndex: 10 }} />}
          <span className="income-label">Current Call ({formatTime(sessionSeconds)})</span>
          <span className="income-ars" title={`Hourly Rate: AR$${Math.round(RATE_PER_MINUTE * 60 * arsRate).toLocaleString('es-AR')}`}>AR${Math.round(sessionEarnings * arsRate).toLocaleString('es-AR')}</span>
          <span className="income-usd" style={{ opacity: 0.7 }}>${sessionEarnings.toFixed(2)} USD</span>
          <EditableMinutes value={sessionSeconds / 60} updateFn={(k, v) => setSessionSeconds(Math.max(0, v * 60))} statKey="sessionSeconds" />
        </div>
        )}

        {/* Break Time Scoreboard */}
        {(isEditingScoreboard || visibleCards.break) && (
        <div className={`income-card income-tier-break ${isBreakActive ? 'active' : ''}`} style={{ background: isBreakActive ? 'rgba(251,146,60,0.1)' : 'transparent', padding: '0.3rem', borderRadius: '8px', border: isBreakActive ? '1px solid rgba(251,146,60,0.4)' : '1px solid transparent', opacity: (!visibleCards.break && isEditingScoreboard) ? 0.3 : 1 }}>
          {isEditingScoreboard && <input type="checkbox" checked={visibleCards.break} onChange={() => toggleCard('break')} style={{ position: 'absolute', top: 4, right: 4, transform: 'scale(1.2)', cursor: 'pointer', zIndex: 10 }} />}
          <span className="income-label">Break Time</span>
          <span className="income-ars" style={{ color: '#fdba74', fontSize: '0.85rem', fontWeight: 700 }}>
            {Math.floor((stats.dailyBreakMinutes || 0) / 60)}h {Math.round((stats.dailyBreakMinutes || 0) % 60)}m
          </span>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: 'var(--text-muted)' }}>
               <span>Budget: 90m</span>
               <span style={{ color: (stats.dailyBreakMinutes || 0) > 90 ? '#ef4444' : 'inherit' }}>
                 {(stats.dailyBreakMinutes || 0) > 90 ? `-${Math.round((stats.dailyBreakMinutes || 0) - 90)}m over` : `${Math.round(90 - (stats.dailyBreakMinutes || 0))}m left`}
               </span>
            </div>
            <div style={{ height: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '2px', overflow: 'hidden' }}>
               <div style={{ height: '100%', width: `${Math.min(100, ((stats.dailyBreakMinutes || 0) / 90) * 100)}%`, backgroundColor: (stats.dailyBreakMinutes || 0) > 90 ? '#ef4444' : '#fb923c', transition: 'width 1s' }} />
            </div>
          </div>
          <EditableMinutes value={stats.dailyBreakMinutes || 0} updateFn={updateStat} statKey="dailyBreakMinutes" />
        </div>
        )}

        {/* Avail Time Scoreboard */}
        {(isEditingScoreboard || visibleCards.avail) && (
        <div className={`income-card income-tier-avail ${!isActive && !isBreakActive ? 'active' : ''}`} style={{ background: !isActive && !isBreakActive ? 'rgba(59,130,246,0.1)' : 'transparent', padding: '0.3rem', borderRadius: '8px', border: !isActive && !isBreakActive ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent', opacity: (!visibleCards.avail && isEditingScoreboard) ? 0.3 : 1 }}>
          {isEditingScoreboard && <input type="checkbox" checked={visibleCards.avail} onChange={() => toggleCard('avail')} style={{ position: 'absolute', top: 4, right: 4, transform: 'scale(1.2)', cursor: 'pointer', zIndex: 10 }} />}
          <span className="income-label">Avail Time {!isActive && !isBreakActive && `(${formatTime(availSeconds)})`}</span>
          <span className="income-ars" style={{ color: '#93c5fd', fontSize: '0.85rem', fontWeight: 700 }}>
            {Math.floor((stats.dailyAvailMinutes || 0) / 60)}h {Math.round((stats.dailyAvailMinutes || 0) % 60)}m
          </span>
          <EditableMinutes value={stats.dailyAvailMinutes || 0} updateFn={updateStat} statKey="dailyAvailMinutes" />
        </div>
        )}

        {/* Goal editor */}
        {(isEditingScoreboard || visibleCards.goal) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.6rem', justifyContent: 'center', position: 'relative', opacity: (!visibleCards.goal && isEditingScoreboard) ? 0.3 : 1 }}>
          {isEditingScoreboard && <input type="checkbox" checked={visibleCards.goal} onChange={() => toggleCard('goal')} style={{ position: 'absolute', top: 0, right: 4, transform: 'scale(1.2)', cursor: 'pointer', zIndex: 10 }} />}
          <GoalEditor statKey="goalMinutes" valueMinutes={stats.goalMinutes} updateFn={updateStat} ratePerMinute={RATE_PER_MINUTE}
            dailyAverage={requiredDailyAverage} arsRate={arsRate} setArsRate={setArsRate}
            monthlyMinutes={stats.monthlyMinutes} dailyMinutes={stats.dailyMinutes} remainingDays={remainingDays} />
        </div>
        )}

        {/* Shift / Work Session Info */}
        <div className="income-card" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.6rem' }}>
          <span className="income-label">Work Session</span>
          <span className="income-ars" style={{ color: workSessionMinutes > 120 ? '#ef4444' : '#60a5fa', fontSize: '0.85rem' }}>{Math.floor(workSessionMinutes)}m</span>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Logout: <strong style={{ color: '#fff' }}>{getCompensatedLogOff()}</strong>
          </div>
        </div>

        {/* Actions toggle container - CONSOLIDATED INTO ONE ROW */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.25rem', alignSelf: 'center', alignItems: 'center', paddingLeft: '0.8rem', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => setIsNotesOpen(!isNotesOpen)}
            style={{ background: isNotesOpen ? 'rgba(59,130,246,0.2)' : 'none', border: 'none', color: isNotesOpen ? '#60a5fa' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0.3rem', borderRadius: '4px' }}
            title={isNotesOpen ? "Hide Notes" : "Show Notes"}>📝</button>
          <button onClick={() => setIsToolbarVisible(!isToolbarVisible)}
            style={{ background: isToolbarVisible ? 'rgba(16,185,129,0.2)' : 'none', border: 'none', color: isToolbarVisible ? '#34d399' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0.3rem', borderRadius: '4px' }}
            title={isToolbarVisible ? "Hide Toolbar" : "Show Toolbar"}>🛠️</button>
          <button onClick={() => setIsEditingScoreboard(e => !e)}
            style={{ background: isEditingScoreboard ? 'rgba(16,185,129,0.2)' : 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.3rem', borderRadius: '4px' }}
            title="Edit scoreboard items">{isEditingScoreboard ? '💾' : '✏️'}</button>
          <button onClick={() => setIsCollapsed(c => !c)}
            style={{ background: isCollapsed ? 'rgba(59,130,246,0.2)' : 'none', border: 'none', color: isCollapsed ? '#60a5fa' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.3rem', borderRadius: '4px' }}
            title={isCollapsed ? "Expand dashboard" : "Collapse dashboard"}>{isCollapsed ? '▼' : '▲'}</button>
        </div>
      </div>

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
