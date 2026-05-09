import React, { useEffect, useState, useRef } from 'react';

/**
 * RollingDigit Component
 * Individual digit animator using CSS classes for theme consistency.
 * Animates from 0-9 with forward-only rolling.
 */
const RollingDigit = ({ digit, height = 24, speed = 0.8 }) => {
  const numericDigit = parseInt(digit, 10);
  const isInvalid = isNaN(numericDigit);
  
  const [offset, setOffset] = useState(() => (isInvalid ? 0 : numericDigit * height));
  const prevDigitRef = useRef(numericDigit);
  const cycleRef = useRef(isInvalid ? 0 : numericDigit);
  const [noAnim, setNoAnim] = useState(false);

  useEffect(() => {
    if (isInvalid || numericDigit === prevDigitRef.current) return;

    setNoAnim(false);
    const prev = prevDigitRef.current;
    let diff = numericDigit - prev;
    
    // Always roll forward (mechanical counter style)
    if (diff < 0) diff += 10;
    if (diff === 0) diff = 10; 

    cycleRef.current += diff;
    setOffset(cycleRef.current * height);
    prevDigitRef.current = numericDigit;

    // Normalize to prevent unbounded offset growth (keep cycle within 0-29 range)
    const timer = setTimeout(() => {
      // If we've reached the end of our strip, we MUST normalize
      // We use 3 cycles (30 digits), so if cycleRef > 20, we snap back
      if (cycleRef.current >= 20) {
        setNoAnim(true);
        const normalized = numericDigit * height;
        cycleRef.current = numericDigit;
        setOffset(normalized);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setNoAnim(false));
        });
      }
    }, speed * 1000 + 50);

    return () => clearTimeout(timer);
  }, [numericDigit, height, speed, isInvalid]);

  if (isInvalid) {
    return (
      <span style={{ 
        height, width: '0.4em', display: 'inline-flex', alignItems: 'center', 
        justifyContent: 'center', fontFamily: 'var(--font-mono)', opacity: 0.8 
      }}>
        {digit}
      </span>
    );
  }

  // 3 cycles (30 digits) provides headroom for multiple updates before normalization
  const strip = Array.from({ length: 30 }, (_, i) => i % 10);

  return (
    <div className="digit-container" style={{ height, width: '0.65em', overflow: 'hidden' }}>
      <div 
        className="digit-strip"
        style={{
          transform: `translateY(-${offset}px)`,
          transition: noAnim ? 'none' : `transform ${speed}s cubic-bezier(0.34, 1.56, 0.64, 1)`,
        }}
      >
        {strip.map((n, i) => (
          <div key={i} className="digit-value" style={{ height, fontSize: height * 0.75, fontWeight: 800 }}>
            {n}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * RollingNumber Component
 * Handles numbers, currency, and time strings.
 * Automatically formats pure numbers with thousands separators for standard dashboard look.
 */
export const RollingNumber = ({ value, prefix = '', suffix = '', height = 24, className = '', format = true }) => {
  let displayValue = String(value);
  
  // If it's a pure number and format is enabled, add thousands separators
  const isPureNumber = typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value) && !String(value).includes(':'));
  if (isPureNumber && format) {
    const num = Math.round(parseFloat(value));
    displayValue = Math.abs(num).toLocaleString('es-AR');
    if (num < 0 && !prefix.includes('-')) prefix = '-' + prefix;
  }

  const fullString = prefix + displayValue + suffix;
  const chars = fullString.split('');
  
  // To keep animations stable, we count digits from the right
  const digitsOnly = chars.filter(c => !isNaN(parseInt(c, 10)) && c !== ' ');
  const totalDigits = digitsOnly.length;
  let digitsFound = 0;

  return (
    <div 
      className={`rolling-number-wrapper ${className}`} 
      style={{ height, display: 'inline-flex', alignItems: 'center' }}
    >
      {chars.map((char, i) => {
        const isDigit = !isNaN(parseInt(char, 10)) && char !== ' ';
        
        if (!isDigit) {
          return (
            <span 
              key={`s-${i}`} 
              style={{ 
                width: char === '.' || char === ':' ? '0.25em' : '0.4em',
                textAlign: 'center', opacity: 0.6, fontFamily: 'var(--font-mono)',
                fontSize: height * 0.7
              }}
            >
              {char}
            </span>
          );
        }

        // It's a digit - use its position from right for a stable key and staggered delay
        const fromRight = totalDigits - 1 - digitsFound;
        digitsFound++;
        
        return (
          <RollingDigit 
            key={`d-${fromRight}`} 
            digit={char} 
            height={height} 
            speed={0.5 + (fromRight * 0.08)} 
          />
        );
      })}
    </div>
  );
};


