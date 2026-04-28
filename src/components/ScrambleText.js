import React, { useEffect, useRef } from 'react';

/**
 * ScrambleText Component
 * Smooth "terminal decode" effect. Only animates new text (suffix) on append,
 * preventing the jarring full-rescramble when words are added mid-stream.
 * Uses a soft number-only charset for calmer visuals.
 */
export const ScrambleText = ({ value, duration = 350, className = "" }) => {
  const spanRef = useRef(null);
  const targetValueRef = useRef("");
  const stableTextRef = useRef(""); // Text that has fully settled
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  const isAnimatingRef = useRef(false);
  // Softer charset: numbers only (way less jarring than uppercase letters)
  const chars = '0123456789';

  useEffect(() => {
    targetValueRef.current = value || "";

    if (value === stableTextRef.current) return;
    if (!value) {
      stableTextRef.current = "";
      if (spanRef.current) spanRef.current.innerText = "";
      return;
    }

    // If already animating, the loop will pick up the new targetValueRef
    // and resolve to it smoothly.
    if (isAnimatingRef.current) return;

    isAnimatingRef.current = true;
    startTimeRef.current = performance.now();

    // Append-only updates are faster and calmer
    const stable = stableTextRef.current;
    const isAppend = stable && value.startsWith(stable) && stable.length > 0;
    const animDuration = isAppend ? 150 : duration;

    const update = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / animDuration, 1);
      const target = targetValueRef.current;

      // Recompute prefix dynamically in case value changed mid-animation
      const settled = stableTextRef.current;
      let prefix = "";
      let animateText = target;
      if (settled && target.startsWith(settled) && settled.length > 0) {
        prefix = settled;
        animateText = target.slice(settled.length);
      }

      if (progress < 1) {
        const resolvedCount = Math.floor(animateText.length * progress);
        let newDisplay = prefix + animateText.slice(0, resolvedCount);

        for (let i = resolvedCount; i < animateText.length; i++) {
          if (animateText[i] === ' ') {
            newDisplay += ' ';
          } else {
            newDisplay += chars[Math.floor(Math.random() * chars.length)];
          }
        }

        if (spanRef.current) spanRef.current.innerText = newDisplay;
        frameRef.current = requestAnimationFrame(update);
      } else {
        if (spanRef.current) spanRef.current.innerText = target;
        stableTextRef.current = target; // Mark fully settled
        isAnimatingRef.current = false;
        startTimeRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(update);
  }, [value, duration]);

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
