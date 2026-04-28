import React, { useEffect, useState, useRef } from 'react';

/**
 * RollingNumber Component
 * A premium digit-by-digit rolling animator for currency and numbers.
 * Inspired by mechanical counters and early iPhone aesthetics.
 */
const RollingDigit = ({ digit, height = 24, speed = 1.5 }) => {
  const [displayOffset, setDisplayOffset] = useState(0);
  const prevDigitRef = useRef(0);
  const isNumber = !isNaN(parseInt(digit));

  useEffect(() => {
    if (isNumber) {
      const newDigit = parseInt(digit);
      const prevDigit = prevDigitRef.current;
      
      let diff = newDigit - prevDigit;
      if (diff < 0) diff += 10; 
      
      setDisplayOffset(prev => prev + (diff * height));
      prevDigitRef.current = newDigit;
    }
  }, [digit, height, isNumber]);

  if (!isNumber) {
    return <span style={{ width: '0.4em', textAlign: 'center', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>{digit}</span>;
  }

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
        background: '#000',
        borderRadius: 0,
        margin: '0 0.5px',
        border: '1px solid #18181b'
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
          transition: `transform ${speed}s cubic-bezier(0.4, 0, 0.2, 1)`, 
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
            color: 'inherit',
            fontSize: height > 15 ? 'inherit' : '0.65rem',
            fontFamily: "var(--font-mono)",
            fontWeight: 800
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
      background: 'transparent'
    }}>
      {characters.map((char, i) => {
        const reverseIdx = characters.length - 1 - i;
        const isNum = !isNaN(parseInt(char));
        const speed = isNum ? 0.8 + (reverseIdx * 0.1) : 1.2;
        
        return <RollingDigit key={i} digit={char} height={height} speed={speed} />;
      })}
    </div>
  );
};
