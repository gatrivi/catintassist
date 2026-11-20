import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSession } from '../contexts/SessionContext';
import { computeCatchUp } from '../utils/catchUpPlan';
import './IdleMonthCalendar.css';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BLOCK_MINUTES = 50; // Each emoji represents 50 min (~1 hour of work)

export const IdleMonthCalendar = ({ onSwitchToRace = null }) => {
  const { stats = {}, dailyLog = {}, goalWorkDays = 0, commitDayToLog, editPastDay } = useSession() || {};

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMo = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleString('en-US', { month: 'long' });

  // Plan & required pace calculation
  const plan = useMemo(() => {
    try {
      return computeCatchUp({
        goalMinutes: Number(stats?.goalMinutes) || 5500,
        monthlyMinutes: Number(stats?.monthlyMinutes) || 0,
        dailyMinutes: Number(stats?.dailyMinutes) || 0,
        workDays: goalWorkDays || 0,
        goalSetAt: stats?.goalSetAt || null,
        goalBaseMinutes: stats?.goalBaseMinutes || 0,
      });
    } catch {
      return { remainingWorkdays: 10, deficitMins: 0 };
    }
  }, [stats?.goalMinutes, stats?.monthlyMinutes, stats?.dailyMinutes, stats?.goalSetAt, stats?.goalBaseMinutes, goalWorkDays]);

  const remainingWorkdays = plan.remainingWorkdays || 10;
  const goalMins = Number(stats?.goalMinutes) || 5500;
  const monthMins = Number(stats?.monthlyMinutes) || 0;
  const remainingMins = Math.max(0, goalMins - monthMins);
  const requiredPerDay = remainingWorkdays > 0 ? Math.ceil(remainingMins / remainingWorkdays) : 300;
  const targetBlocks = Math.max(1, Math.ceil(requiredPerDay / BLOCK_MINUTES));

  // Calendar day offset (Mon-first)
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = (firstDow + 6) % 7;

  // Inline editing state for past days
  const [editDay, setEditDay] = useState(null);
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editDay && inputRef.current) inputRef.current.focus();
  }, [editDay]);

  const getDayMins = (d) => {
    const key = new Date(year, month, d).toDateString();
    if (d === today) return Number(stats?.dailyMinutes) || 0;
    return Number(dailyLog?.[key]) || 0;
  };

  const commitEdit = () => {
    if (editDay === null) return;
    const mins = parseFloat(editVal);
    if (!isNaN(mins) && mins >= 0) {
      const key = new Date(year, month, editDay).toDateString();
      const todayStr = new Date().toDateString();
      if (key === todayStr) {
        commitDayToLog?.(key, mins);
      } else {
        editPastDay?.(key, mins);
      }
    }
    setEditDay(null);
    setEditVal('');
  };

  const todayMins = Number(stats?.dailyMinutes) || 0;
  const todayDoneBlocks = Math.floor(todayMins / BLOCK_MINUTES);

  return (
    <div className="idle-calendar" aria-label={`Month work calendar for ${monthName} ${year}`}>
      {/* Header with Title & Legend Toggle */}
      <div className="idle-calendar__header">
        <div>
          <div className="idle-calendar__title">
            <span>📅 {monthName} {year}</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
              🎯 {requiredPerDay}m/day ({targetBlocks} blocks)
            </span>
          </div>
          <div className="idle-calendar__sub">
            Each 🐱 = 50 min (~1h) · Solid = worked · Faded = remaining
          </div>
        </div>

        {onSwitchToRace && (
          <div className="idle-calendar__tabs">
            <button
              type="button"
              className="idle-calendar__tab-btn is-active"
              title="Show Month Calendar with 50m emoji progress"
            >
              📅 Calendar
            </button>
            <button
              type="button"
              className="idle-calendar__tab-btn"
              onClick={onSwitchToRace}
              title="Show Pace Race Track"
            >
              🏎️ Race Track
            </button>
          </div>
        )}
      </div>

      {/* Days of week */}
      <div className="idle-calendar__dows">
        {DOW.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="idle-calendar__grid">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`empty-${i}`} className="idle-calendar__cell idle-calendar__cell--empty" style={{ opacity: 0, pointerEvents: 'none' }} />
        ))}

        {Array.from({ length: daysInMo }).map((_, idx) => {
          const d = idx + 1;
          const isToday = d === today;
          const isFuture = d > today;
          const dateObj = new Date(year, month, d);
          const dayOfWeek = dateObj.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          const mins = isFuture ? 0 : getDayMins(d);
          const completedBlocks = Math.floor(mins / BLOCK_MINUTES);
          const dayTargetBlocks = isFuture ? targetBlocks : (targetBlocks || 6);
          const totalBlocksToDisplay = Math.max(dayTargetBlocks, completedBlocks);

          if (editDay === d) {
            return (
              <div key={d} className="idle-calendar__cell idle-calendar__cell--editing" style={{ background: 'rgba(59,130,246,0.2)', borderColor: '#3b82f6' }}>
                <span className="idle-calendar__day-num" style={{ color: '#60a5fa' }}>{d}</span>
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  max="720"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') { e.stopPropagation(); setEditDay(null); setEditVal(''); }
                  }}
                  onBlur={commitEdit}
                  style={{ width: '90%', fontSize: '0.75rem', textAlign: 'center', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '4px', color: '#fff', outline: 'none', fontWeight: 800, padding: '2px' }}
                />
                <span style={{ fontSize: '0.5rem', color: '#94a3b8' }}>mins</span>
              </div>
            );
          }

          return (
            <div
              key={d}
              className={`idle-calendar__cell${isToday ? ' idle-calendar__cell--today' : ''}${isFuture ? ' idle-calendar__cell--future' : ''}${isWeekend ? ' idle-calendar__cell--weekend' : ''}`}
              onClick={() => {
                if (isFuture) return;
                setEditDay(d);
                setEditVal(String(mins || ''));
              }}
              title={isFuture
                ? `Day ${d} — Target: ${requiredPerDay}m (${targetBlocks} blocks)`
                : isToday
                ? `Today: ${Math.round(mins)}m banked (${completedBlocks}/${targetBlocks} blocks) · Click to edit`
                : `Day ${d}: ${mins}m worked (${completedBlocks} blocks) · Click to edit`}
            >
              {/* Day Number and Minute total */}
              <div className="idle-calendar__day-top">
                <span className="idle-calendar__day-num">{isToday ? `★ ${d}` : d}</span>
                <span className="idle-calendar__day-mins">
                  {isFuture ? `${requiredPerDay}m` : mins > 0 ? `${Math.round(mins)}m` : isWeekend ? '0m' : '0m'}
                </span>
              </div>

              {/* Emoji Work Blocks */}
              <div className="idle-calendar__emojis">
                {isWeekend && mins === 0 && !isToday ? (
                  <span className="idle-emoji idle-emoji--rest" title="Rest day">☕</span>
                ) : (
                  Array.from({ length: totalBlocksToDisplay }).map((_, bIdx) => {
                    const isDone = bIdx < completedBlocks;
                    return (
                      <span
                        key={bIdx}
                        className={`idle-emoji ${isDone ? 'idle-emoji--done' : 'idle-emoji--todo'}`}
                        title={isDone ? `Block ${bIdx + 1}: 50m worked` : `Block ${bIdx + 1}: 50m remaining`}
                      >
                        🐱
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend & Daily Progress summary */}
      <div className="idle-calendar__legend">
        <div className="idle-calendar__legend-items">
          <div className="idle-calendar__legend-item">
            <span className="idle-emoji idle-emoji--done" style={{ fontSize: '0.8rem' }}>🐱</span>
            <span>Solid = 50m done</span>
          </div>
          <div className="idle-calendar__legend-item">
            <span className="idle-emoji idle-emoji--todo" style={{ fontSize: '0.8rem' }}>🐱</span>
            <span>Faded = 50m to do</span>
          </div>
          <div className="idle-calendar__legend-item">
            <span className="idle-emoji idle-emoji--rest" style={{ fontSize: '0.8rem' }}>☕</span>
            <span>Rest day</span>
          </div>
        </div>

        <div style={{ color: '#38bdf8', fontWeight: 700 }}>
          Today: {todayMins}m ({todayDoneBlocks}/{targetBlocks} blocks) · {Math.max(0, requiredPerDay - todayMins)}m left
        </div>
      </div>
    </div>
  );
};

export default IdleMonthCalendar;
