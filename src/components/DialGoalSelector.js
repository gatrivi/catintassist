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
      position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
      background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--panel-border)',
      borderRadius: '12px', padding: '1rem', width: '320px', zIndex: 100,
      backdropFilter: 'blur(16px)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', gap: '1rem'
    }}>
      {/* Target Dial Container */}
      <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>Daily Target</h4>
      
      <div style={{ position: 'relative', height: `${itemHeight * 3}px`, overflow: 'hidden', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Selection Highlight Overlay */}
        <div style={{
          position: 'absolute', top: `${itemHeight}px`, left: 0, right: 0, height: `${itemHeight}px`,
          background: 'rgba(139, 92, 246, 0.2)', borderTop: '1px solid rgba(139, 92, 246, 0.4)', borderBottom: '1px solid rgba(139, 92, 246, 0.4)',
          pointerEvents: 'none', zIndex: 10
        }} />
        
        <button onClick={(e) => { e.preventDefault(); setActiveIndex(Math.max(0, activeIndex - 1)); scrollRef.current.scrollTop = Math.max(0, activeIndex - 1) * itemHeight; }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${itemHeight}px`, background: 'rgba(0,0,0,0.5)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', zIndex: 20 }}>▲</button>
        <button onClick={(e) => { e.preventDefault(); setActiveIndex(Math.min(targets.length - 1, activeIndex + 1)); scrollRef.current.scrollTop = Math.min(targets.length - 1, activeIndex + 1) * itemHeight; }} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${itemHeight}px`, background: 'rgba(0,0,0,0.5)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', zIndex: 20 }}>▼</button>
        {/* Scrollable list */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ 
            height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth',
            paddingTop: `${itemHeight}px`, paddingBottom: `${itemHeight}px`,
            scrollbarWidth: 'none', msOverflowStyle: 'none'
          }}
        >
          {targets.map((amt, idx) => {
            const distance = Math.abs(idx - activeIndex);
            const scale = distance === 0 ? 1 : distance === 1 ? 0.85 : 0.7;
            const opacity = distance === 0 ? 1 : distance === 1 ? 0.5 : 0.2;
            
            return (
              <div key={amt} onClick={() => { setActiveIndex(idx); scrollRef.current.scrollTop = idx * itemHeight; }} style={{
                height: `${itemHeight}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                scrollSnapAlign: 'center', fontSize: '1.4rem', fontWeight: distance === 0 ? 800 : 500,
                color: distance === 0 ? '#a855f7' : 'var(--text-muted)', cursor: 'pointer',
                transform: `scale(${scale})`, opacity, transition: 'all 0.15s ease-out'
              }}>
                AR${amt.toLocaleString('es-AR')}
              </div>
            );
          })}
        </div>
        <style dangerouslySetInnerHTML={{__html: `div::-webkit-scrollbar { display: none; }`}} />
      </div>

      {/* Dynamic Summary */}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.5, color: '#e2e8f0', textAlign: 'center' }}>
          If I work <strong style={{ color: '#6ee7b7' }}>{dailyHours > 0 ? `${dailyHours}h ` : ''}{dailyMinsRemainder}m</strong> per day,<br/>
          I earn <strong style={{ color: '#a855f7' }}>AR${selectedCash.toLocaleString('es-AR')}</strong> per day.
        </p>
        
        <hr style={{ border: 'none', borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '0.2rem 0' }} />
        
        <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.5, color: '#e2e8f0', textAlign: 'center' }}>
          That is <strong style={{ color: '#6ee7b7' }}>{monthlyHours}h</strong> per month,<br/>
          and <strong style={{ color: '#34d399', fontSize: '0.9rem' }}>AR${monthlyCash.toLocaleString('es-AR')}</strong> per month.
        </p>
      </div>

      {/* Work Days Toggle */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        {[
          { label: '5D (22/mo)', val: 22 },
          { label: '6D (26/mo)', val: 26 },
          { label: '7D (30/mo)', val: 30 }
        ].map(opt => (
          <button
            key={opt.val}
            onClick={() => setWorkDays(opt.val)}
            style={{
              flex: 1, padding: '0.4rem 0', fontSize: '0.65rem', border: 'none', cursor: 'pointer',
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
          style={{ width: '60px', padding: '0.2rem', fontSize: '0.7rem' }}
          value={arsRate}
          onChange={(e) => {
             // Pass this back to parent via a dedicated callback if needed
             // but if arsRate is managed by context, we might need a setArsRate prop
             if (setArsRate) setArsRate(e.target.value);
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn" onClick={onCancel} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', border: 'none' }}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleApply} style={{ flex: 2, padding: '0.5rem', fontSize: '0.8rem' }}>
          Set Goal: {monthlyMins}m
        </button>
      </div>
    </div>
  );
};
