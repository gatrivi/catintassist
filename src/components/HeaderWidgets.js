import React, { useState } from 'react';

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

export const GoalEditor = ({ label, statKey, valueMinutes, updateFn, ratePerMinute, dailyAverage }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempMins, setTempMins] = useState(valueMinutes);
  const [tempUsd, setTempUsd] = useState((valueMinutes * ratePerMinute).toFixed(2));

  const handleMinChange = (v) => {
    setTempMins(v);
    setTempUsd((v * ratePerMinute).toFixed(2));
  };
  const handleUsdChange = (v) => {
    setTempUsd(v);
    setTempMins(Math.round(v / ratePerMinute));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateFn(statKey, parseInt(tempMins, 10) || 0);
    setIsEditing(false);
  };

  const currentUsd = (valueMinutes * ratePerMinute).toFixed(2);

  return (
    <div className="stat-group" style={{ textAlign: 'center' }}>
      <span className="stat-label" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
      {isEditing ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
            <input type="number" className="stat-input" style={{ width: '60px', padding: '0.2rem' }} value={tempMins} onChange={e => handleMinChange(e.target.value)} autoFocus />
            <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>min</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
            <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>USD</span>
            <input type="number" step="0.01" className="stat-input" style={{ width: '60px', padding: '0.2rem' }} value={tempUsd} onChange={e => handleUsdChange(e.target.value)} />
          </div>
          <button type="submit" style={{ display: 'none' }}>Save</button>
        </form>
      ) : (
        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem' }} onClick={() => { setTempMins(valueMinutes); setTempUsd(currentUsd); setIsEditing(true); }} title="Click to edit goal">
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6ee7b7' }}>{valueMinutes}m <span style={{ opacity: 0.7, fontSize: '0.75em' }}>/ ${currentUsd}</span></div>
          {dailyAverage > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#a78bfa', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
              Daily Avg needed: <strong>{dailyAverage}m</strong> <span style={{opacity: 0.8}}>(${(dailyAverage * ratePerMinute).toFixed(2)})</span>
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
      style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontWeight: 500 }}
      onClick={() => { setTempValue(value); setIsEditing(true); }}
      title="Click to edit minutes"
    >
      {value}m <span style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 400 }}>{hoursDisplay}</span>
    </div>
  );
};

export const ConnectionIndicator = ({ state }) => {
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
