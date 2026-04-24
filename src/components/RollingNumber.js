import React, { useEffect, useState, useRef } from 'react';

/**
 * RollingNumber Component
 * A premium digit-by-digit rolling animator for currency and numbers.
 * Inspired by mechanical counters and early iPhone aesthetics.
 */
const RollingDigit = ({ digit, height = 24 }) => {
  const [offset, setOffset] = useState(0);
  const isNumber = !isNaN(parseInt(digit));

  useEffect(() => {
    if (isNumber) {
      setOffset(parseInt(digit) * height);
    }
  }, [digit, height, isNumber]);

  if (!isNumber) {
    return <span style={{ width: '0.4em', textAlign: 'center' }}>{digit}</span>;
  }

  return (
    <div 
      className="digit-container" 
      style={{ 
        height, 
        width: '0.65em', // Slightly wider for stability
        overflow: 'hidden',
        position: 'relative',
        display: 'inline-block',
        fontVariantNumeric: 'tabular-nums' // Force monospaced digits
      }}
    >
      <div 
        className="digit-strip" 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(-${offset}px)`,
          transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)', // Smooth standard out, no overshoot
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <div key={n} className="digit-value" style={{ 
            height, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%'
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
    <div className={`rolling-number-wrapper ${className}`} style={{ height, display: 'inline-flex', alignItems: 'center', overflow: 'hidden' }}>
      {characters.map((char, i) => (
        <RollingDigit key={i} digit={char} height={height} />
      ))}
    </div>
  );
};
