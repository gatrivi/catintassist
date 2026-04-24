import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';

export const DialGoalSelector = ({ ratePerMinute, arsRate, setArsRate, initialGoalMinutes, onSave, onCancel }) => {
  const audioEngine = useProgressiveAudio();
  
  // The user prioritizes "Weekly Hours" commitment.
  // We'll make the dial scroll through 20h - 100h per week.
  const targets = useMemo(() => {
    return Array.from({ length: 17 }, (_, i) => 20 + (i * 5)); // 20, 25, 30... 100
  }, []);

  const [workDays, setWorkDays] = useState(22); // Default to 5d/wk (22d/mo)
  const daysPerWeek = workDays === 30 ? 7 : workDays === 26 ? 6 : workDays === 22 ? 5 : 4;

  const [activeIndex, setActiveIndex] = useState(() => {
    if (initialGoalMinutes && initialGoalMinutes > 0) {
      // Find which weekly hours matches initialGoalMinutes best
      // monthlyMins = (weeklyHours * 60 / daysPerWeek) * workDays
      // weeklyHours = (monthlyMins * daysPerWeek) / (60 * workDays)
      const currentWeeklyHours = (initialGoalMinutes * daysPerWeek) / (60 * workDays);
      let bestIdx = 0;
      let minDiff = Infinity;
      targets.forEach((hrs, i) => {
        if (Math.abs(hrs - currentWeeklyHours) < minDiff) {
          minDiff = Math.abs(hrs - currentWeeklyHours);
          bestIdx = i;
        }
      });
      return bestIdx;
    }
    return 4; // Default 40h
  });

  const scrollRef = useRef(null);
  const itemHeight = 44; 
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    if (scrollRef.current && !isUserScrolling.current) {
      scrollRef.current.scrollTop = activeIndex * itemHeight;
    }
  }, [activeIndex, itemHeight]);

  const handleScroll = (e) => {
    if (!isUserScrolling.current) return;
    const top = e.target.scrollTop;
    const index = Math.min(targets.length - 1, Math.max(0, Math.round(top / itemHeight)));
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const selectedWeeklyHours = targets[activeIndex];
  const weeklyMins = selectedWeeklyHours * 60;
  
  // INVARIANT: Changing workDays (days subset) scales daily mins but preserves the weekly commitment.
  const dailyMins = Math.round(weeklyMins / daysPerWeek);
  const monthlyMins = Math.round(dailyMins * workDays);
  
  const dailyHours = Math.floor(dailyMins / 60);
  const dailyMinsRem = dailyMins % 60;
  const monthlyCash = monthlyMins * ratePerMinute * arsRate;

  const ladderStep = Math.min(12, Math.max(1, Math.floor(monthlyMins / 1375) + (monthlyMins % 1375 > 1300 ? 1 : 0) || 1));
  const ladderTier = monthlyMins >= 16500 ? 'LEGEND' : monthlyMins >= 11000 ? 'GROWTH' : monthlyMins >= 5500 ? 'FLOOR' : 'TRAINING';
  const ladderColor = ladderTier === 'LEGEND' ? '#FCD34D' : ladderTier === 'GROWTH' ? '#A855F7' : ladderTier === 'FLOOR' ? '#3B82F6' : '#94A3B8';

  const handleApply = () => {
    audioEngine.playCarriageVault();
    onSave(monthlyMins);
  };

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 5px)', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(139, 92, 246, 0.4)',
      borderRadius: '12px', padding: '1rem', width: '95vw', maxWidth: '520px', zIndex: 9999,
      backdropFilter: 'blur(24px)', boxShadow: '0 12px 50px rgba(0,0,0,0.8)',
      display: 'flex', flexDirection: 'column', gap: '0.8rem'
    }}>
      <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Goal Configurator</h4>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#94a3b8', textTransform: 'uppercase', padding: '0 0.5rem', marginBottom: '-0.2rem', zIndex: 10, fontWeight: 700 }}>
        <span style={{flex:1, textAlign:'center'}}>Commitment</span>
        <span style={{flex:1, textAlign:'center'}}>Daily Time</span>
        <span style={{flex:1, textAlign:'center'}}>Daily ARS</span>
        <span style={{flex:1, textAlign:'center'}}>Monthly Goal</span>
      </div>
      
      <div style={{ position: 'relative', height: `${itemHeight * 3}px`, overflow: 'hidden', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{
          position: 'absolute', top: `${itemHeight}px`, left: 0, right: 0, height: `${itemHeight}px`,
          background: 'rgba(139, 92, 246, 0.2)', borderTop: '1px solid rgba(139, 92, 246, 0.4)', borderBottom: '1px solid rgba(139, 92, 246, 0.4)',
          pointerEvents: 'none', zIndex: 10
        }} />
        
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          onWheel={() => {
            isUserScrolling.current = true;
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
            scrollTimeout.current = setTimeout(() => { isUserScrolling.current = false; }, 500);
          }}
          onMouseDown={(e) => {
            isUserScrolling.current = true;
            const el = scrollRef.current;
            el.dataset.isDragging = true;
            el.dataset.startY = e.pageY - el.offsetTop;
            el.dataset.scrollTop = el.scrollTop;
            el.style.scrollBehavior = 'auto'; 
            el.style.scrollSnapType = 'none';
          }}
          onMouseLeave={() => { 
             const el = scrollRef.current; 
             if (el) { el.dataset.isDragging = false; el.style.scrollBehavior = 'smooth'; el.style.scrollSnapType = 'y mandatory'; }
             setTimeout(() => { if (isUserScrolling.current) isUserScrolling.current = false; }, 500);
          }}
          onMouseUp={() => { 
             const el = scrollRef.current; 
             if (el) { el.dataset.isDragging = false; el.style.scrollBehavior = 'smooth'; el.style.scrollSnapType = 'y mandatory'; }
             setTimeout(() => { if (isUserScrolling.current) isUserScrolling.current = false; }, 500);
          }}
          onMouseMove={(e) => {
            const el = scrollRef.current;
            if (el.dataset.isDragging !== 'true') return;
            e.preventDefault();
            const y = e.pageY - el.offsetTop;
            const walk = (y - parseFloat(el.dataset.startY)) * 1.5;
            el.scrollTop = parseFloat(el.dataset.scrollTop) - walk;
          }}
          style={{ 
            height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth', userSelect: 'none',
            paddingTop: `${itemHeight}px`, paddingBottom: `${itemHeight}px`,
            scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-y'
          }}
        >
          {targets.map((hrs, idx) => {
            const distance = Math.abs(idx - activeIndex);
            const scale = distance === 0 ? 1 : distance === 1 ? 0.9 : 0.8;
            const opacity = distance === 0 ? 1 : distance === 1 ? 0.6 : 0.3;
            
            const rWeeklyMins = hrs * 60;
            const rDailyMins = Math.round(rWeeklyMins / daysPerWeek);
            const rMonthMins = Math.round(rDailyMins * workDays);
            const rDailyCash = rDailyMins * ratePerMinute * arsRate;
            const rMonthCash = rMonthMins * ratePerMinute * arsRate;
            
            const isFloor = rMonthMins >= 5500 && rMonthMins < 5600; // Close enough to 5500
            const isGrowth = rMonthMins >= 11000 && rMonthMins < 11100;
            const isLegend = rMonthMins >= 16500 && rMonthMins < 16600;

            return (
              <div key={hrs} onClick={() => { setActiveIndex(idx); scrollRef.current.scrollTop = idx * itemHeight; }} style={{
                height: `${itemHeight}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                scrollSnapAlign: 'center', fontSize: '0.8rem', fontWeight: distance === 0 ? 800 : 500,
                color: distance === 0 ? '#a855f7' : 'var(--text-muted)', cursor: 'pointer',
                transform: `scale(${scale})`, opacity, transition: 'all 0.15s ease-out', width: '100%', padding: '0 0.2rem', boxSizing: 'border-box',
                position: 'relative'
              }}>
                <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <span style={{ fontSize: distance === 0 ? '1rem' : '0.8rem' }}>{hrs}h/Wk</span>
                   {distance === 0 && <span style={{ fontSize: '0.5rem', opacity: 0.8, color: ladderColor }}>{ladderTier}</span>}
                </div>
                <span style={{flex:1, textAlign:'center'}}>{Math.floor(rDailyMins/60)}h {rDailyMins%60}m</span>
                <span style={{flex:1, textAlign:'center'}}>${Math.round(rDailyCash).toLocaleString('es-AR')}</span>
                <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                   <span style={{ color: distance === 0 ? '#34d399' : '' }}>${Math.round(rMonthCash).toLocaleString('es-AR')}</span>
                   {(isFloor || isGrowth || isLegend) && (
                     <div style={{ 
                       position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)',
                       fontSize: '0.5rem', padding: '1px 3px', borderRadius: '3px',
                       background: isLegend ? '#FCD34D' : (isGrowth ? '#A855F7' : '#3B82F6'),
                       color: '#000', fontWeight: 900, boxShadow: '0 0 5px rgba(255,255,255,0.2)'
                     }}>
                       {isLegend ? 'LEGEND' : (isGrowth ? 'GROWTH' : 'FLOOR')}
                     </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Work Days Toggle - Preserves the Commitment selected above */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '0.2rem' }}>frequency: active days (Monthly Target stays locked)</div>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          {[
            { label: '4/Wk', sub: '17d', val: 17 },
            { label: '5/Wk', sub: '22d', val: 22 },
            { label: '6/Wk', sub: '26d', val: 26 },
            { label: 'Grind', sub: '30d', val: 30 }
          ].map(opt => (
            <button
              key={opt.val}
              onClick={() => setWorkDays(opt.val)}
              style={{
                flex: 1, padding: '0.4rem 0', borderRadius: '6px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem',
                background: workDays === opt.val ? 'rgba(56,189,248,0.2)' : 'rgba(0,0,0,0.3)',
                color: workDays === opt.val ? '#7dd3fc' : 'var(--text-muted)',
                border: workDays === opt.val ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s', transform: workDays === opt.val ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: workDays === opt.val ? 800 : 600 }}>{opt.label}</span>
              <span style={{ fontSize: '0.55rem', opacity: workDays === opt.val ? 0.9 : 0.6 }}>{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ 
        padding: '0.6rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.75rem',
        background: ladderTier === 'TRAINING' ? 'rgba(148,163,184,0.1)' : ladderTier === 'FLOOR' ? 'rgba(56,189,248,0.1)' : ladderTier === 'GROWTH' ? 'rgba(168,85,247,0.1)' : 'rgba(252,211,77,0.1)',
        border: `1px solid ${ladderColor}44`
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.2rem', color: ladderColor }}>
          {ladderTier === 'TRAINING' ? '🐾 Training Mode' : ladderTier === 'FLOOR' ? '🪜 Step Achiever (Floor)' : ladderTier === 'GROWTH' ? '🚀 Pacing Growth' : '👑 Legendary Hustle'}
          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', opacity: 0.8, color: '#fff' }}>[The Pro Ladder: Step {ladderStep}/12]</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)' }}>
          At {selectedWeeklyHours}h/Wk commitment, you'll reach <strong style={{color: ladderColor}}>AR${Math.round(monthlyCash).toLocaleString('es-AR')}</strong> per month.
          <br/>Expect to grind <strong style={{color: '#fff'}}>{dailyHours}h {dailyMinsRem}m</strong> per active day.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>💱 ARS Rate</span>
        <input 
          type="number" step="any" className="stat-input"
          style={{ width: '80px', padding: '0.3rem', fontSize: '0.8rem' }}
          value={arsRate}
          onChange={(e) => setArsRate(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn" onClick={onCancel} style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', border: 'none' }}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleApply} style={{ flex: 2, padding: '0.5rem', fontSize: '0.85rem' }}>
          Bank Goal: {Math.round(monthlyMins)}m/Mo
        </button>
      </div>
    </div>
  );
};

