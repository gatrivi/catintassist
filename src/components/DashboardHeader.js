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
  const { isActive, sessionSeconds, setSessionSeconds, sessionEarnings, stats, updateStat, startSession, stopSession, endDay, RATE_PER_MINUTE, arsRate, setArsRate, isBreakActive, breakSeconds, startBreak, stopBreak, availSeconds, isEditingScoreboard, setIsEditingScoreboard, visibleCards, toggleCard } = useSession();
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
  const workdayStartHour = 9, workdayEndHour = 23;
  const workdayTotalMs = (workdayEndHour - workdayStartHour) * 3600000;
  let timeElapsedRatio = Math.min(1, Math.max(0, (now.getTime() - new Date(year, month, currentDay, workdayStartHour).getTime()) / workdayTotalMs));
  const dailyGoal = parseFloat(requiredDailyAverage) || 0;
  let hoursLeft = Math.max(0.1, workdayEndHour - (now.getHours() + now.getMinutes() / 60));
  const realisticRemainingMins = hoursLeft * 35;
  const maxCashToClaim = Math.round(realisticRemainingMins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
  const realisticMaxToday = stats.dailyMinutes + realisticRemainingMins;
  const remainingWorkdaysThisMonth = Math.max(0, remainingDays - 1);
  const monthlyMaxMins = stats.monthlyMinutes + realisticRemainingMins + (remainingWorkdaysThisMonth * 14 * 35);
  const monthlyRemainingCash = Math.round((realisticRemainingMins + remainingWorkdaysThisMonth * 14 * 35) * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
  const dailyMaxArs = Math.round(realisticMaxToday * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
  const monthlyMaxArs = Math.round(monthlyMaxMins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
  const monthElapsedRatio = currentDay / daysInMonth;
  const isMonthlyGoalMet = stats.monthlyMinutes >= stats.goalMinutes;  const monthlyProgressRatio = stats.goalMinutes > 0 ? Math.min(1, stats.monthlyMinutes / stats.goalMinutes) : 0;
  const unbankedMins = isActive ? (sessionSeconds / 60) : 0;
  const monthlyPendingRatio = stats.goalMinutes > 0 ? Math.min(1, (stats.monthlyMinutes + unbankedMins) / stats.goalMinutes) : 0;
  const remainingMinsToday = Math.max(0, dailyGoal - stats.dailyMinutes);

  return (
    <header className="dashboard-header glass-panel" style={{ position: 'relative', zIndex: 100 }}>
      <div style={{ position: 'absolute', top: '0.1rem', right: '0.4rem', fontSize: '0.5rem', opacity: 0.3, pointerEvents: 'none' }}>v3.2.1 (Denominations)</div>

      {/* COLLAPSED VIEW */}
      {isCollapsed && (
        <div className="income-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', padding: '0.2rem 0.4rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap', overflowX: 'auto', width: '100%' }}>
            <ConnectionIndicator state={connectionState} />
            {!isActive ? (
              <button className="btn btn-primary" onClick={handleStart} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}><PlayIcon /> Connect</button>
            ) : (
              <button className="btn btn-danger recording" onClick={handleStop} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}><StopIcon /> Stop</button>
            )}
            
            {/* Quick Actions (Break/Hold/End Day) */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {!isActive ? (
                <>
                  {isBreakActive ? (
                    <button className="btn" onClick={stopBreak} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: '#fb923c', color: 'white' }}>Stop Break</button>
                  ) : (
                    <button className="btn" onClick={startBreak} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: 'rgba(251,146,60,0.1)', color: '#fdba74', border: '1px solid rgba(251,146,60,0.3)' }}>Break</button>
                  )}
                  {stats.dailyMinutes > 0 && !isBreakActive && (
                    <button className="btn" onClick={handleEndDay} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: 'rgba(139,92,246,0.1)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>🌙 End</button>
                  )}
                </>
              ) : (
                <>
                  <button className="btn" onClick={() => setIsHold(!isHold)} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: isHold ? 'rgba(245,158,11,0.8)' : 'rgba(255,255,255,0.1)', color: isHold ? 'white' : 'var(--text-muted)' }}>
                    {isHold ? `⏸ ${formatTime(holdSeconds)}` : '⏸ Hold'}
                  </button>
                  <button className="btn" onClick={onReconnectStream} title="Restart websockets without stopping call timer" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: 'rgba(56,189,248,0.1)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)' }}>
                    ⚡ Zap
                  </button>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto', flexWrap: 'nowrap', alignItems: 'center' }}>
              {isActive && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fb923c', whiteSpace: 'nowrap' }}>📞 ${Math.round(sessionEarnings * arsRate).toLocaleString('es-AR')}</span>}
              
              <div style={{ display: 'flex', gap: '0.25rem', padding: '0.15rem 0.4rem', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                  <span style={{ fontWeight: 800, color: '#fcd34d' }}>☀️ {Math.round(stats.dailyMinutes)}</span>
                  <span style={{ opacity: 0.8, fontWeight: 600 }}> / {Math.round(requiredDailyAverage)}m</span>
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '0.2rem', padding: '0.15rem 0.4rem', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.8rem', color: '#d8b4fe', fontWeight: 800 }}>🗓️ AR${Math.round(stats.monthlyMinutes * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}</span>
              </div>

              {/* RISK INDICATOR */}
              {remainingMinutes > 0 ? (
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.1rem 0.3rem', borderRadius: '4px', whiteSpace: 'nowrap',
                  background: (remainingDays === 1 && remainingMinutes > (hoursLeft * 55)) ? 'rgba(220,38,38,0.3)' : (remainingDays === 1 && remainingMinutes > realisticRemainingMins) ? 'rgba(245,158,11,0.2)' : 'rgba(52,211,153,0.1)', 
                  border: (remainingDays === 1 && remainingMinutes > (hoursLeft * 55)) ? '1px solid rgba(239,68,68,0.8)' : (remainingDays === 1 && remainingMinutes > realisticRemainingMins) ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(52,211,153,0.3)' 
                }}>
                  <span style={{ 
                    fontSize: '0.6rem', fontWeight: 600,
                    color: (remainingDays === 1 && remainingMinutes > (hoursLeft * 55)) ? '#fca5a5' : (remainingDays === 1 && remainingMinutes > realisticRemainingMins) ? '#fde047' : '#a7f3d0'
                  }}>
                    {remainingDays === 1 && remainingMinutes > (hoursLeft * 55) ? '🔴 CRIT: ' : remainingDays === 1 && remainingMinutes > realisticRemainingMins ? '🟠 RISK: ' : '🟢 '}
                    {hoursLeft.toFixed(1)}h (Paced {Math.round(realisticRemainingMins)}m / Need {Math.round(remainingMinutes)}m)
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.1rem 0.3rem', borderRadius: '4px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#6ee7b7' }}>🎉 Goal Met!</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setIsCollapsed(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', padding: '0.2rem' }}
            title="Expand dashboard">
            ▼
          </button>
        </div>
      )}

      {/* ── SINGLE UNIFIED ROW ── */}
      <div className="income-dashboard" style={{ display: isCollapsed ? 'none' : '' }}>

        {/* Controls card — sits in place of a scoreboard slot but is permanently visible */}
        <div className="income-card" style={{ gap: '0.4rem', alignItems: 'flex-start', justifyContent: 'center', position: 'relative' }}>
          
          {isEditingScoreboard && (
            <div style={{ position: 'absolute', bottom: -28, left: 0, right: 0, display: 'flex', gap: '0.15rem', justifyContent: 'center', zIndex: 100, flexWrap: 'wrap' }}>
               {/* Sound Diagnostic Lab */}
               <button className="btn" onClick={() => audioEngine.playBagOpen()} style={{ fontSize: '0.55rem', background: '#333', color: '#10b981', padding: '0.1rem 0.2rem' }}>[Bag]</button>
               <button className="btn" onClick={() => audioEngine.playTick(1)} style={{ fontSize: '0.55rem', background: '#333', color: '#6ee7b7', padding: '0.1rem 0.2rem' }}>[Min1]</button>
               <button className="btn" onClick={() => audioEngine.playTick(20)} style={{ fontSize: '0.55rem', background: '#333', color: '#fcd34d', padding: '0.1rem 0.2rem' }}>[Min20]</button>
               <button className="btn" onClick={() => audioEngine.playBill()} style={{ fontSize: '0.55rem', background: '#333', color: '#fb923c', padding: '0.1rem 0.2rem' }}>[Bill]</button>
               <button className="btn" onClick={() => audioEngine.playDiamond()} style={{ fontSize: '0.55rem', background: '#333', color: '#38bdf8', padding: '0.1rem 0.2rem' }}>[Gem]</button>
               <button className="btn" onClick={() => audioEngine.playCoin()} style={{ fontSize: '0.55rem', background: '#333', color: '#ddd', padding: '0.1rem 0.2rem' }}>[Coin]</button>
               
               <div style={{ width: '4px', height: '10px', background: 'rgba(255,255,255,0.1)', margin: '0 0.1rem' }} />

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

          <div style={{ position: 'absolute', top: 4, right: 4, cursor: 'pointer', opacity: 0.6 }} onClick={() => setIsEditingScoreboard(!isEditingScoreboard)} title="Edit Scoreboards & Test Physics">✏️</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <ConnectionIndicator state={connectionState} />
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
            <button className="btn" style={{ padding: '0.25rem', background: 'var(--panel-bg)', color: 'var(--text-muted)', border: '1px solid var(--panel-border)' }}
              onClick={() => {
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
              }} title="Set API Keys (Deepgram, DeepL, Microsoft)"><KeyIcon /></button>
            <button className="btn"
              style={{
                backgroundColor: sttLanguage === 'auto' ? 'rgba(255,255,255,0.1)' : sttLanguage === 'en' ? 'rgba(59,130,246,0.8)' : 'rgba(16,185,129,0.8)',
                color: sttLanguage === 'auto' ? 'var(--text-muted)' : 'white',
                padding: '0.25rem 0.4rem', fontWeight: 600, fontSize: '0.65rem',
                border: sttLanguage === 'auto' ? '1px solid var(--panel-border)' : '1px solid transparent',
              }}
              onClick={onToggleLanguage} title="Auto → EN → ES">
              {sttLanguage === 'auto' ? 'Auto Mux (EN/ES)' : sttLanguage === 'en' ? '🔒 ENG' : '🔒 SPA'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <select className="btn" style={{ background: 'var(--panel-bg)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.4)', padding: '0.1rem 0.25rem', maxWidth: '120px', fontSize: '0.6rem' }}
              value={selectedMicId} onChange={e => changeMicId(e.target.value)} onFocus={fetchDevices}>
              <option value="">Default Mic</option>
              {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
            </select>
            <select className="btn" style={{ background: 'var(--panel-bg)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', padding: '0.1rem 0.25rem', maxWidth: '120px', fontSize: '0.6rem' }}
              value={selectedSinkId} onChange={e => changeSinkId(e.target.value)} onFocus={fetchDevices}>
              <option value="">Default Speaker</option>
              {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,5)}`}</option>)}
            </select>
          </div>
        </div>

        {/* Monthly */}
        {(isEditingScoreboard || visibleCards.month) && (
        <div className="income-card income-tier-1" style={{ opacity: (!visibleCards.month && isEditingScoreboard) ? 0.3 : 1 }}>
          {(celebration?.type === 'day' || celebration?.type === 'month') && <CelebrationParticles type={celebration.type} label={celebration.label} coins={celebration.coins} onDismiss={() => { setCelebration(null); audioEngine.stopAll(); }} />}
          {isEditingScoreboard && <input type="checkbox" checked={visibleCards.month} onChange={() => toggleCard('month')} style={{ position: 'absolute', top: 4, right: 4, transform: 'scale(1.2)', cursor: 'pointer', zIndex: 10 }} />}
          <span className="income-label">This Month</span>
          <span className="income-ars" title={`Hourly Rate: AR$${Math.round(RATE_PER_MINUTE * 60 * arsRate).toLocaleString('es-AR')}`}>AR${Math.round(stats.monthlyMinutes * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}</span>
          <span style={{ fontSize: '0.8rem', color: '#d8b4fe', fontWeight: 600 }}>🚀 Max: AR${monthlyMaxArs}</span>
          <span className="income-usd" style={{ opacity: 0.4, fontSize: '0.6rem' }}>${(stats.monthlyMinutes * RATE_PER_MINUTE).toFixed(2)} USD</span>
          <EditableMinutes value={stats.monthlyMinutes} updateFn={updateStat} statKey="monthlyMinutes" />
        </div>
        )}

        {/* Today */}
        {(isEditingScoreboard || visibleCards.today) && (
        <div className="income-card income-tier-2" style={{ cursor: 'pointer', margin: '0 0.2rem', opacity: (!visibleCards.today && isEditingScoreboard) ? 0.3 : 1 }}>
          {celebration?.type === 'call' && <CelebrationParticles type={celebration.type} label={celebration.label} coins={celebration.coins} onDismiss={() => { setCelebration(null); audioEngine.stopAll(); }} />}
          {isEditingScoreboard && <input type="checkbox" checked={visibleCards.today} onChange={() => toggleCard('today')} style={{ position: 'absolute', top: 4, right: 4, transform: 'scale(1.2)', cursor: 'pointer', zIndex: 10 }} />}
          <div onClick={() => !isEditingScoreboard && setIsTodayDialOpen(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} title="Project this rate">
            <span className="income-label">Today</span>
            <span className="income-ars" title={`Hourly Rate: AR$${Math.round(RATE_PER_MINUTE * 60 * arsRate).toLocaleString('es-AR')}`}>AR${Math.round(stats.dailyMinutes * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}</span>
            <span style={{ fontSize: '0.75rem', color: '#d8b4fe', fontWeight: 600 }}>🚀 Max: AR${dailyMaxArs}</span>
            <span className="income-usd" style={{ opacity: 0.4, fontSize: '0.6rem' }}>${(stats.dailyMinutes * RATE_PER_MINUTE).toFixed(2)} USD</span>
          </div>
          <EditableMinutes value={stats.dailyMinutes} updateFn={updateStat} statKey="dailyMinutes" />
          
          {isTodayDialOpen && (
            <DialGoalSelector 
              ratePerMinute={RATE_PER_MINUTE} 
              arsRate={arsRate} 
              setArsRate={setArsRate}
              initialCash={stats.dailyMinutes * RATE_PER_MINUTE * arsRate}
              onSave={(m) => { updateStat('goalMinutes', m); setIsTodayDialOpen(false); }} 
              onCancel={() => setIsTodayDialOpen(false)} 
            />
          )}
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

        {/* Actions toggle container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignSelf: 'flex-start', alignItems: 'center', paddingLeft: '0.5rem' }}>
          <button onClick={() => setIsCollapsed(c => !c)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0.1rem' }}
            title="Collapse dashboard">
            ▲
          </button>
          <button onClick={() => setIsEditingScoreboard(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0.1rem', filter: isEditingScoreboard ? 'drop-shadow(0 0 4px #3b82f6)' : 'none' }}
            title="Edit scoreboard items">
            {isEditingScoreboard ? '💾' : '✏️'}
          </button>
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
                    <span>Need: {Math.round(remainingMinutes)}m</span>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span style={{ background: 'rgba(139,92,246,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)' }}>
                      Paced Max: <strong style={{ color: '#d8b4fe', textShadow: '0 0 8px rgba(139,92,246,0.5)' }}>AR${monthlyRemainingCash}</strong>
                    </span>
                  </>
                ) : (
                  <span style={{ color: stats.monthlyMinutes > stats.goalMinutes * 1.2 ? '#fcd34d' : '#34d399', fontWeight: 800 }}>
                    {stats.monthlyMinutes > stats.goalMinutes * 1.2 ? '🔥 UNSTOPPABLE!' : stats.monthlyMinutes > stats.goalMinutes * 1.1 ? '🚀 ORBIT (110%!)' : '🎉 Goal Met!'}
                  </span>
                )}
              </div>
              <span style={{ opacity: 0.5 }}>Goal: {stats.goalMinutes}m</span>
            </div>
            <div style={{ height: '7px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${monthlyPendingRatio * 100}%`, backgroundColor: '#f97316', opacity: 0.9, transition: 'width 1s linear', zIndex: 1, boxShadow: unbankedMins > 0 ? '0 0 10px #f97316' : 'none' }} />
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${monthlyProgressRatio * 100}%`, backgroundColor: isMonthlyGoalMet ? '#10b981' : '#a855f7', transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 2 }} />
              {stats.monthlyMinutes > stats.goalMinutes && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, (stats.monthlyMinutes - stats.goalMinutes) / (stats.goalMinutes * 0.2)) * 100}%`, backgroundColor: 'rgba(245,158,11,0.8)', zIndex: 3 }} />}
              
              {/* Notches overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 5 }}>
                {Array.from({ length: daysInMonth }).map((_, i) => (
                  <div key={i} style={{ flex: 1, borderRight: i < daysInMonth - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }} />
                ))}
              </div>

              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${monthElapsedRatio * 100}%`, width: '2px', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10 }} />
            </div>
          </div>
          {/* Daily bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>☀️ 09:00</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {remainingMinsToday <= 0 ? (
                  <span style={{ color: stats.dailyMinutes > dailyGoal + 120 ? '#fb923c' : stats.dailyMinutes > dailyGoal + 60 ? '#fde047' : '#34d399', fontWeight: 800 }}>
                    {stats.dailyMinutes > dailyGoal + 120 ? '👑 KING (+2h!)' : stats.dailyMinutes > dailyGoal + 60 ? '⚡ OVERDRIVE (+1h!)' : '🎉 Shift Met!'}
                  </span>
                ) : (
                  <>
                    <span>⏳ {hoursLeft.toFixed(1)}h left</span>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span>Cap: <strong style={{ color: '#6ee7b7' }}>AR${maxCashToClaim}</strong></span>
                  </>
                )}
              </div>
              <span style={{ opacity: 0.5 }}>23:00</span>
            </div>
            <div style={{ height: '5px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, (stats.dailyMinutes + unbankedMins) / Math.max(1, dailyGoal)) * 100}%`, backgroundColor: '#f97316', opacity: 0.9, transition: 'width 1s linear', zIndex: 1, boxShadow: unbankedMins > 0 ? '0 0 10px #f97316' : 'none' }} />
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, stats.dailyMinutes / Math.max(1, dailyGoal)) * 100}%`, backgroundColor: '#3b82f6', transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 2 }} />
              {stats.dailyMinutes > dailyGoal && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, (stats.dailyMinutes - dailyGoal) / 120) * 100}%`, backgroundColor: 'rgba(253,224,71,0.8)', zIndex: 3 }} />}
              
              {/* Notches overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 5 }}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, borderRight: i < 13 ? '1px solid rgba(255,255,255,0.15)' : 'none' }} />
                ))}
              </div>

              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${timeElapsedRatio * 100}%`, width: '2px', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10 }} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
