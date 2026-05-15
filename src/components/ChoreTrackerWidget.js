import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';

const STORAGE_KEY = 'catint_chores_v1';
const REMINDER_INTERVAL_MS = 10 * 60 * 1000;
const REMINDER_THRESHOLD_MIN = 4 * 60; // 4 hours

const CHORES = [
  { key: 'groceries', label: 'Groceries' },
  { key: 'laundry', label: 'Wash Clothes' },
  { key: 'dishes', label: 'Dishes' },
  { key: 'trash', label: 'Trash' },
  { key: 'tidy', label: 'Tidy Up' },
];

function getTodayStr() {
  return new Date().toLocaleDateString('en-CA');
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === getTodayStr()) return parsed;
    }
  } catch { /* ignore */ }
  const fresh = { date: getTodayStr(), lastChoreTime: null };
  CHORES.forEach(c => { fresh[c.key] = false; });
  return fresh;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, date: getTodayStr() }));
}

export const ChoreTrackerWidget = () => {
  const { isActive } = useSession();
  const { playWarningPing } = useProgressiveAudio();
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(loadState);
  const [toast, setToast] = useState(null);

  useEffect(() => { saveState(data); }, [data]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (data.date !== getTodayStr()) setData(loadState());
    }, 30000);
    return () => clearInterval(iv);
  }, [data.date]);

  const toggleChore = useCallback((key) => {
    setData(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!prev[key]) next.lastChoreTime = Date.now();
      return next;
    });
  }, []);

  const resetDay = useCallback(() => setData(loadState()), []);

  const completedCount = useMemo(() => CHORES.reduce((sum, c) => sum + (data[c.key] ? 1 : 0), 0), [data]);
  const totalChores = CHORES.length;
  const allDone = completedCount === totalChores;

  const minsSinceLastChore = useMemo(() => {
    if (!data.lastChoreTime) return 9999;
    return Math.floor((Date.now() - data.lastChoreTime) / 60000);
  }, [data.lastChoreTime]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (isActive) return;
      if (allDone) return;
      if (minsSinceLastChore >= REMINDER_THRESHOLD_MIN) {
        playWarningPing();
        setToast('🧹 Chore check');
        const t = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(t);
      }
    }, REMINDER_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [isActive, allDone, minsSinceLastChore, playWarningPing]);

  const shouldNudge = !allDone && minsSinceLastChore >= REMINDER_THRESHOLD_MIN;
  const pillBottom = '144px';

  return (
    <>
      {/* Collapsed Pill */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title="Chore Tracker"
        style={{
          position: 'fixed',
          bottom: pillBottom,
          left: '6px',
          zIndex: 9999,
          width: '40px',
          height: '40px',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: shouldNudge
            ? 'rgba(245, 158, 11, 0.25)'
            : 'rgba(7, 14, 35, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: shouldNudge ? '#fbbf24' : 'rgba(255,255,255,0.6)',
          fontSize: '0.6rem',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1px',
          boxShadow: shouldNudge
            ? '0 0 12px rgba(245, 158, 11, 0.3)'
            : '0 2px 8px rgba(0,0,0,0.3)',
          animation: shouldNudge ? 'pulseGlow 2s infinite' : 'none',
          transition: 'all 0.3s ease',
          padding: 0,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>🧹</span>
        <span>{allDone ? '✓' : `${completedCount}`}</span>
      </button>

      {/* Expanded Panel */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'fixed',
            bottom: pillBottom,
            left: '52px',
            zIndex: 9999,
            width: '200px',
            padding: '0.6rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            fontSize: '0.7rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.75rem' }}>🧹 Chores</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 4px' }}
            >
              ✕
            </button>
          </div>

          {CHORES.map(c => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
              <span style={{ color: 'var(--text-muted)', minWidth: '80px' }}>{c.label}</span>
              <button
                onClick={() => toggleChore(c.key)}
                className="rep-box"
                style={{
                  width: '20px',
                  height: '20px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '3px',
                  background: data[c.key] ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.04)',
                  color: data[c.key] ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {data[c.key] ? 'X' : ''}
              </button>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--panel-border)', marginTop: '0.2rem', paddingTop: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
              {data.lastChoreTime ? `${Math.floor(minsSinceLastChore / 60)}h ago` : 'No chores today'}
            </span>
            <button
              onClick={resetDay}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '3px',
                color: 'var(--text-muted)',
                fontSize: '0.6rem',
                padding: '2px 6px',
                cursor: 'pointer',
              }}
            >
              Reset Day
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: pillBottom,
            left: '52px',
            zIndex: 10000,
            background: 'rgba(245, 158, 11, 0.2)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '6px',
            padding: '6px 12px',
            color: '#fbbf24',
            fontSize: '0.75rem',
            fontWeight: 700,
            animation: 'fadeSlideIn 0.3s ease-out',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
};
