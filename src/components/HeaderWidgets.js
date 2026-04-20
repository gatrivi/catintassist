import React, { useState } from 'react';
import { DialGoalSelector } from './DialGoalSelector';

// Basic SVG icons
export const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

export const StopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
  </svg>
);

export const KeyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
  </svg>
);

export const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const GoalEditor = ({ statKey, valueMinutes, updateFn, ratePerMinute, dailyAverage, arsRate, setArsRate, monthlyMinutes, dailyMinutes = 0, remainingDays }) => {
  const [isEditing, setIsEditing] = useState(false);
  const currentArs = Math.round(valueMinutes * ratePerMinute * (arsRate || 1000)).toLocaleString('es-AR');

  const handleSave = (monthlyMins) => {
     updateFn(statKey, monthlyMins);
     setIsEditing(false);
  };

  return (
    <div className="stat-group" style={{ textAlign: 'right', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
      {isEditing ? (
        <DialGoalSelector 
          ratePerMinute={ratePerMinute} 
          arsRate={arsRate} 
          setArsRate={setArsRate}
          onSave={handleSave} 
          onCancel={() => setIsEditing(false)} 
        />
      ) : (
        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }} onClick={() => setIsEditing(true)} title="Click to edit goal or ARS rate">
          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>🎯 Goal: <strong style={{ color: '#6ee7b7' }}>{valueMinutes}m</strong> <span style={{ opacity: 0.6, fontSize: '0.85em' }}>(AR${currentArs})</span></div>
          {dailyAverage > 0 && (
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c4b5fd', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '6px' }} title="Daily Average Needed">
              ⚡ Needed: <strong style={{color: '#a78bfa'}}>{dailyAverage}m/day</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const EditableMinutes = ({ value, updateFn, statKey }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateFn(statKey, parseFloat(tempValue) || 0); // Allow decimal minutes since we math.round them visually
    setIsEditing(false);
  };

  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  const hoursDisplay = value >= 60 ? ` (${hours}h ${mins}m)` : '';

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} style={{ marginTop: '0.5rem' }}>
        <input 
          type="number" 
          step="any"
          className="stat-input" 
          style={{ width: '60px', padding: '0.2rem' }}
          value={tempValue} 
          onChange={e => setTempValue(e.target.value)}
          onBlur={handleSubmit}
          autoFocus
        />
      </form>
    );
  }

  return (
    <div 
      style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 500 }}
      onClick={() => { setTempValue(value); setIsEditing(true); }}
      title="Click to edit minutes"
    >
      📝 {Math.round(value)}m <span style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 400 }}>{hoursDisplay}</span>
    </div>
  );
};

export const ConnectionIndicator = ({ state, message }) => {
  let color = 'gray';
  let title = message || 'Interpreting Service: Disconnected (Press Connect to start)';
  const isConnected = state === 'connected';
  
  if (isConnected) { 
    color = '#10b981'; 
  }
  else if (state === 'connecting') { 
    color = '#f59e0b'; 
  }
  else if (state === 'error') { 
    color = '#ef4444'; 
  }

  const pulseKeyframes = `
    @keyframes heartbeat {
      0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0px #10b981; }
      50% { transform: scale(1.15); opacity: 0.8; box-shadow: 0 0 10px #10b981; }
      100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0px #10b981; }
    }
  `;

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div 
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: state === 'connected' ? '0 0 8px #10b981' : (state === 'connecting' ? '0 0 8px #f59e0b' : 'none'),
          transition: 'all 0.3s ease',
          cursor: 'help',
          flexShrink: 0,
          animation: isConnected ? 'heartbeat 2s infinite ease-in-out' : 'none'
        }}
        title={title}
      />
    </>
  );
};
