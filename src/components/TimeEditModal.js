import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { formatTime } from './HeaderWidgets';

/**
 * TimeEditModal — lets the user retroactively correct call or break time.
 * Props:
 *   mode: 'call' | 'break'
 *   onClose: fn
 */
export const TimeEditModal = ({ mode, onClose }) => {
  const {
    sessionSeconds, setSessionSeconds,
    breakSeconds, setBreakSeconds,
    stats, updateStat,
    isActive, isBreakActive,
  } = useSession();

  // Current value in minutes (for display/editing)
  const currentSecs  = mode === 'call' ? sessionSeconds : breakSeconds;
  const currentMins  = (currentSecs / 60).toFixed(1);
  const bankedLabel  = mode === 'call' ? 'Today banked (mins)' : 'Today break (mins)';
  const bankedValue  = mode === 'call' ? Math.round(stats.dailyMinutes) : Math.round(stats.dailyBreakMinutes || 0);

  const [liveMins, setLiveMins]     = useState(currentMins); // edit live timer
  const [addMins, setAddMins]       = useState('');            // add to banked
  const [bankedMins, setBankedMins] = useState(String(bankedValue)); // edit banked directly
  const [done, setDone]             = useState(false);

  const applyLive = () => {
    const v = parseFloat(liveMins);
    if (isNaN(v) || v < 0) return;
    if (mode === 'call') setSessionSeconds(Math.round(v * 60));
    else setBreakSeconds(Math.round(v * 60));
  };

  const applyAdd = () => {
    const v = parseFloat(addMins);
    if (isNaN(v) || v === 0) return;
    if (mode === 'call') updateStat('dailyMinutes', bankedValue + v);
    else updateStat('dailyBreakMinutes', bankedValue + v);
    setAddMins('');
  };

  const applyBanked = () => {
    const v = parseFloat(bankedMins);
    if (isNaN(v) || v < 0) return;
    if (mode === 'call') updateStat('dailyMinutes', v);
    else updateStat('dailyBreakMinutes', v);
  };

  const accentColor = mode === 'call' ? '#3b82f6' : '#fb923c';
  const modeLabel   = mode === 'call' ? '📞 Call Time' : '☕ Break Time';

  return (
    <div
      id={`${mode}-edit-modal-overlay`}
      onClick={(e) => { if (e.target.id === `${mode}-edit-modal-overlay`) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeSlideIn 0.15s ease-out',
      }}
    >
      <div
        id={`${mode}-edit-modal`}
        style={{
          background: 'rgba(15,23,42,0.98)',
          border: `1px solid ${accentColor}44`,
          borderRadius: '12px',
          padding: '1rem',
          width: 'min(320px, 92vw)',
          display: 'flex', flexDirection: 'column', gap: '0.7rem',
          boxShadow: `0 0 40px ${accentColor}22`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: accentColor }}>{modeLabel} Editor</span>
          <button
            id={`${mode}-edit-modal-close-btn`}
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1rem' }}
          >✕</button>
        </div>

        {/* Section 1: Edit the live (current session) timer */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {mode === 'call' ? (isActive ? 'Live call timer' : 'Last call timer') : (isBreakActive ? 'Live break timer' : 'Last break timer')}
            <span style={{ float: 'right', color: '#94a3b8' }}>{formatTime(currentSecs)}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              id={`${mode}-edit-live-input`}
              type="number" min="0" max="600" step="0.5"
              value={liveMins}
              onChange={e => setLiveMins(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: `1px solid ${accentColor}44`, color: '#fff', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontFamily: 'inherit' }}
              placeholder="minutes"
            />
            <button
              id={`${mode}-edit-live-apply-btn`}
              onClick={() => { applyLive(); setDone(true); setTimeout(() => setDone(false), 800); }}
              style={{ background: accentColor, border: 'none', color: '#fff', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
            >Set</button>
          </div>
        </div>

        {/* Section 2: Add minutes to banked total */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Add to banked total
            <span style={{ float: 'right', color: '#94a3b8' }}>{bankedValue}m banked</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              id={`${mode}-edit-add-input`}
              type="number" min="-600" max="600" step="1"
              value={addMins}
              onChange={e => setAddMins(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: `1px solid ${accentColor}44`, color: '#fff', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontFamily: 'inherit' }}
              placeholder="± minutes"
            />
            <button
              id={`${mode}-edit-add-btn`}
              onClick={() => { applyAdd(); setDone(true); setTimeout(() => setDone(false), 800); }}
              style={{ background: accentColor, border: 'none', color: '#fff', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
            >Add</button>
          </div>
        </div>

        {/* Section 3: Set banked total directly */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {bankedLabel} — set directly
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              id={`${mode}-edit-banked-input`}
              type="number" min="0" max="1440"
              value={bankedMins}
              onChange={e => setBankedMins(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: `1px solid ${accentColor}44`, color: '#fff', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', fontFamily: 'inherit' }}
              placeholder="total minutes"
            />
            <button
              id={`${mode}-edit-banked-apply-btn`}
              onClick={() => { applyBanked(); setDone(true); setTimeout(() => setDone(false), 800); }}
              style={{ background: accentColor, border: 'none', color: '#fff', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
            >Set</button>
          </div>
        </div>

        <button
          id={`${mode}-edit-done-btn`}
          onClick={onClose}
          style={{ background: done ? '#10b981' : 'rgba(255,255,255,0.06)', border: 'none', color: done ? '#fff' : '#94a3b8', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.3s' }}
        >{done ? '✅ Saved!' : 'Done'}</button>
      </div>
    </div>
  );
};
