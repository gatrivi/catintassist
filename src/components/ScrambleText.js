import React, { useState, useEffect, useRef } from 'react';

/**
 * ScrambleText Component
 * RAPIDLY cycles random ASCII characters before settling on the target value.
 * Masks React's instant DOM swaps with an organic "terminal decode" effect.
 */
export const ScrambleText = ({ value, duration = 450, className = "" }) => {
  const chars = '0123456789#$%&?@';
  const generateRandom = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  const [displayValue, setDisplayValue] = useState(() => generateRandom(String(value || "").length)); 
  const targetValueRef = useRef(value); 
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    if (value === targetValueRef.current) return;
    targetValueRef.current = value;

    if (isAnimatingRef.current) return; // Already animating, just let it settle to new target

    isAnimatingRef.current = true;
    startTimeRef.current = performance.now();

    const update = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = elapsed / duration;

      if (progress < 1) {
        const targetStr = String(targetValueRef.current);
        let scrambled = '';
        for (let i = 0; i < targetStr.length; i++) {
          scrambled += chars[Math.floor(Math.random() * chars.length)];
        }
        setDisplayValue(scrambled);
        frameRef.current = requestAnimationFrame(update);
      } else {
        setDisplayValue(targetValueRef.current);
        isAnimatingRef.current = false;
        startTimeRef.current = null;
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
