import React from 'react';
import { useSession } from '../contexts/SessionContext';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { PlayIcon, StopIcon, KeyIcon, formatTime, GoalEditor, EditableMinutes, ConnectionIndicator } from './HeaderWidgets';

export const DashboardHeader = ({ onStartAudio, onStopAudio, sttLanguage, onToggleLanguage, connectionState, connectionMessage }) => {
  const { isActive, sessionSeconds, sessionEarnings, stats, updateStat, startSession, stopSession, RATE_PER_MINUTE, arsRate, setArsRate } = useSession();
  const { outputDevices, inputDevices, selectedSinkId, selectedMicId, changeSinkId, changeMicId, fetchDevices } = useAudioSettings();

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
            <button className="btn btn-danger recording" onClick={handleStop}>
              <StopIcon /> Stop
            </button>
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
              padding: '0.4rem 1rem',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
              borderRadius: '6px',
              border: sttLanguage === 'auto' ? '1px solid var(--panel-border)' : '1px solid transparent',
              fontSize: '0.85rem',
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
                padding: '0.2rem 0.4rem',
                maxWidth: '140px',
                fontSize: '0.70rem',
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
                padding: '0.2rem 0.4rem',
                maxWidth: '140px',
                fontSize: '0.70rem',
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
          <span className="income-usd">${(stats.monthlyMinutes * RATE_PER_MINUTE).toFixed(2)} USD</span>
          <EditableMinutes value={stats.monthlyMinutes} updateFn={updateStat} statKey="monthlyMinutes" />
        </div>

        <div className="income-card income-tier-2">
          <span className="income-label">Today</span>
          <span className="income-ars">AR${Math.round(stats.dailyMinutes * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}</span>
          <span className="income-usd">${(stats.dailyMinutes * RATE_PER_MINUTE).toFixed(2)} USD</span>
          <EditableMinutes value={stats.dailyMinutes} updateFn={updateStat} statKey="dailyMinutes" />
        </div>

        <div className={`income-card income-tier-3 ${isActive ? 'active' : ''}`}>
          <span className="income-label">Current Call ({formatTime(sessionSeconds)})</span>
          <span className="income-ars">AR${Math.round(sessionEarnings * arsRate).toLocaleString('es-AR')}</span>
          <span className="income-usd">${sessionEarnings.toFixed(2)} USD</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', opacity: 0.8, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.8rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>USD/ARS Rate</span>
            <input 
              type="number" 
              className="stat-input-ars" 
              value={arsRate} 
              onChange={e => setArsRate(e.target.value)}
            />
          </div>
          <GoalEditor label="Target Goal" statKey="goalMinutes" valueMinutes={stats.goalMinutes} updateFn={updateStat} ratePerMinute={RATE_PER_MINUTE} dailyAverage={requiredDailyAverage} />
        </div>
      </div>
    </header>
  );
};
