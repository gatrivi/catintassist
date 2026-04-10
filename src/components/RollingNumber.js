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
    return <span style={{ px: '1px' }}>{digit}</span>;
  }

  return (
    <div 
      className="digit-container" 
      style={{ 
        height, 
        width: '0.6em',
        ...(height < 14 ? { background: 'none', boxShadow: 'none' } : {}) 
      }}
    >
      <div 
        className="digit-strip" 
        style={{ 
          transform: `translateY(-${offset}px)`,
          transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' 
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <div key={n} className="digit-value" style={{ height }}>{n}</div>
        ))}
      </div>
    </div>
  );
};

export const RollingNumber = ({ value, prefix = '', suffix = '', height = 24, className = '' }) => {
  // Convert value to string and split into characters
  // We handle numbers by formatting them with commas if they are numeric
  const displayValue = typeof value === 'number' 
    ? Math.round(value).toLocaleString('es-AR') 
    : String(value);
    
  const characters = (prefix + displayValue + suffix).split('');

  return (
    <div className={`rolling-number-wrapper ${className}`} style={{ height, display: 'inline-flex', alignItems: 'center' }}>
      {characters.map((char, i) => (
        <RollingDigit key={`${i}-${char}`} digit={char} height={height} />
      ))}
    </div>
  );
};
