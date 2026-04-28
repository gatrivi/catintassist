import React, { useState, useEffect, useRef } from 'react';

/**
 * ScrambleText Component
 * RAPIDLY cycles random ASCII characters before settling on the target value.
 * Masks React's instant DOM swaps with an organic "terminal decode" effect.
 */
export const ScrambleText = ({ value, duration = 450, className = "" }) => {
  const spanRef = useRef(null);
  const targetValueRef = useRef(null); 
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  useEffect(() => {
    const prevValue = targetValueRef.current;
    targetValueRef.current = value;

    // Direct DOM sync if not animating
    if (!isAnimatingRef.current && spanRef.current) {
      spanRef.current.innerText = value;
    }

    // Abort if value hasn't changed or is empty
    if (value === prevValue) return;
    if (!value || String(value).trim() === "") return;

    // Deadlock Protection: If already animating, just let the loop continue with the new target
    if (isAnimatingRef.current) return;

    // Start Animation Loop
    isAnimatingRef.current = true;
    startTimeRef.current = performance.now();

    const update = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const target = String(targetValueRef.current || "");

      if (progress < 1) {
        // Left-to-Right Reveal logic
        const resolvedCount = Math.floor(target.length * progress);
        let newDisplay = target.slice(0, resolvedCount);
        
        for (let i = resolvedCount; i < target.length; i++) {
          if (target[i] === ' ') {
            newDisplay += ' ';
          } else {
            newDisplay += chars[Math.floor(Math.random() * chars.length)];
          }
        }

        if (spanRef.current) spanRef.current.innerText = newDisplay;
        frameRef.current = requestAnimationFrame(update);
      } else {
        // Final settle
        if (spanRef.current) spanRef.current.innerText = target;
        isAnimatingRef.current = false;
        startTimeRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(update);
  }, [value, duration]);

  // Only cancel on actual UNMOUNT to avoid the prop-update deadlock
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <span ref={spanRef} className={className} style={{ 
      display: 'inline-block',
      fontFamily: 'var(--font-mono, monospace)',
      whiteSpace: 'pre-wrap'
    }}>
      {value}
    </span>
  );
};
