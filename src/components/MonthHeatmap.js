import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';

// ── GOAL TIERS ────────────────────────────────────────────────────────────────
// All in minutes. Labels mark which are reachable vs aspirational.
const TIERS = [
  { mins: 5500,  label: '🪜 Floor',       color: '#3b82f6', aspirational: false },
  { mins: 11000, label: '🚀 Growth',      color: '#a855f7', aspirational: false },
  { mins: 16500, label: '👑 Legend',      color: '#f59e0b', aspirational: false },
  { mins: 18500, label: '🔥 Target A',    color: '#fb923c', aspirational: true  }, // ~AR$2.4M
  { mins: 20000, label: '💎 Target B',    color: '#f43f5e', aspirational: true  }, // ~AR$2.6M
  { mins: 23100, label: '🌌 Next Month',  color: '#6b7280', aspirational: true  }, // ~AR$3M — visible but grayed
];

// Day-of-week labels (Mon-first)
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export const MonthHeatmap = () => {
  const {
    stats, dailyLog, commitDayToLog, setIsHeatmapOpen,
    RATE_PER_MINUTE, arsRate,
  } = useSession();

  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth();
  const today     = now.getDate();
  const daysInMo  = new Date(year, month + 1, 0).getDate();

  // Required daily average to hit the monthly goalMinutes
  const remainingDays    = daysInMo - today + 1;
  const remainingMins    = Math.max(0, stats.goalMinutes - stats.monthlyMinutes);
  const requiredPerDay   = remainingDays > 0 ? Math.ceil(remainingMins / remainingDays) : 0;

  // Build the calendar row array (1..daysInMo)
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const offset   = (firstDow + 6) % 7;               // Mon-first offset

  // Per-day editing state
  const [editDay, setEditDay]   = useState(null); // date number
  const [editVal, setEditVal]   = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editDay && inputRef.current) inputRef.current.focus();
  }, [editDay]);

  // Get mins for a given day-number (1..daysInMo)
  const getMins = (d) => {
    const key = new Date(year, month, d).toDateString();
    if (d === today) return stats.monthlyMinutes - getPastTotal();
    return dailyLog[key] || 0;
  };

  // Sum of all days before today that are in dailyLog
  const getPastTotal = () => {
    let sum = 0;
    for (let d = 1; d < today; d++) {
      const key = new Date(year, month, d).toDateString();
      sum += dailyLog[key] || 0;
    }
    return sum;
  };

  // Color coding per pebble
  const pebbleColor = (mins, isToday, isFuture) => {
    if (isFuture) return 'rgba(255,255,255,0.04)';
    if (mins === 0 && !isToday) return 'rgba(239,68,68,0.12)'; // worked nothing
    const ratio = requiredPerDay > 0 ? mins / requiredPerDay : 0;
    if (isToday) return 'rgba(59,130,246,0.2)';
    if (ratio >= 1)    return 'rgba(16,185,129,0.25)';  // hit goal — green
    if (ratio >= 0.6)  return 'rgba(245,158,11,0.2)';   // 60–99% — amber
    return 'rgba(239,68,68,0.18)';                       // <60% — red
  };

  const pebbleBorder = (mins, isToday, isFuture) => {
    if (isToday) return '1px solid rgba(59,130,246,0.7)';
    if (isFuture) return '1px solid rgba(255,255,255,0.06)';
    const ratio = requiredPerDay > 0 ? mins / requiredPerDay : 0;
    if (mins === 0) return '1px solid rgba(239,68,68,0.2)';
    if (ratio >= 1)   return '1px solid rgba(16,185,129,0.5)';
    if (ratio >= 0.6) return '1px solid rgba(245,158,11,0.4)';
    return '1px solid rgba(239,68,68,0.4)';
  };

  // Commit an inline edit
  const commitEdit = () => {
    if (editDay === null) return;
    const mins = parseFloat(editVal);
    if (!isNaN(mins) && mins >= 0) {
      const key = new Date(year, month, editDay).toDateString();
      commitDayToLog(key, mins);
    }
    setEditDay(null);
    setEditVal('');
  };

  // Pace context: how many mins/day to hit each tier
  const paceFor = (tierMins) => {
    const rem = Math.max(0, tierMins - stats.monthlyMinutes);
    return remainingDays > 0 ? Math.ceil(rem / remainingDays) : null;
  };

  // Is a tier reachable? (daily pace <= 480m and remaining > 0)
  const isReachable = (tierMins) => {
    if (stats.monthlyMinutes >= tierMins) return 'done';
    const daily = paceFor(tierMins);
    return daily !== null && daily <= 700 ? 'yes' : 'stretch';
  };

  const formatArs = (mins) => {
    const ars = Math.round(mins * RATE_PER_MINUTE * arsRate);
    return `AR$${ars.toLocaleString('es-AR')}`;
  };

  return (
    // Full-screen overlay
    <div
      id="heatmap-overlay"
      onClick={(e) => { if (e.target.id === 'heatmap-overlay') setIsHeatmapOpen(false); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeSlideIn 0.2s ease-out',
      }}
    >
      <div
        id="heatmap-panel"
        style={{
          background: 'rgba(15,23,42,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px',
          padding: '1rem',
          width: 'min(580px, 96vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
              📅 {now.toLocaleString('en', { month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#64748b' }}>
              Day {today}/{daysInMo} · {remainingDays} days left · Need {requiredPerDay}m/day for current goal
            </div>
          </div>
          <button
            id="heatmap-close-btn"
            onClick={() => setIsHeatmapOpen(false)}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            ✕ Close
          </button>
        </div>

        {/* GOAL TIERS — emphasis gradient */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ fontSize: '0.6rem', color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Goal Tiers</div>
          {TIERS.map((tier) => {
            const status = isReachable(tier.mins);
            const done = status === 'done';
            const reachable = status === 'yes';
            const daily = paceFor(tier.mins);

            // Dim "next month" tier heavily; dim other aspirationals slightly
            const opacity = done ? 0.5
              : tier.label.includes('Next Month') ? 0.35
              : tier.aspirational && !reachable ? 0.45
              : 1;

            const monthProgress = Math.min(1, stats.monthlyMinutes / tier.mins);

            return (
              <div
                key={tier.mins}
                title={tier.label.includes('Next Month') ? 'Start preparing — this is next month\'s target 🗓️' : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '8px',
                  background: done ? 'rgba(16,185,129,0.08)' : reachable ? `${tier.color}11` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : reachable ? `${tier.color}44` : 'rgba(255,255,255,0.05)'}`,
                  opacity,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: done ? '#10b981' : tier.color, minWidth: '90px', whiteSpace: 'nowrap' }}>
                  {done ? '✅ ' : ''}{tier.label}
                </span>
                {/* Progress bar */}
                <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${monthProgress * 100}%`, background: done ? '#10b981' : tier.color, borderRadius: '3px', transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontSize: '0.6rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                  {done
                    ? 'done!'
                    : tier.label.includes('Next Month')
                    ? `${Math.round(stats.monthlyMinutes / tier.mins * 100)}% prepared`
                    : reachable
                    ? `${daily}m/day`
                    : `${daily}m/day (stretch)`}
                </span>
                <span style={{ fontSize: '0.55rem', color: '#475569', whiteSpace: 'nowrap' }}>
                  {formatArs(tier.mins)}
                </span>
              </div>
            );
          })}
        </div>

        {/* CALENDAR GRID */}
        <div>
          <div style={{ fontSize: '0.6rem', color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Daily breakdown · Click a past day to edit
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.2rem' }}>
            {DOW.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.5rem', color: '#475569', fontWeight: 700 }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
            {/* Empty offset cells */}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {Array.from({ length: daysInMo }).map((_, idx) => {
              const d     = idx + 1;
              const isToday  = d === today;
              const isFuture = d > today;
              const mins     = isFuture ? 0 : getMins(d);
              const ratio    = requiredPerDay > 0 ? mins / requiredPerDay : 0;

              if (editDay === d) {
                return (
                  <div key={d} style={{ borderRadius: '6px', border: '1px solid rgba(59,130,246,0.7)', background: 'rgba(59,130,246,0.15)', padding: '0.15rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.5rem', color: '#94a3b8' }}>{d}</span>
                    <input
                      ref={inputRef}
                      id={`heatmap-day-edit-${d}`}
                      type="number" min="0" max="600"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditDay(null); setEditVal(''); }}}
                      onBlur={commitEdit}
                      style={{ width: '100%', fontSize: '0.65rem', textAlign: 'center', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontWeight: 700 }}
                      placeholder="0"
                    />
                    <span style={{ fontSize: '0.45rem', color: '#64748b' }}>mins</span>
                  </div>
                );
              }

              return (
                <div
                  key={d}
                  id={`heatmap-day-${d}`}
                  onClick={() => {
                    if (isFuture) return;
                    setEditDay(d);
                    setEditVal(String(mins || ''));
                  }}
                  title={isFuture
                    ? `Day ${d} — need ~${requiredPerDay}m`
                    : isToday
                    ? `Today: ${Math.round(mins)}m banked so far`
                    : `Day ${d}: ${mins}m (${Math.round(ratio * 100)}% of ${requiredPerDay}m target)`}
                  style={{
                    borderRadius: '6px',
                    background: pebbleColor(mins, isToday, isFuture),
                    border: pebbleBorder(mins, isToday, isFuture),
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '0.2rem 0',
                    cursor: isFuture ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    minHeight: '38px',
                    animation: isToday ? 'heatPulse 2s infinite' : 'none',
                  }}
                >
                  <span style={{ fontSize: '0.55rem', color: isToday ? '#93c5fd' : '#64748b', fontWeight: isToday ? 800 : 400 }}>{d}</span>
                  {isFuture ? (
                    <span style={{ fontSize: '0.5rem', color: '#334155' }}>{requiredPerDay}m</span>
                  ) : (
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700,
                      color: mins === 0 ? '#475569'
                        : ratio >= 1 ? '#10b981'
                        : ratio >= 0.6 ? '#f59e0b'
                        : '#ef4444'
                    }}>
                      {mins > 0 ? `${Math.round(mins)}m` : isToday ? '—' : '0'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', fontSize: '0.55rem', color: '#475569' }}>
          <span>🟢 On target</span>
          <span>🟡 60–99%</span>
          <span>🔴 &lt;60% / zero</span>
          <span style={{ opacity: 0.5 }}>⬜ Future</span>
          <span style={{ color: '#93c5fd' }}>🔵 Today</span>
        </div>
      </div>
    </div>
  );
};
