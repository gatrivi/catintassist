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

export const GoalEditor = ({ statKey, valueMinutes, updateFn, ratePerMinute, dailyAverage, arsRate, setArsRate, monthlyMinutes, remainingDays }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempMins, setTempMins] = useState(valueMinutes.toString());
  const [tempDailyAvg, setTempDailyAvg] = useState(dailyAverage.toString());

  const [editHours, setEditHours] = useState(Math.floor(valueMinutes / 60).toString());
  const [editMinsRemainder, setEditMinsRemainder] = useState((valueMinutes % 60).toFixed(0));
  
  const [editArsTotal, setEditArsTotal] = useState((valueMinutes * ratePerMinute * (arsRate || 1000)).toFixed(0));

  const currentArs = Math.round(valueMinutes * ratePerMinute * (arsRate || 1000)).toLocaleString('es-AR');
  const dailyArs = Math.round(dailyAverage * ratePerMinute * (arsRate || 1000)).toLocaleString('es-AR');

  const handleDirectMinChange = (v) => {
    setTempMins(v);
    const targetMins = parseFloat(v) || 0;
    
    setEditHours(Math.floor(targetMins / 60).toString());
    setEditMinsRemainder((targetMins % 60).toFixed(1).replace(/\.0$/, ''));
    setEditArsTotal((targetMins * ratePerMinute * (arsRate || 1000)).toFixed(0));
    
    const remainingMins = Math.max(0, targetMins - monthlyMinutes);
    setTempDailyAvg(remainingDays > 0 ? (remainingMins / remainingDays).toFixed(0) : 0);
  };

  const handleTimeChange = (type, val) => {
    let newH = editHours;
    let newM = editMinsRemainder;
    
    if (type === 'h') {
      newH = val;
      setEditHours(val);
    } else {
      newM = val;
      setEditMinsRemainder(val);
    }
    
    const targetMins = (parseInt(newH) || 0) * 60 + (parseFloat(newM) || 0);
    setTempMins(targetMins.toString());
    setEditArsTotal((targetMins * ratePerMinute * (arsRate || 1000)).toFixed(0));
    
    const remainingMins = Math.max(0, targetMins - monthlyMinutes);
    setTempDailyAvg(remainingDays > 0 ? (remainingMins / remainingDays).toFixed(0) : 0);
  };

  const handleTargetArsChange = (v) => {
    setEditArsTotal(v);
    const targetArs = parseFloat(v) || 0;
    const targetMins = targetArs / (ratePerMinute * (arsRate || 1000));
    
    setTempMins(targetMins.toFixed(0));
    setEditHours(Math.floor(targetMins / 60).toString());
    setEditMinsRemainder((targetMins % 60).toFixed(1).replace(/\.0$/, ''));
    
    const remainingMins = Math.max(0, targetMins - monthlyMinutes);
    setTempDailyAvg(remainingDays > 0 ? (remainingMins / remainingDays).toFixed(0) : 0);
  };

  const handleDailyAvgChange = (v) => {
    setTempDailyAvg(v);
    const parsedAvg = parseFloat(v) || 0;
    const projectedGoal = monthlyMinutes + (parsedAvg * remainingDays);
    
    setTempMins(projectedGoal.toFixed(0));
    setEditHours(Math.floor(projectedGoal / 60).toString());
    setEditMinsRemainder((projectedGoal % 60).toFixed(0));
    setEditArsTotal((projectedGoal * ratePerMinute * (arsRate || 1000)).toFixed(0));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateFn(statKey, parseFloat(tempMins));
    setIsEditing(false);
  };

  return (
    <div className="stat-group" style={{ textAlign: 'right', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
      {isEditing ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end', background: 'rgba(0,0,0,0.85)', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--panel-border)', zIndex: 100, position: 'absolute', top: '100%', right: 0, backdropFilter: 'blur(10px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{fontSize: '0.65rem', color: 'var(--text-muted)'}} title="Total Target Cash">🎯 AR$</span>
            <input type="number" step="any" className="stat-input" style={{ width: '80px', padding: '0.1rem', fontSize: '0.65rem', color: '#6ee7b7' }} value={editArsTotal} onChange={e => handleTargetArsChange(e.target.value)} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{fontSize: '0.65rem', color: 'var(--text-muted)'}}>⏱</span>
            <input type="number" step="any" className="stat-input" style={{ width: '55px', padding: '0.1rem', fontSize: '0.65rem' }} value={tempMins} onChange={e => handleDirectMinChange(e.target.value)} title="Total Minutes" />
            <span style={{fontSize: '0.65rem', color: 'var(--text-muted)'}}>m /</span>
            <input type="number" className="stat-input" style={{ width: '45px', padding: '0.1rem', fontSize: '0.65rem' }} value={editHours} onChange={e => handleTimeChange('h', e.target.value)} title="Hours" />
            <span style={{fontSize: '0.65rem', color: 'var(--text-muted)'}}>h</span>
            <input type="number" step="any" className="stat-input" style={{ width: '45px', padding: '0.1rem', fontSize: '0.65rem' }} value={editMinsRemainder} onChange={e => handleTimeChange('m', e.target.value)} title="Minutes" />
            <span style={{fontSize: '0.65rem', color: 'var(--text-muted)'}}>m</span>
          </div>

          <hr style={{ width: '100%', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.1rem 0' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{fontSize: '0.65rem', color: 'var(--text-muted)'}} title="Daily Average">📈 avg</span>
            <input type="number" step="any" className="stat-input" style={{ width: '50px', padding: '0.1rem', fontSize: '0.65rem' }} value={tempDailyAvg} onChange={e => handleDailyAvgChange(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{fontSize: '0.65rem', color: 'var(--text-muted)'}} title="Conversion Rate">💱 ARS</span>
            <input type="number" step="any" className="stat-input" style={{ width: '50px', padding: '0.1rem', fontSize: '0.65rem' }} value={arsRate} onChange={e => setArsRate(e.target.value)} />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ padding: '0.2rem 1rem', fontSize: '0.65rem', width: '100%', marginTop: '0.2rem' }}>Save & Close</button>
        </form>
      ) : (
        <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }} onClick={() => { setTempMins(valueMinutes); setTempDailyAvg(dailyAverage); setIsEditing(true); }} title="Click to edit goal or ARS rate">
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
