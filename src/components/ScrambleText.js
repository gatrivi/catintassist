import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../utils/motionPreference';

/** Longest shared prefix between two strings. */
const commonPrefixLen = (a, b) => {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
};

/**
 * Typewriter text — reveals/shrinks one char at a time, no in-flow placeholders.
 * Layout-safe: only settled prefix occupies space.
 */
export const ScrambleText = ({
  value = '',
  charMs = 25,
  shrinkMs = 18,
  className = '',
}) => {
  const spanRef = useRef(null);
  const displayedRef = useRef('');
  const targetRef = useRef('');
  const timerRef = useRef(null);
  const [displayed, setDisplayed] = useState(value || '');

  useEffect(() => {
    const target = value || '';
    targetRef.current = target;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!target) {
      displayedRef.current = '';
      setDisplayed('');
      if (spanRef.current) spanRef.current.textContent = '';
      return undefined;
    }

    if (prefersReducedMotion()) {
      displayedRef.current = target;
      setDisplayed(target);
      if (spanRef.current) spanRef.current.textContent = target;
      return undefined;
    }

    const tick = () => {
      const t = targetRef.current;
      const cur = displayedRef.current;

      if (cur === t) return;

      const prefixLen = commonPrefixLen(cur, t);
      const shared = t.slice(0, prefixLen);

      if (cur.length > t.length || (cur.length === t.length && cur !== t)) {
        // Shrink toward shared prefix, then grow if needed
        if (cur.length > shared.length) {
          const next = cur.slice(0, cur.length - 1);
          displayedRef.current = next;
          setDisplayed(next);
          timerRef.current = setTimeout(tick, shrinkMs);
          return;
        }
      }

      if (cur.length < t.length) {
        const next = t.slice(0, cur.length + 1);
        displayedRef.current = next;
        setDisplayed(next);
        timerRef.current = setTimeout(tick, charMs);
        return;
      }

      // Same length but different chars — step through shared prefix then re-grow
      if (cur !== t) {
        if (cur.length > shared.length) {
          const next = cur.slice(0, cur.length - 1);
          displayedRef.current = next;
          setDisplayed(next);
          timerRef.current = setTimeout(tick, shrinkMs);
        } else {
          const next = t.slice(0, cur.length + 1);
          displayedRef.current = next;
          setDisplayed(next);
          timerRef.current = setTimeout(tick, charMs);
        }
      }
    };

    tick();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, charMs, shrinkMs]);

  return (
    <span
      ref={spanRef}
      className={className}
      style={{
        display: 'inline',
        fontFamily: 'var(--font-mono, monospace)',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
      }}
    >
      {displayed}
    </span>
  );
};
