import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { GameScoreboard } from './GameScoreboard';

export const DashboardHeader = ({ onStartAudio, onStopAudio, onReconnectStream, sttLanguage, onToggleLanguage, onRecovery, connectionState, connectionMessage, lastDataTime }) => {
  const { isActive, sessionSeconds, stats, stopSession, endDay, RATE_PER_MINUTE, arsRate, isBreakActive, startBreak, stopBreak, isEditingScoreboard, setIsEditingScoreboard, isNotesOpen, setIsNotesOpen, isToolbarVisible, setIsToolbarVisible, isZombieCall, lastActivityTime, dailyLog } = useSession();

  const { inputDevices, selectedMicId, changeMicId, fetchDevices } = useAudioSettings();
  const audioEngine = useProgressiveAudio();
  // const { playChaChing } = useRewardAudio();

  const [isFlareActive, setIsFlareActive] = useState(false);
  const [silenceCount, setSilenceCount] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setSilenceCount(Math.floor((Date.now() - lastActivityTime) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [lastActivityTime]);

  const triggerFlare = () => {
    setIsFlareActive(true);
    setTimeout(() => setIsFlareActive(false), 500);
  };

  const handleStop = () => {
    stopSession((mins) => {
      triggerFlare();
      let rem = Math.round(mins);
      const diamonds = Math.floor(rem / 20); rem %= 20;
      const bills = Math.floor(rem / 5); rem %= 5;
      const coins = rem;
      for(let i=0; i < diamonds; i++) setTimeout(() => audioEngine.playDiamond(), i * 400);
      for(let i=0; i < bills; i++) setTimeout(() => audioEngine.playBill(), (diamonds * 400) + (i * 300));
      for(let i=0; i < coins; i++) setTimeout(() => audioEngine.playCoin(), (diamonds * 400) + (bills * 300) + (i * 200));
    });
    onStopAudio();
  };

  const handleEndDay = () => {
    endDay((mins) => {
      triggerFlare();
      audioEngine.playMetalChest();
    });
  };

  // State Border Logic
  const stateBorderClass = isActive ? 'scoreboard-state-active' 
                        : isBreakActive ? 'scoreboard-state-break' 
                        : silenceCount > 45 ? 'scoreboard-state-idle' : '';

  // Data for Scoreboard
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), currentDay = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = daysInMonth - currentDay + 1;
  const minutesBeforeToday = Math.max(0, stats.monthlyMinutes - stats.dailyMinutes);
  const remainingMinutesFromStartOfDay = Math.max(0, stats.goalMinutes - minutesBeforeToday);
  const workingDaysMo = 22; 
  const baseYield = (stats.goalMinutes || 5500) / workingDaysMo;
  const dailyGoal = Math.max(baseYield, remainingMinutesFromStartOfDay / Math.max(1, remainingDays));
  
  const totalDailyMins = stats.dailyMinutes + (isActive ? sessionSeconds / 60 : 0);
  const liveDailyArs = Math.round(totalDailyMins * RATE_PER_MINUTE * arsRate);
  const dailyTargetArs = Math.round(dailyGoal * RATE_PER_MINUTE * arsRate);
  const monthlyArs = Math.round(stats.monthlyMinutes * RATE_PER_MINUTE * arsRate);
  const monthlyTargetArs = Math.round(stats.goalMinutes * RATE_PER_MINUTE * arsRate);
  const shiftElapsedMins = stats.dayStartTime ? Math.max(0, (Date.now() - stats.dayStartTime) / 60000) : 0;
  const breakLimit = 90;
  const breakUsed = stats.dailyBreakMinutes || 0;
  const breakLeft = Math.max(0, breakLimit - breakUsed);

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

  return (
    <header className={`dashboard-header ${stateBorderClass}`} style={{ 
      background: 'var(--bg-color)', borderBottom: '1px solid #18181b', borderRadius: 0,
      padding: '4px', position: 'relative', zIndex: 100, height: '100px', display: 'flex', alignItems: 'stretch'
    }}>
      <div className={`condensed-header-card ${isFlareActive ? 'flare-trigger' : ''}`} style={{ 
        background: 'transparent', border: 'none', borderRadius: 0, padding: 0,
        display: 'grid', gridTemplateColumns: '50px 1fr 50px', width: '100%'
      }}>
        
        {/* LEFT CONTROLS: Connect, Break, End Day */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', borderRight: '1px solid #18181b', padding: '4px' }}>
            {!isActive ? (
               <div style={{ position: 'relative' }}>
                <button className="btn-emoji" onClick={isZombieCall ? onRecovery : onStartAudio} style={{ 
                  background: isZombieCall ? 'var(--danger)' : 'var(--success)', 
                  width: '32px', height: '32px', fontSize: '1rem', color: '#000', fontWeight: 900,
                  position: 'relative', zIndex: 2
                }}>
                  {isZombieCall ? '!' : '>'}
                </button>
               </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div className="sonar-ring" />
                <button className="btn-emoji" onClick={handleStop} style={{ 
                  background: 'var(--danger)', width: '32px', height: '32px', fontSize: '1rem', color: '#000', fontWeight: 900,
                  position: 'relative', zIndex: 2
                }}>X</button>
              </div>
            )}

            {!isActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button className="edit-btn-tiny" onClick={isBreakActive ? stopBreak : startBreak} style={{ color: isBreakActive ? '#fb923c' : '#9ca3af', fontSize: '0.6rem' }}>
                  {isBreakActive ? '[COFFEE_STOP]' : '[COFFEE]'}
                </button>
                {stats.dailyMinutes > 0 && (
                  <button className="edit-btn-tiny" onClick={handleEndDay} style={{ color: '#8b5cf6', fontSize: '0.6rem' }}>[BANK_DAY]</button>
                )}
              </div>
            )}

            {isActive && (
               <button className="edit-btn-tiny" onClick={onReconnectStream} style={{ color: '#0ea5e9', fontSize: '0.6rem' }}>[ZAP]</button>
            )}
        </div>

        {/* CENTER: Scoreboard (Ascii Meters) */}
        <div style={{ padding: '0 8px', overflow: 'hidden' }}>
           <GameScoreboard
                liveDailyArs={liveDailyArs} dailyTargetArs={dailyTargetArs}
                monthlyArs={monthlyArs} monthlyTargetArs={monthlyTargetArs}
                stats={stats} dailyGoal={dailyGoal} totalDailyMins={totalDailyMins}
                shiftElapsedMins={shiftElapsedMins}
                breakLeft={breakLeft} breakLimit={breakLimit}
                remainingDays={remainingDays} isActive={isActive} isBreakActive={isBreakActive}
                onSwitchToNumbers={() => {}}
                isEditingScoreboard={isEditingScoreboard}
                getCompensatedLogOff={getCompensatedLogOff}
                dailyLog={dailyLog}
            />
        </div>

        {/* RIGHT CONTROLS: Tools, Notes, Edit, etc. (SINGLE ROW/STACK) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid #18181b', padding: '4px', justifyContent: 'center', alignItems: 'center' }}>
          <button className="btn-icon tiny-btn" onClick={() => setIsToolbarVisible(!isToolbarVisible)} style={{ opacity: isToolbarVisible ? 1 : 0.3, fontSize: '0.6rem' }}>TOOLS</button>
          <button className="btn-icon tiny-btn" onClick={() => setIsNotesOpen(!isNotesOpen)} style={{ opacity: isNotesOpen ? 1 : 0.3, fontSize: '0.6rem' }}>NOTES</button>
          <button className="btn-icon tiny-btn" onClick={() => setIsEditingScoreboard(!isEditingScoreboard)} style={{ opacity: isEditingScoreboard ? 1 : 0.3, fontSize: '0.6rem' }}>EDIT</button>
          
          <div style={{ marginTop: 'auto', display: 'flex', gap: '2px' }}>
            <select style={{ fontSize: '0.5rem', background: '#000', color: 'var(--text-muted)', border: '1px solid #18181b' }} value={selectedMicId} onChange={e => changeMicId(e.target.value)} onFocus={fetchDevices}>
              <option value="">🎤</option>
              {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || '...'}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Connection State Info Overlay (Tiny) */}
      <div style={{ 
        position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
        fontSize: '0.5rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)',
        whiteSpace: 'nowrap', pointerEvents: 'none'
      }}>
        {connectionMessage || 'SYSTEM_STABLE'} | {sttLanguage.toUpperCase()}
      </div>
    </header>
  );
};
