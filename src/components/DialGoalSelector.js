import React, { useState, useRef, useEffect, useMemo } from 'react';

export const DialGoalSelector = ({ ratePerMinute, arsRate, setArsRate, initialCash, onSave, onCancel }) => {
  const targets = useMemo(() => {
    let arr = Array.from({ length: 30 }, (_, i) => 10000 + (i * 10000));
    if (initialCash && initialCash > 0) {
      const val = Math.round(initialCash);
      if (!arr.includes(val)) arr.push(val);
    }
    arr.sort((a, b) => a - b);
    return arr;
  }, [initialCash]);

  const [activeIndex, setActiveIndex] = useState(() => {
    if (initialCash && initialCash > 0) return targets.indexOf(Math.round(initialCash));
    return targets.indexOf(50000) !== -1 ? targets.indexOf(50000) : 6;
  }); // Default to initialCash or 50k

  const [workDays, setWorkDays] = useState(22); // 22 = 5d, 26 = 6d, 30 = 7d
  const scrollRef = useRef(null);
  const itemHeight = 44; // px
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    // Snap to the default index on mount or when externally changed
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

  const selectedCash = targets[activeIndex];
  // Cash / Rate = Minutes
  const dailyMinsRaw = selectedCash / (ratePerMinute * arsRate);
  const dailyMins = Math.round(dailyMinsRaw);
  const dailyHours = Math.floor(dailyMins / 60);
  const dailyMinsRemainder = dailyMins % 60;

  const monthlyCash = selectedCash * workDays;
  const monthlyMins = dailyMins * workDays;
  
  const daysPerWeek = workDays === 30 ? 7 : workDays === 26 ? 6 : workDays === 22 ? 5 : 4;
  const weeklyMinsRaw = dailyMins * daysPerWeek;
  const weeklyHours = Math.floor(weeklyMinsRaw / 60);
  const weeklyMinsRemainder = weeklyMinsRaw % 60;

  const handleApply = () => {
    // We send back the total monthly minutes to save as goalMinutes
    onSave(monthlyMins);
  };

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 5px)', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(139, 92, 246, 0.4)',
      borderRadius: '12px', padding: '1rem', width: '95vw', maxWidth: '500px', zIndex: 9999,
      backdropFilter: 'blur(24px)', boxShadow: '0 12px 50px rgba(0,0,0,0.8)',
      display: 'flex', flexDirection: 'column', gap: '0.8rem'
    }}>
      {/* Target Dial Container */}
      <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Goal Configurator</h4>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#94a3b8', textTransform: 'uppercase', padding: '0 0.5rem', marginBottom: '-0.2rem', zIndex: 10, fontWeight: 700 }}>
        <span style={{flex:1, textAlign:'center'}}>Day Mins</span>
        <span style={{flex:1, textAlign:'center'}}>Day Time</span>
        <span style={{flex:1, textAlign:'center'}}>Daily ARS</span>
        <span style={{flex:1, textAlign:'center'}}>Mo. Mins</span>
        <span style={{flex:1, textAlign:'center', color: '#34d399'}}>Mo. ARS</span>
      </div>
      
      <div style={{ position: 'relative', height: `${itemHeight * 3}px`, overflow: 'hidden', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Selection Highlight Overlay */}
        <div style={{
          position: 'absolute', top: `${itemHeight}px`, left: 0, right: 0, height: `${itemHeight}px`,
          background: 'rgba(139, 92, 246, 0.2)', borderTop: '1px solid rgba(139, 92, 246, 0.4)', borderBottom: '1px solid rgba(139, 92, 246, 0.4)',
          pointerEvents: 'none', zIndex: 10
        }} />
        
        {/* Scrollable list */}
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
          {targets.map((amt, idx) => {
            const distance = Math.abs(idx - activeIndex);
            const scale = distance === 0 ? 1 : distance === 1 ? 0.9 : 0.8;
            const opacity = distance === 0 ? 1 : distance === 1 ? 0.6 : 0.3;
            
            const rDailyMinsRaw = amt / (ratePerMinute * arsRate);
            const rDailyMins = Math.round(rDailyMinsRaw);
            const rDailyHours = Math.floor(rDailyMins / 60);
            const rDailyMinsRem = rDailyMins % 60;
            const rMonthMins = rDailyMins * workDays;
            const rMonthCash = amt * workDays;
            
            return (
              <div key={amt} onClick={() => { setActiveIndex(idx); scrollRef.current.scrollTop = idx * itemHeight; }} style={{
                height: `${itemHeight}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                scrollSnapAlign: 'center', fontSize: '0.8rem', fontWeight: distance === 0 ? 800 : 500,
                color: distance === 0 ? '#a855f7' : 'var(--text-muted)', cursor: 'pointer',
                transform: `scale(${scale})`, opacity, transition: 'all 0.15s ease-out', width: '100%', padding: '0 0.2rem', boxSizing: 'border-box'
              }}>
                <span style={{flex:1, textAlign:'center'}}>{rDailyMins}m</span>
                <span style={{flex:1, textAlign:'center', color: distance === 0 ? '#6ee7b7' : ''}}>{rDailyHours > 0 ? `${rDailyHours}h ` : ''}{rDailyMinsRem}m</span>
                <span style={{flex:1, textAlign:'center', fontSize: distance === 0 ? '0.95rem' : '0.8rem'}}>${amt.toLocaleString('es-AR')}</span>
                <span style={{flex:1, textAlign:'center'}}>{rMonthMins}m</span>
                <span style={{flex:1, textAlign:'center', color: distance === 0 ? '#34d399' : ''}}>${rMonthCash.toLocaleString('es-AR')}</span>
              </div>
            );
          })}
        </div>
        <style dangerouslySetInnerHTML={{__html: `div::-webkit-scrollbar { display: none; }`}} />
      </div>

      {/* Work Days Toggle */}
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

      {/* Burnout/Health Projector */}
      <div style={{ 
        padding: '0.6rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.75rem',
        background: weeklyHours <= 45 ? 'rgba(52,211,153,0.1)' : weeklyHours <= 70 ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
        border: weeklyHours <= 45 ? '1px solid rgba(52,211,153,0.3)' : weeklyHours <= 70 ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(239,68,68,0.3)'
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.2rem', color: weeklyHours <= 45 ? '#6ee7b7' : weeklyHours <= 70 ? '#fde047' : '#fca5a5' }}>
          {weeklyHours <= 45 ? '🟢 Healthy Workweek' : weeklyHours <= 70 ? '🟡 Overtime Hustle' : '🔴 Extreme Burnout Warning'}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)' }}>
          To hit <strong style={{color: '#a855f7'}}>AR${monthlyCash.toLocaleString('es-AR')}</strong>, you must grind for <strong style={{color: weeklyHours > 70 ? '#fca5a5' : '#fff'}}>{weeklyHours}h {weeklyMinsRemainder}m</strong> per week ({dailyHours}h {dailyMinsRemainder}m/day).
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>💱 ARS Rate</span>
        <input 
          type="number" step="any" className="stat-input"
          style={{ width: '80px', padding: '0.3rem', fontSize: '0.8rem' }}
          value={arsRate}
          onChange={(e) => {
             if (setArsRate) setArsRate(e.target.value);
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn" onClick={onCancel} style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', border: 'none' }}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleApply} style={{ flex: 2, padding: '0.5rem', fontSize: '0.85rem' }}>
          Set Goal: {monthlyMins}m
        </button>
      </div>
    </div>
  );
};

