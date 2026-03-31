import React, { useState, useRef, useEffect, useMemo } from 'react';

export const DialGoalSelector = ({ ratePerMinute, arsRate, setArsRate, initialCash, onSave, onCancel }) => {
  const targets = useMemo(() => {
    let arr = Array.from({ length: 37 }, (_, i) => 20000 + (i * 5000));
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

  useEffect(() => {
    // Snap to the default index on mount
    if (scrollRef.current) {
      scrollRef.current.scrollTop = activeIndex * itemHeight;
    }
  }, [activeIndex]);

  const handleScroll = (e) => {
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
  const monthlyHours = Math.floor(monthlyMins / 60);

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
          onMouseDown={(e) => {
            const el = scrollRef.current;
            el.dataset.isDragging = true;
            el.dataset.startY = e.pageY - el.offsetTop;
            el.dataset.scrollTop = el.scrollTop;
            el.style.scrollBehavior = 'auto'; // allow immediate dragging
            el.style.scrollSnapType = 'none';
          }}
          onMouseLeave={() => { 
             const el = scrollRef.current; 
             if (el) { el.dataset.isDragging = false; el.style.scrollBehavior = 'smooth'; el.style.scrollSnapType = 'y mandatory'; }
          }}
          onMouseUp={() => { 
             const el = scrollRef.current; 
             if (el) { el.dataset.isDragging = false; el.style.scrollBehavior = 'smooth'; el.style.scrollSnapType = 'y mandatory'; }
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

      {/* Dynamic Summary */}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5, color: '#e2e8f0', textAlign: 'center' }}>
          Consistently working <strong style={{ color: '#6ee7b7' }}>{dailyHours > 0 ? `${dailyHours}h ` : ''}{dailyMinsRemainder}m/day</strong> will hit <strong style={{ color: '#a855f7' }}>AR${selectedCash.toLocaleString('es-AR')}/day</strong>.<br/>
          Over <strong>{workDays} days</strong>, this totals <strong style={{ color: '#34d399', fontSize: '1rem' }}>AR${monthlyCash.toLocaleString('es-AR')}</strong>!
        </p>
      </div>

      {/* Work Days Toggle */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        {[
          { label: '5 Days/Wk (22/mo)', val: 22 },
          { label: '6 Days/Wk (26/mo)', val: 26 },
          { label: 'Every Day (30/mo)', val: 30 }
        ].map(opt => (
          <button
            key={opt.val}
            onClick={() => setWorkDays(opt.val)}
            style={{
              flex: 1, padding: '0.5rem 0', fontSize: '0.75rem', border: 'none', cursor: 'pointer',
              background: workDays === opt.val ? '#3b82f6' : 'transparent',
              color: workDays === opt.val ? '#fff' : 'var(--text-muted)',
              fontWeight: workDays === opt.val ? 700 : 500, transition: 'all 0.2s'
            }}
          >
            {opt.label}
          </button>
        ))}
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

