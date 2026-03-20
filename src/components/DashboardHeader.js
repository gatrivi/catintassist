import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useAudioSettings } from '../contexts/AudioSettingsContext';

// Basic SVG icons
const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const StopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
  </svg>
);

const KeyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
  </svg>
);

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const StatEditor = ({ label, statKey, value, updateFn, earnings }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateFn(statKey, tempValue);
    setIsEditing(false);
  };

  return (
    <div className="stat-group">
      <span className="stat-label">{label}</span>
      {isEditing ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.2rem' }}>
          <input 
            type="number" 
            className="stat-input" 
            value={tempValue} 
            onChange={e => setTempValue(e.target.value)}
            onBlur={handleSubmit}
            autoFocus
          />
        </form>
      ) : (
        <div className="stat-item" onClick={() => { setTempValue(value); setIsEditing(true); }} title="Click to edit">
          <span className="stat-value">{value}m</span>
          {earnings !== undefined && <span className="stat-earning">(${earnings.toFixed(2)})</span>}
        </div>
      )}
    </div>
  );
};

const ConnectionIndicator = ({ state }) => {
  let color = 'gray';
  let title = 'Disconnected';
  if (state === 'connected') { color = '#10b981'; title = 'Connected'; }
  else if (state === 'connecting') { color = '#f59e0b'; title = 'Connecting...'; }
  else if (state === 'error') { color = '#ef4444'; title = 'Error'; }

  return (
    <div 
      style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: state === 'connected' ? '0 0 8px #10b981' : state === 'connecting' ? '0 0 8px #f59e0b' : 'none',
        transition: 'all 0.3s ease',
        cursor: 'help'
      }}
      title={title}
    />
  );
};

export const DashboardHeader = ({ onStartAudio, onStopAudio, sttLanguage, onToggleLanguage, connectionState, connectionMessage }) => {
  const { isActive, sessionSeconds, sessionEarnings, stats, updateStat, startSession, stopSession, RATE_PER_MINUTE } = useSession();
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
        
        <div className="stat-group" style={{ alignItems: 'flex-end' }}>
          <span className="stat-label">Session Timer</span>
          <div className="stat-item" style={{ cursor: 'default' }}>
            <span className="stat-value" style={{ color: '#fff', fontSize: '1.2rem' }}>{formatTime(sessionSeconds)}</span>
            <span className="stat-earning">(${sessionEarnings.toFixed(2)})</span>
          </div>
        </div>
      </div>
      
      <div className="dashboard-stats">
        <StatEditor 
          label="Today" 
          statKey="dailyMinutes" 
          value={stats.dailyMinutes} 
          updateFn={updateStat} 
          earnings={stats.dailyMinutes * RATE_PER_MINUTE} 
        />
        
        <StatEditor 
          label="This Week" 
          statKey="weeklyMinutes" 
          value={stats.weeklyMinutes} 
          updateFn={updateStat} 
          earnings={stats.weeklyMinutes * RATE_PER_MINUTE} 
        />

        <StatEditor 
          label="This Month" 
          statKey="monthlyMinutes" 
          value={stats.monthlyMinutes} 
          updateFn={updateStat} 
          earnings={stats.monthlyMinutes * RATE_PER_MINUTE} 
        />

        <StatEditor 
          label="Monthly Goal" 
          statKey="goalMinutes" 
          value={stats.goalMinutes} 
          updateFn={updateStat} 
        />
        
        <div className="stat-group">
          <span className="stat-label" title="Daily average strictly needed to reach goal">Target Avg</span>
          <div className="stat-item" style={{ cursor: 'default' }}>
            <span className="stat-value">{requiredDailyAverage}m/day</span>
          </div>
        </div>
      </div>
    </header>
  );
};
