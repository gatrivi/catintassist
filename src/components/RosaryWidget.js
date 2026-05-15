import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';

const STORAGE_KEY = 'catint_rosary_v1';
const REMINDER_INTERVAL_MS = 10 * 60 * 1000;
const REMINDER_THRESHOLD_MIN = 60;

const ROSARY_COUNT = 2;
const DECADES_PER_ROSARY = 5;
const HAILMARYS_PER_DECADE = 10;
const DECADE_LABELS = ['I', 'II', 'III', 'IV', 'V'];

function getTodayStr() {
  return new Date().toLocaleDateString('en-CA');
}

function makeFreshState() {
  const state = { date: getTodayStr(), lastPrayerTime: null };
  for (let r = 1; r <= ROSARY_COUNT; r++) {
    for (let d = 1; d <= DECADES_PER_ROSARY; d++) {
      state[`r${r}d${d}`] = Array(HAILMARYS_PER_DECADE).fill(false);
    }
  }
  return state;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === getTodayStr()) return parsed;
    }
  } catch { /* ignore */ }
  return makeFreshState();
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, date: getTodayStr() }));
}

export const RosaryWidget = () => {
  const { isActive } = useSession();
  const { playWarningPing } = useProgressiveAudio();
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(loadState);
  const [toast, setToast] = useState(null);

  useEffect(() => { saveState(data); }, [data]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (data.date !== getTodayStr()) setData(makeFreshState());
    }, 30000);
    return () => clearInterval(iv);
  }, [data.date]);

  const toggleBox = useCallback((key, idx) => {
    setData(prev => {
      const next = { ...prev, [key]: prev[key].map((v, i) => (i === idx ? !v : v)) };
      if (!prev[key][idx]) next.lastPrayerTime = Date.now();
      return next;
    });
  }, []);

  const resetDay = useCallback(() => setData(makeFreshState()), []);

  const completedCount = useMemo(() => {
    let sum = 0;
    for (let r = 1; r <= ROSARY_COUNT; r++) {
      for (let d = 1; d <= DECADES_PER_ROSARY; d++) {
        sum += data[`r${r}d${d}`].filter(Boolean).length;
      }
    }
    return sum;
  }, [data]);

  const totalBoxes = ROSARY_COUNT * DECADES_PER_ROSARY * HAILMARYS_PER_DECADE;
  const allDone = completedCount === totalBoxes;

  const minsSinceLastPrayer = useMemo(() => {
    if (!data.lastPrayerTime) return 9999;
    return Math.floor((Date.now() - data.lastPrayerTime) / 60000);
  }, [data.lastPrayerTime]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (isActive) return;
      if (allDone) return;
      if (minsSinceLastPrayer >= REMINDER_THRESHOLD_MIN) {
        playWarningPing();
        setToast('📿 Rosary time');
        const t = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(t);
      }
    }, REMINDER_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [isActive, allDone, minsSinceLastPrayer, playWarningPing]);

  const shouldNudge = !allDone && minsSinceLastPrayer >= REMINDER_THRESHOLD_MIN;

  const pillBottom = '52px';

  return (
    <>
      {/* Collapsed Pill */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title="Rosary Tracker"
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
            ? 'rgba(139, 92, 246, 0.25)'
            : 'rgba(7, 14, 35, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: shouldNudge ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
          fontSize: '0.6rem',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1px',
          boxShadow: shouldNudge
            ? '0 0 12px rgba(139, 92, 246, 0.3)'
            : '0 2px 8px rgba(0,0,0,0.3)',
          animation: shouldNudge ? 'pulseGlow 2s infinite' : 'none',
          transition: 'all 0.3s ease',
          padding: 0,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>📿</span>
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
            width: '210px',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            fontSize: '0.65rem',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.7rem' }}>📿 Rosary</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 4px' }}
            >
              ✕
            </button>
          </div>

          {[1, 2].map(r => (
            <div key={r} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', fontWeight: 600 }}>Rosary {r}</span>
              {DECADE_LABELS.map((label, dIdx) => {
                const key = `r${r}d${dIdx + 1}`;
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: '14px', fontSize: '0.6rem' }}>{label}</span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {data[key].map((checked, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleBox(key, idx)}
                          className="rep-box"
                          style={{
                            width: '12px',
                            height: '12px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '2px',
                            background: checked ? 'rgba(139, 92, 246, 0.35)' : 'rgba(255,255,255,0.04)',
                            color: checked ? '#c4b5fd' : 'transparent',
                            fontSize: '0.5rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            transition: 'all 0.15s ease',
                            lineHeight: 1,
                          }}
                          title={`Rosary ${r}, Decade ${label}, Hail Mary ${idx + 1}`}
                        >
                          {checked ? '×' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--panel-border)', marginTop: '0.15rem', paddingTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
              {completedCount}/{totalBoxes}
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
            background: 'rgba(139, 92, 246, 0.2)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '6px',
            padding: '6px 12px',
            color: '#c4b5fd',
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
