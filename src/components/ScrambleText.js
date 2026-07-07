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
 * liveMode: append-only on live STT — never shrink mid-utterance.
 */
export const ScrambleText = ({
  value = '',
  charMs = 25,
  shrinkMs = 18,
  className = '',
  liveMode = false,
}) => {
  const spanRef = useRef(null);
  const displayedRef = useRef('');
  const targetRef = useRef('');
  const timerRef = useRef(null);
  const [displayed, setDisplayed] = useState(() => (prefersReducedMotion() ? value || '' : ''));

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
      let cur = displayedRef.current;

      if (cur === t) return;

      if (liveMode) {
        const prefixLen = commonPrefixLen(cur, t);
        if (prefixLen === 0) {
          displayedRef.current = t;
          setDisplayed(t);
          return;
        }
        const locked = t.slice(0, prefixLen);
        if (cur.length < locked.length) {
          cur = locked;
          displayedRef.current = cur;
          setDisplayed(cur);
        }
        if (cur.length < t.length) {
          const next = t.slice(0, cur.length + 1);
          displayedRef.current = next;
          setDisplayed(next);
          timerRef.current = setTimeout(tick, charMs);
          return;
        }
        if (cur !== t) {
          displayedRef.current = t;
          setDisplayed(t);
        }
        return;
      }

      const prefixLen = commonPrefixLen(cur, t);
      const shared = t.slice(0, prefixLen);

      if (cur.length > t.length || (cur.length === t.length && cur !== t)) {
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
  }, [value, charMs, shrinkMs, liveMode]);

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
