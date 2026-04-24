import React, { useEffect, useState, useRef } from 'react';

/**
 * RollingNumber Component
 * A premium digit-by-digit rolling animator for currency and numbers.
 * Inspired by mechanical counters and early iPhone aesthetics.
 */
const RollingDigit = ({ digit, height = 24 }) => {
  const [targetDigit, setTargetDigit] = useState(0);
  const [displayOffset, setDisplayOffset] = useState(0);
  const prevDigitRef = useRef(0);
  const isNumber = !isNaN(parseInt(digit));

  useEffect(() => {
    if (isNumber) {
      const newDigit = parseInt(digit);
      const prevDigit = prevDigitRef.current;
      
      // Calculate how many "steps" to move forward
      // If we go from 9 to 0, that's +1 step
      // If we go from 2 to 5, that's +3 steps
      let diff = newDigit - prevDigit;
      if (diff < 0) diff += 10; // Always roll forward like a mechanical dial
      
      setDisplayOffset(prev => prev + (diff * height));
      prevDigitRef.current = newDigit;
      setTargetDigit(newDigit);
    }
  }, [digit, height, isNumber]);

  if (!isNumber) {
    return <span style={{ width: '0.4em', textAlign: 'center', opacity: 0.5 }}>{digit}</span>;
  }

  // We use a repeated strip of numbers to allow for continuous forward rolling
  // 0-9 repeated 10 times gives us 100 slots, plenty for a long session
  const digits = Array.from({ length: 100 }, (_, i) => i % 10);

  return (
    <div 
      className="digit-container" 
      style={{ 
        height, 
        width: '0.68em',
        overflow: 'hidden',
        position: 'relative',
        display: 'inline-block',
        fontVariantNumeric: 'tabular-nums',
        // Art Deco / Analog Dial Shading
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.4) 100%)',
        boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5)',
        borderRadius: '2px',
        margin: '0 0.5px'
      }}
    >
      <div 
        className="digit-strip" 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(-${displayOffset}px)`,
          transition: 'transform 1.8s cubic-bezier(0.22, 1, 0.36, 1)', // Very slow, premium drift
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {digits.map((n, i) => (
          <div key={i} className="digit-value" style={{ 
            height, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%',
            color: 'rgba(255,255,255,0.9)',
            fontSize: height > 15 ? 'inherit' : '0.7rem',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)'
          }}>{n}</div>
        ))}
      </div>
    </div>
  );
};

export const RollingNumber = ({ value, prefix = '', suffix = '', height = 24, className = '' }) => {
  const displayValue = typeof value === 'number' 
    ? Math.round(value).toLocaleString('es-AR') 
    : String(value);
    
  const characters = (prefix + displayValue + suffix).split('');

  return (
    <div className={`rolling-number-wrapper ${className}`} style={{ 
      height, 
      display: 'inline-flex', 
      alignItems: 'center', 
      overflow: 'hidden',
      padding: '2px 0'
    }}>
      {characters.map((char, i) => (
        <RollingDigit key={i} digit={char} height={height} />
      ))}
    </div>
  );
};
