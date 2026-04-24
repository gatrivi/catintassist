import React, { useEffect, useState, useRef } from 'react';

/**
 * RollingNumber Component
 * A premium digit-by-digit rolling animator for currency and numbers.
 * Inspired by mechanical counters and early iPhone aesthetics.
 */
const RollingDigit = ({ digit, height = 24, speed = 1.5 }) => {
  const [targetDigit, setTargetDigit] = useState(0);
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
      setTargetDigit(newDigit);
    }
  }, [digit, height, isNumber]);

  if (!isNumber) {
    return <span style={{ width: '0.4em', textAlign: 'center', opacity: 0.5 }}>{digit}</span>;
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
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.5) 100%)',
        boxShadow: 'inset 0 0 8px rgba(0,0,0,0.7)',
        borderRadius: '2px',
        margin: '0 0.5px',
        border: '1px solid rgba(255,255,255,0.03)'
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
          // Speed depends on position (units fast, hundreds slow)
          transition: `transform ${speed}s linear`, 
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
            color: '#fff',
            fontSize: height > 15 ? 'inherit' : '0.65rem',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            fontFamily: "'Courier New', monospace", // Mechanical look
            fontWeight: 900
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
      padding: '4px 0',
      background: 'rgba(0,0,0,0.1)',
      borderRadius: '4px'
    }}>
      {characters.map((char, i) => {
        // Calculate speed based on position from right
        const reverseIdx = characters.length - 1 - i;
        const isNum = !isNaN(parseInt(char));
        const speed = isNum ? 1.0 + (reverseIdx * 0.4) : 1.5;
        
        return <RollingDigit key={i} digit={char} height={height} speed={speed} />;
      })}
    </div>
  );
};
