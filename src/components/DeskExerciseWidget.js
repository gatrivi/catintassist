import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { useClickOutside } from '../hooks/useClickOutside';
import { getNudgePresentation, recordNudgeShown, acknowledgeNudge } from '../utils/wellbeingNudges';

const STORAGE_KEY = 'catint_exercises_v1';
const REMINDER_INTERVAL_MS = 10 * 60 * 1000; // 10 min check
const REMINDER_THRESHOLD_MIN = 45; // remind after 45m of no reps

const EXERCISES = [
  { key: 'hands', label: 'Hands' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'legs', label: 'Legs' },
  { key: 'back', label: 'Back' },
  { key: 'chest', label: 'Chest' },
];

function getTodayStr() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === getTodayStr()) return parsed;
    }
  } catch { /* ignore */ }
  return {
    date: getTodayStr(),
    hands: [false, false, false],
    shoulders: [false, false, false],
    legs: [false, false, false],
    back: [false, false, false],
    chest: [false, false, false],
    lastSetTime: null,
  };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, date: getTodayStr() }));
}

export const DeskExerciseWidget = () => {
  const { isActive } = useSession();
  const { playWarningPing } = useProgressiveAudio();
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(loadState);
  const [toast, setToast] = useState(null);
  
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setIsOpen(false));

  // Persist on change + midnight guard
  useEffect(() => {
    saveState(data);
  }, [data]);

  // Midnight reset guard
  useEffect(() => {
    const iv = setInterval(() => {
      if (data.date !== getTodayStr()) {
        setData(loadState());
      }
    }, 30000);
    return () => clearInterval(iv);
  }, [data.date]);

  const toggleBox = useCallback((exKey, idx) => {
    setData(prev => {
      const next = { ...prev, [exKey]: prev[exKey].map((v, i) => (i === idx ? !v : v)) };
      // Update lastSetTime if we just checked a box (not unchecked)
      if (!prev[exKey][idx]) {
        next.lastSetTime = Date.now();
      }
      return next;
    });
  }, []);

  const resetDay = useCallback(() => {
    setData(loadState());
  }, []);

  const completedCount = useMemo(() => {
    return EXERCISES.reduce((sum, ex) => sum + data[ex.key].filter(Boolean).length, 0);
  }, [data]);

  const totalBoxes = EXERCISES.length * 3;
  const allDone = completedCount === totalBoxes;

  const minsSinceLastSet = useMemo(() => {
    if (!data.lastSetTime) return 9999;
    return Math.floor((Date.now() - data.lastSetTime) / 60000);
  }, [data.lastSetTime]);

  // Periodic reminder
  useEffect(() => {
    const iv = setInterval(() => {
      if (isActive) return; // don't nag during calls
      if (allDone) return;
      if (minsSinceLastSet >= REMINDER_THRESHOLD_MIN) {
        const pres = getNudgePresentation('desk', '🧘 Desk stretch break');
        recordNudgeShown('desk');
        playWarningPing();
        setToast(pres.message);
        if (!pres.persistent) {
          setTimeout(() => setToast(null), pres.durationMs);
        }
      }
    }, REMINDER_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [isActive, allDone, minsSinceLastSet, playWarningPing]);

  const shouldNudge = !allDone && minsSinceLastSet >= REMINDER_THRESHOLD_MIN;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Collapsed Pill */}
      <button
        data-guide="wellbeing-dock-desk"
        data-tooltip="Desk stretches"
        aria-label="Desk stretches"
        className="habit-dock-pill"
        onClick={() => {
          acknowledgeNudge('desk');
          setIsOpen((o) => !o);
        }}
        style={{
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.1)',
          background: shouldNudge
            ? 'rgba(245, 158, 11, 0.25)'
            : 'rgba(7, 14, 35, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: shouldNudge ? '#fbbf24' : 'rgba(255,255,255,0.6)',
          fontSize: '0.65rem',
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
        <span style={{ fontSize: '0.85rem' }}>🏋️</span>
        <span>{completedCount}/{totalBoxes}</span>
      </button>

      {/* Expanded Panel */}
      {isOpen && (
        <div
          className="glass-panel tracker-expanded-panel"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
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
            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.75rem' }}>Desk Fit</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                padding: '2px 4px',
              }}
            >
              ✕
            </button>
          </div>

          {EXERCISES.map(ex => (
            <div key={ex.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
              <span style={{ color: 'var(--text-muted)', minWidth: '60px' }}>{ex.label}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {data[ex.key].map((checked, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleBox(ex.key, idx)}
                    className="rep-box"
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '3px',
                      background: checked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.04)',
                      color: checked ? '#34d399' : 'rgba(255,255,255,0.3)',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      transition: 'all 0.15s ease',
                    }}
                    title={`${ex.label} set ${idx + 1}`}
                  >
                    {checked ? 'X' : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--panel-border)', marginTop: '0.2rem', paddingTop: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
              {data.lastSetTime ? `${minsSinceLastSet}m ago` : 'No sets today'}
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
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
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
    </div>
  );
};
