import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';

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

export const DashboardHeader = ({ onStartAudio, onStopAudio, sttLanguage, onToggleLanguage }) => {
  const { isActive, sessionSeconds, sessionEarnings, stats, updateStat, startSession, stopSession, RATE_PER_MINUTE } = useSession();

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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isActive ? (
            <button className="btn btn-primary" onClick={handleStart}>
              <PlayIcon /> Connect
            </button>
          ) : (
            <button className="btn btn-danger recording" onClick={handleStop}>
              <StopIcon /> Stop
            </button>
          )}
          <button 
            className="btn" 
            style={{ backgroundColor: sttLanguage === 'en' ? '#3b82f6' : '#10b981' }}
            onClick={onToggleLanguage}
            title="Press SPACE to toggle safely without clicking"
          >
            {sttLanguage === 'en' ? 'Lang: EN' : 'Lang: ES'}
          </button>
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
