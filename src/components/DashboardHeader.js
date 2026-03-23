import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { PlayIcon, StopIcon, KeyIcon, formatTime, GoalEditor, EditableMinutes, ConnectionIndicator } from './HeaderWidgets';

export const DashboardHeader = ({ onStartAudio, onStopAudio, sttLanguage, onToggleLanguage, connectionState, connectionMessage }) => {
  const { isActive, sessionSeconds, sessionEarnings, stats, updateStat, startSession, stopSession, RATE_PER_MINUTE, arsRate, setArsRate } = useSession();
  const { outputDevices, inputDevices, selectedSinkId, selectedMicId, changeSinkId, changeMicId, fetchDevices } = useAudioSettings();

  const [isHold, setIsHold] = useState(false);
  const [holdSeconds, setHoldSeconds] = useState(0);

  useEffect(() => {
    let interval;
    if (isHold) {
      interval = setInterval(() => setHoldSeconds(s => s + 1), 1000);
    } else {
      setHoldSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isHold]);

  useEffect(() => {
    if (!isActive) setIsHold(false);
  }, [isActive]);

  const handleStart = async () => {
    const success = await onStartAudio();
    if (success) startSession();
  };

  const handleStop = () => {
    stopSession();
    onStopAudio();
  };

  // Calculate daily average to meet goal
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentDay = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = daysInMonth - currentDay + 1; // including today
  
  const remainingMinutes = Math.max(0, stats.goalMinutes - stats.monthlyMinutes);
  const requiredDailyAverage = remainingDays > 0 ? (remainingMinutes / remainingDays).toFixed(0) : 0;

  // Calculate workday pacing (9 AM to 11 PM = 14 hours)
  const workdayStartHour = 9;
  const workdayEndHour = 23;
  const workdayTotalMs = (workdayEndHour - workdayStartHour) * 60 * 60 * 1000;
  
  const startOfWorkday = new Date(year, month, currentDay, workdayStartHour, 0, 0).getTime();
  let timeElapsedRatio = (now.getTime() - startOfWorkday) / workdayTotalMs;
  if (timeElapsedRatio < 0) timeElapsedRatio = 0;
  if (timeElapsedRatio > 1) timeElapsedRatio = 1;
  
  const dailyGoal = parseFloat(requiredDailyAverage) || 0;
  const workdayTotalExpectedMins = 14 * 35; // 490 mins absolute physical limit
  const dailyProgressRatio = Math.min(1, stats.dailyMinutes / workdayTotalExpectedMins);
  const expectedMinutesByNow = workdayTotalExpectedMins * timeElapsedRatio;
  
  const remainingMinsToday = Math.max(0, dailyGoal - stats.dailyMinutes);
  let hoursLeft = workdayEndHour - (now.getHours() + now.getMinutes() / 60);
  if (hoursLeft <= 0) hoursLeft = 0.1; // prevent infinity

  const realisticRemainingMins = hoursLeft * 35; // Expecting ~35m of flow per hour
  const maxCashToClaim = Math.round(realisticRemainingMins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
  const realisticMaxToday = stats.dailyMinutes + realisticRemainingMins;
  const remainingWorkdaysThisMonth = Math.max(0, remainingDays - 1);
  const monthlyMaxMins = stats.monthlyMinutes + realisticRemainingMins + (remainingWorkdaysThisMonth * 14 * 35);
  
  const monthlyRemainingMins = realisticRemainingMins + (remainingWorkdaysThisMonth * 14 * 35);
  const monthlyRemainingCash = Math.round(monthlyRemainingMins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');

  const dailyMaxArs = Math.round(realisticMaxToday * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
  const monthlyMaxArs = Math.round(monthlyMaxMins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');

  return (
    <header className="dashboard-header glass-panel">
      
      <div className="dashboard-title-row">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ConnectionIndicator state={connectionState} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={connectionMessage}>
              {connectionMessage}
            </span>
          </div>
          {!isActive ? (
            <button className="btn btn-primary" onClick={handleStart}>
              <PlayIcon /> Connect
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button 
                className="btn" 
                style={{ 
                  backgroundColor: isHold ? (holdSeconds >= 900 && holdSeconds < 930 ? '#ef4444' : 'rgba(245, 158, 11, 0.8)') : 'rgba(255,255,255,0.1)', 
                  color: isHold ? 'white' : 'var(--text-muted)', 
                  border: isHold ? 'none' : '1px solid var(--panel-border)',
                  animation: (isHold && holdSeconds >= 900 && holdSeconds < 930) ? 'pulseDanger 1s infinite' : 'none',
                  transition: 'background-color 2s ease'
                }}
                onClick={() => setIsHold(!isHold)}
                title="15-minute Hold Timer"
              >
                {isHold ? `⏸ Hold (${formatTime(holdSeconds)})` : '⏸ Hold'}
              </button>
              <button className="btn btn-danger recording" onClick={handleStop}>
                <StopIcon /> Stop
              </button>
            </div>
          )}
          <div 
            className="btn" 
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', cursor: 'default' }}
            title="Dual-Stream Auto Detection Active (Pressing SPACE is no longer required)"
          >
            Auto-Detecting EN/ES
          </div>
          <button
            className="btn"
            style={{ padding: '0.4rem', backgroundColor: 'var(--panel-bg)', color: 'var(--text-muted)', border: '1px solid var(--panel-border)' }}
            onClick={() => {
              const currentKey = localStorage.getItem('DEEPGRAM_API_KEY') || '';
              const newKey = window.prompt("Enter your Deepgram API Key:\n(Leave blank to use the default .env key if available)", currentKey);
              if (newKey !== null) {
                if (newKey.trim() === '') localStorage.removeItem('DEEPGRAM_API_KEY');
                else localStorage.setItem('DEEPGRAM_API_KEY', newKey.trim());
              }
            }}
            title="Set API Key"
          >
            <KeyIcon />
          </button>
          
          <button 
            className="btn" 
            style={{ 
              backgroundColor: sttLanguage === 'auto' ? 'rgba(255, 255, 255, 0.1)' : (sttLanguage === 'en' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(16, 185, 129, 0.8)'), 
              color: sttLanguage === 'auto' ? 'var(--text-muted)' : 'white', 
              padding: '0.3rem 0.6rem',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
              borderRadius: '6px',
              border: sttLanguage === 'auto' ? '1px solid var(--panel-border)' : '1px solid transparent',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
            onClick={onToggleLanguage}
            title="Click to Force Language (Auto -> EN -> ES)"
          >
            {sttLanguage === 'auto' ? 'Auto Mux (EN/ES)' : (sttLanguage === 'en' ? '🔒 Forced: ENG' : '🔒 Forced: SPA')}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <select 
              className="btn"
              style={{ 
                backgroundColor: 'var(--panel-bg)', 
                color: '#3b82f6', 
                border: '1px solid rgba(59, 130, 246, 0.4)', 
                padding: '0.15rem 0.3rem',
                maxWidth: '120px',
                fontSize: '0.65rem',
              }}
              value={selectedMicId}
              onChange={(e) => changeMicId(e.target.value)}
              onFocus={fetchDevices}
              title="Select Physical Microphone (Input)"
            >
              <option value="">Default Mic</option>
              {inputDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>
              ))}
            </select>

            <select 
              className="btn"
              style={{ 
                backgroundColor: 'var(--panel-bg)', 
                color: '#10b981', 
                border: '1px solid rgba(16, 185, 129, 0.4)', 
                padding: '0.15rem 0.3rem',
                maxWidth: '120px',
                fontSize: '0.65rem',
              }}
              value={selectedSinkId}
              onChange={(e) => changeSinkId(e.target.value)}
              onFocus={fetchDevices}
              title="Select Virtual Cable (Output)"
            >
              <option value="">Default Speaker</option>
              {outputDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,5)}`}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Removed legacy Session Timer here */}
      </div>
      
      <div className="income-dashboard">
        <div className="income-card income-tier-1">
          <span className="income-label">This Month</span>
          <span className="income-ars">AR${Math.round(stats.monthlyMinutes * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}</span>
          <span className="income-usd" title={`Realistic max monthly capacity based on 35m/hr flow (${Math.round(monthlyMaxMins)}m)`}>
            ${(stats.monthlyMinutes * RATE_PER_MINUTE).toFixed(2)} USD
            <span style={{opacity: 0.5, marginLeft: '0.4rem'}}>| Est Max AR${monthlyMaxArs}</span>
          </span>
          <EditableMinutes value={stats.monthlyMinutes} updateFn={updateStat} statKey="monthlyMinutes" />
          <div style={{ width: '80%', height: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '0.2rem', borderRadius: '1px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (stats.monthlyMinutes / monthlyMaxMins)*100)}%`, background: '#6ee7b7' }}/>
          </div>
          <div style={{ 
            background: 'linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(139, 92, 246, 0.15) 100%)',
            padding: '0.1rem 0.4rem',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.05)',
            fontSize: '0.55rem',
            color: '#e2e8f0',
            marginTop: '0.4rem',
            boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.05)'
          }}>
            <span style={{opacity: 0.8}}>Total Remaining: </span>
            <strong style={{color: '#c4b5fd', textShadow: '0 0 8px rgba(196, 181, 253, 0.4)', fontSize: '1.05em'}}>AR${monthlyRemainingCash}</strong>
          </div>
        </div>

        <div className="income-card income-tier-2">
          <span className="income-label">Today</span>
          <span className="income-ars">AR${Math.round(stats.dailyMinutes * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}</span>
          <span className="income-usd" title={`Realistic max daily capacity given remaining hours at 35m/hr (${Math.round(realisticMaxToday)}m)`}>
            ${(stats.dailyMinutes * RATE_PER_MINUTE).toFixed(2)} USD
            <span style={{opacity: 0.5, marginLeft: '0.4rem'}}>| Est Max AR${dailyMaxArs}</span>
          </span>
          <EditableMinutes value={stats.dailyMinutes} updateFn={updateStat} statKey="dailyMinutes" />
          <div style={{ width: '80%', height: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '0.2rem', borderRadius: '1px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (stats.dailyMinutes / realisticMaxToday)*100)}%`, background: '#34d399' }}/>
          </div>
        </div>

        <div className={`income-card income-tier-3 ${isActive ? 'active' : ''}`}>
          <span className="income-label">Current Call ({formatTime(sessionSeconds)})</span>
          <span className="income-ars">AR${Math.round(sessionEarnings * arsRate).toLocaleString('es-AR')}</span>
          <span className="income-usd">${sessionEarnings.toFixed(2)} USD</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.6rem', justifyContent: 'center' }}>
          <GoalEditor 
            statKey="goalMinutes" 
            valueMinutes={stats.goalMinutes} 
            updateFn={updateStat} 
            ratePerMinute={RATE_PER_MINUTE} 
            dailyAverage={requiredDailyAverage} 
            arsRate={arsRate} 
            setArsRate={setArsRate} 
            monthlyMinutes={stats.monthlyMinutes}
            remainingDays={remainingDays}
          />
        </div>

        {dailyGoal > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem', padding: '0 0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', alignItems: 'center' }}>
              <span>9:00 AM (Start)</span>
              <span style={{ 
                color: remainingMinsToday <= 0 ? '#34d399' : '#e2e8f0', 
                fontWeight: 600,
                background: remainingMinsToday <= 0 ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(52, 211, 153, 0.15) 100%)',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                letterSpacing: '0.5px',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: 'inset 0 0 10px rgba(52, 211, 153, 0.05)'
              }}>
                {remainingMinsToday <= 0 
                  ? `🎉 Shift Goal Met!` 
                  : (
                    <>
                      <span>⏳ {hoursLeft.toFixed(1)}h left</span>
                      <span style={{opacity: 0.5}}>|</span>
                      <span>Claim up to <strong style={{color: '#6ee7b7', textShadow: '0 0 8px rgba(110, 231, 183, 0.4)', fontSize: '1.05em'}}>AR${maxCashToClaim}</strong> today</span>
                    </>
                  )}
              </span>
              <span>11:00 PM (End)</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', position: 'relative' }} title={`Completed: ${stats.dailyMinutes}m`}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${dailyProgressRatio * 100}%`, backgroundColor: remainingMinsToday <= 0 ? '#34d399' : '#3b82f6', borderRadius: '3px', transition: 'width 1s' }} />
              <div style={{ position: 'absolute', top: '-3px', bottom: '-3px', left: `${timeElapsedRatio * 100}%`, width: '2px', backgroundColor: '#fff', zIndex: 10, borderRadius: '1px', boxShadow: '0 0 4px rgba(0,0,0,0.8)' }} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
