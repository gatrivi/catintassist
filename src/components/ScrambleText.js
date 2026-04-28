import React, { useState, useEffect, useRef } from 'react';

/**
 * ScrambleText Component
 * RAPIDLY cycles random ASCII characters before settling on the target value.
 * Masks React's instant DOM swaps with an organic "terminal decode" effect.
 */
export const ScrambleText = ({ value, duration = 600, className = "" }) => {
  const [displayValue, setDisplayValue] = useState(""); 
  const targetValueRef = useRef(""); 
  const frameRef = useRef(null);

  const chars = '0123456789#$%&?@';

  useEffect(() => {
    if (value === targetValueRef.current) return;
    
    // Start Scrambling
    targetValueRef.current = value;
    const startTime = performance.now();

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        // Generate random string of same length as target
        const targetStr = String(value);
        let scrambled = '';
        for (let i = 0; i < targetStr.length; i++) {
          scrambled += chars[Math.floor(Math.random() * chars.length)];
        }
        setDisplayValue(scrambled);
        frameRef.current = requestAnimationFrame(update);
      } else {
        setDisplayValue(value);
      }
    };

    frameRef.current = requestAnimationFrame(update);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className} style={{ 
      display: 'inline-block',
      fontFamily: 'var(--font-mono, monospace)',
      transition: 'color 0.3s ease, text-shadow 0.3s ease'
    }}>
      {displayValue}
    </span>
  );
};
