import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { PlayIcon, StopIcon, KeyIcon, formatTime, GoalEditor, EditableMinutes, ConnectionIndicator } from './HeaderWidgets';
import { DialGoalSelector } from './DialGoalSelector';

export const DashboardHeader = ({ onStartAudio, onStopAudio, sttLanguage, onToggleLanguage, connectionState, connectionMessage }) => {
  const { isActive, sessionSeconds, sessionEarnings, stats, updateStat, startSession, stopSession, endDay, RATE_PER_MINUTE, arsRate, setArsRate, isBreakActive, breakSeconds, startBreak, stopBreak, availSeconds } = useSession();
  const { outputDevices, inputDevices, selectedSinkId, selectedMicId, changeSinkId, changeMicId, fetchDevices } = useAudioSettings();

  const [isHold, setIsHold] = useState(false);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [isTodayDialOpen, setIsTodayDialOpen] = useState(false);

  useEffect(() => {
    let iv; if (isHold) iv = setInterval(() => setHoldSeconds(s => s + 1), 1000); else setHoldSeconds(0);
    return () => clearInterval(iv);
  }, [isHold]);
  useEffect(() => { if (!isActive) setIsHold(false); }, [isActive]);

  const playChing = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime;
      [[type === 'day' ? 880 : 660, 'triangle', 0, 0.8], [type === 'day' ? 1320 : 1100, 'sine', 0.05, 0.6]].forEach(([freq, wave, delay, dur]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = freq; o.type = wave;
        g.gain.setValueAtTime(0.5, t + delay); g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        o.connect(g); g.connect(ctx.destination); o.start(t + delay); o.stop(t + delay + dur);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1500);
    } catch (e) {}
  };

  const handleStart = async () => { const ok = await onStartAudio(); if (ok) startSession(); };
  const handleStop = () => {
    stopSession((mins) => {
      playChing('call');
      const dynamicItems = Math.min(80, Math.max(5, Math.floor(mins * 1.5)));
      setCelebration({ type: 'call', label: `+AR$${Math.round(mins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}`, coins: dynamicItems });
      setTimeout(() => setCelebration(null), 3500 + Math.min(1500, dynamicItems * 40));
    });
    onStopAudio();
  };
  const handleEndDay = () => {
    endDay((mins) => {
      playChing('day');
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
  const isMonthlyGoalMet = stats.monthlyMinutes >= stats.goalMinutes;
  const monthlyProgressRatio = stats.goalMinutes > 0 ? Math.min(1, stats.monthlyMinutes / stats.goalMinutes) : 0;
  const remainingMinsToday = Math.max(0, dailyGoal - stats.dailyMinutes);

  return (
    <header className="dashboard-header glass-panel" style={{ position: 'relative', zIndex: 100 }}>

      {/* Coin rain overlay */}
      {celebration && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
          {Array.from({ length: celebration.coins }).map((_, i) => {
            const emojis = ['🪙', '🪙', '💸', '💵', '💰', '💎'];
            return (
            <span key={i} style={{
              position: 'absolute', fontSize: `${0.9 + Math.random() * 1.2}rem`,
              left: `${2 + Math.random() * 96}%`, top: `${-10 - Math.random() * 20}%`,
              animation: `coinFall ${0.8 + Math.random() * 1.8}s ease-in ${Math.random() * 1.5}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}>{emojis[Math.floor(Math.random() * emojis.length)]}</span>
          )})}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            fontSize: '1.2rem', fontWeight: 900,
            color: celebration.type === 'day' ? '#fcd34d' : '#6ee7b7',
            textShadow: `0 0 20px ${celebration.type === 'day' ? '#f59e0b' : '#10b981'}`,
            whiteSpace: 'nowrap', animation: `celebrationPop ${celebration.type === 'day' ? 5 : 3.5}s ease-out forwards`,
          }}>{celebration.label}</div>
        </div>
      )}

      {/* ── SINGLE UNIFIED ROW ── */}
      <div className="income-dashboard">

        {/* Controls card — sits in place of a scoreboard slot */}
        <div className="income-card" style={{ gap: '0.4rem', alignItems: 'flex-start', justifyContent: 'center' }}>
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
                <button className="btn btn-danger recording" onClick={handleStop} style={{ fontSize: '0.7rem' }}><StopIcon /> Stop</button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
            <button className="btn" style={{ padding: '0.25rem', background: 'var(--panel-bg)', color: 'var(--text-muted)', border: '1px solid var(--panel-border)' }}
              onClick={() => {
                const cur = localStorage.getItem('DEEPGRAM_API_KEY') || '';
                const nk = window.prompt('Enter your Deepgram API Key:', cur);
                if (nk !== null) { if (!nk.trim()) localStorage.removeItem('DEEPGRAM_API_KEY'); else localStorage.setItem('DEEPGRAM_API_KEY', nk.trim()); }
              }} title="Set API Key"><KeyIcon /></button>
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
        <div className="income-card income-tier-1">
          <span className="income-label">This Month</span>
          <span className="income-ars">AR${Math.round(stats.monthlyMinutes * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}</span>
          <span style={{ fontSize: '0.8rem', color: '#d8b4fe', fontWeight: 600 }}>🚀 Max: AR${monthlyMaxArs}</span>
          <span className="income-usd" style={{ opacity: 0.4, fontSize: '0.6rem' }}>${(stats.monthlyMinutes * RATE_PER_MINUTE).toFixed(2)} USD</span>
          <EditableMinutes value={stats.monthlyMinutes} updateFn={updateStat} statKey="monthlyMinutes" />
        </div>

        {/* Today */}
        <div className="income-card income-tier-2" style={{ cursor: 'pointer' }}>
          <div onClick={() => setIsTodayDialOpen(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} title="Project this rate">
            <span className="income-label">Today</span>
            <span className="income-ars">AR${Math.round(stats.dailyMinutes * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}</span>
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

        {/* Current Call */}
        <div className={`income-card income-tier-3 ${isActive ? 'active' : ''}`}>
          <span className="income-label">Current Call ({formatTime(sessionSeconds)})</span>
          <span className="income-ars">AR${Math.round(sessionEarnings * arsRate).toLocaleString('es-AR')}</span>
          <span className="income-usd" style={{ opacity: 0.7 }}>${sessionEarnings.toFixed(2)} USD</span>
        </div>

        {/* Break Time Scoreboard */}
        <div className={`income-card income-tier-break ${isBreakActive ? 'active' : ''}`} style={{ background: isBreakActive ? 'rgba(251,146,60,0.1)' : 'transparent', padding: '0.3rem', borderRadius: '8px', border: isBreakActive ? '1px solid rgba(251,146,60,0.4)' : '1px solid transparent' }}>
          <span className="income-label">Break Time</span>
          <span className="income-ars" style={{ color: '#fdba74', fontSize: '0.85rem', fontWeight: 700 }}>
            {Math.floor((stats.dailyBreakMinutes || 0) / 60)}h {Math.round((stats.dailyBreakMinutes || 0) % 60)}m
          </span>
          <EditableMinutes value={stats.dailyBreakMinutes || 0} updateFn={updateStat} statKey="dailyBreakMinutes" />
        </div>

        {/* Avail Time Scoreboard */}
        <div className={`income-card income-tier-avail ${!isActive && !isBreakActive ? 'active' : ''}`} style={{ background: !isActive && !isBreakActive ? 'rgba(59,130,246,0.1)' : 'transparent', padding: '0.3rem', borderRadius: '8px', border: !isActive && !isBreakActive ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent' }}>
          <span className="income-label">Avail Time {!isActive && !isBreakActive && `(${formatTime(availSeconds)})`}</span>
          <span className="income-ars" style={{ color: '#93c5fd', fontSize: '0.85rem', fontWeight: 700 }}>
            {Math.floor((stats.dailyAvailMinutes || 0) / 60)}h {Math.round((stats.dailyAvailMinutes || 0) % 60)}m
          </span>
          <EditableMinutes value={stats.dailyAvailMinutes || 0} updateFn={updateStat} statKey="dailyAvailMinutes" />
        </div>

        {/* Goal editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.6rem', justifyContent: 'center' }}>
          <GoalEditor statKey="goalMinutes" valueMinutes={stats.goalMinutes} updateFn={updateStat} ratePerMinute={RATE_PER_MINUTE}
            dailyAverage={requiredDailyAverage} arsRate={arsRate} setArsRate={setArsRate}
            monthlyMinutes={stats.monthlyMinutes} dailyMinutes={stats.dailyMinutes} remainingDays={remainingDays} />
        </div>

        {/* Collapse toggle — sticks to right edge */}
        <button onClick={() => setIsCollapsed(c => !c)}
          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.1rem 0.3rem' }}
          title={isCollapsed ? 'Show progress bars' : 'Hide progress bars'}>
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {/* Progress bars (collapsible) */}
      {!isCollapsed && dailyGoal > 0 && (
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
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${monthlyProgressRatio * 100}%`, backgroundColor: isMonthlyGoalMet ? '#10b981' : '#a855f7', transition: 'width 1s' }} />
              {stats.monthlyMinutes > stats.goalMinutes && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, (stats.monthlyMinutes - stats.goalMinutes) / (stats.goalMinutes * 0.2)) * 100}%`, backgroundColor: 'rgba(245,158,11,0.8)' }} />}
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
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, stats.dailyMinutes / Math.max(1, dailyGoal)) * 100}%`, backgroundColor: '#3b82f6', transition: 'width 1s' }} />
              {stats.dailyMinutes > dailyGoal && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, (stats.dailyMinutes - dailyGoal) / 120) * 100}%`, backgroundColor: 'rgba(253,224,71,0.8)' }} />}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${timeElapsedRatio * 100}%`, width: '2px', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10 }} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
