import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { useClickOutside } from '../hooks/useClickOutside';
import { getNudgePresentation, recordNudgeShown, acknowledgeNudge } from '../utils/wellbeingNudges';

const STORAGE_KEY = 'catint_meals_v1';
const REMINDER_INTERVAL_MS = 10 * 60 * 1000;
const REMINDER_THRESHOLD_MIN = 3 * 60; // 3 hours

const MEALS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snack', label: 'Snack' },
  { key: 'dinner', label: 'Dinner' },
];
const WATER_GLASSES = 8;

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
  return {
    date: getTodayStr(),
    breakfast: false,
    lunch: false,
    snack: false,
    dinner: false,
    water: Array(WATER_GLASSES).fill(false),
    lastMealTime: null,
  };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, date: getTodayStr() }));
}

export const MealTrackerWidget = () => {
  const { isActive } = useSession();
  const { playWarningPing } = useProgressiveAudio();
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(loadState);
  const [toast, setToast] = useState(null);

  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setIsOpen(false));

  useEffect(() => { saveState(data); }, [data]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (data.date !== getTodayStr()) setData(loadState());
    }, 30000);
    return () => clearInterval(iv);
  }, [data.date]);

  const toggleMeal = useCallback((key) => {
    setData(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!prev[key]) next.lastMealTime = Date.now();
      return next;
    });
  }, []);

  const toggleWater = useCallback((idx) => {
    setData(prev => {
      const nextWater = prev.water.map((v, i) => (i === idx ? !v : v));
      const next = { ...prev, water: nextWater };
      if (!prev.water[idx]) next.lastMealTime = Date.now();
      return next;
    });
  }, []);

  const resetDay = useCallback(() => setData(loadState()), []);

  const completedMeals = useMemo(() => MEALS.reduce((sum, m) => sum + (data[m.key] ? 1 : 0), 0), [data]);
  const completedWater = useMemo(() => data.water.filter(Boolean).length, [data]);
  const allDone = completedMeals === MEALS.length && completedWater === WATER_GLASSES;

  const minsSinceLastMeal = useMemo(() => {
    if (!data.lastMealTime) return 9999;
    return Math.floor((Date.now() - data.lastMealTime) / 60000);
  }, [data.lastMealTime]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (isActive) return;
      if (allDone) return;
      if (minsSinceLastMeal >= REMINDER_THRESHOLD_MIN) {
        const pres = getNudgePresentation('meals', '🍽️ Hydrate / eat something');
        recordNudgeShown('meals');
        playWarningPing();
        setToast(pres.message);
        if (!pres.persistent) setTimeout(() => setToast(null), pres.durationMs);
      }
    }, REMINDER_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [isActive, allDone, minsSinceLastMeal, playWarningPing]);

  const shouldNudge = !allDone && minsSinceLastMeal >= REMINDER_THRESHOLD_MIN;
  const pillBottom = '98px';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Collapsed Pill */}
      <button
        onClick={() => { acknowledgeNudge('meals'); setIsOpen((o) => !o); }}
        title="Wellbeing: meals & hydration"
        style={{
          position: 'relative',
          width: '40px',
          height: '40px',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: shouldNudge
            ? 'rgba(16, 185, 129, 0.25)'
            : 'rgba(7, 14, 35, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: shouldNudge ? '#34d399' : 'rgba(255,255,255,0.6)',
          fontSize: '0.6rem',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1px',
          boxShadow: shouldNudge
            ? '0 0 12px rgba(16, 185, 129, 0.3)'
            : '0 2px 8px rgba(0,0,0,0.3)',
          animation: shouldNudge ? 'pulseGlow 2s infinite' : 'none',
          transition: 'all 0.3s ease',
          padding: 0,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>🍽️</span>
        <span>{allDone ? '✓' : `${completedMeals}`}</span>
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
            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.75rem' }}>🍽️ Meals</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 4px' }}
            >
              ✕
            </button>
          </div>

          {MEALS.map(m => (
            <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
              <span style={{ color: 'var(--text-muted)', minWidth: '60px' }}>{m.label}</span>
              <button
                onClick={() => toggleMeal(m.key)}
                className="rep-box"
                style={{
                  width: '20px',
                  height: '20px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '3px',
                  background: data[m.key] ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.04)',
                  color: data[m.key] ? '#34d399' : 'rgba(255,255,255,0.3)',
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
                {data[m.key] ? 'X' : ''}
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
            <span style={{ color: 'var(--text-muted)', minWidth: '60px' }}>Water</span>
            <div style={{ display: 'flex', gap: '3px' }}>
              {data.water.map((checked, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleWater(idx)}
                  className="rep-box"
                  style={{
                    width: '14px',
                    height: '20px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '2px',
                    background: checked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.04)',
                    color: checked ? '#f87171' : 'transparent',
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
                  title={`Glass ${idx + 1}`}
                >
                  {checked ? '×' : ''}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--panel-border)', marginTop: '0.2rem', paddingTop: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
              {data.lastMealTime ? `${Math.floor(minsSinceLastMeal / 60)}h ago` : 'No meals today'}
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
            bottom: pillBottom,
            left: '52px',
            zIndex: 10000,
            background: 'rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '6px',
            padding: '6px 12px',
            color: '#34d399',
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
