import React, { useEffect, useRef, useState } from 'react';

// Debug-only counters for “typewriter churn” probes (used in DEBUG MODE).
let __ciaScrambleEvents = 0;
let __ciaScrambleLastLogAt = 0;

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
    // Debug-only: count effect triggers (jitter probe).
    __ciaScrambleEvents += 1;
    const now = Date.now();
    const displayedLen = displayedRef.current.length;
    const targetLen = target.length;
    // #region agent log: ScrambleText trigger cadence (H7)
    if (now - __ciaScrambleLastLogAt > 1000 && typeof window !== 'undefined') {
      __ciaScrambleLastLogAt = now;
      fetch('http://127.0.0.1:7891/ingest/e6c8e207-e5e1-4e11-b95a-baa54d11271a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2c9b00' },
        body: JSON.stringify({
          sessionId: '2c9b00',
          runId: 'scramble-jitter-probe',
          hypothesisId: 'H7',
          location: 'ScrambleText.js:useEffect',
          message: 'ScrambleText effect trigger cadence',
          timestamp: Date.now(),
          data: { eventsTotal: __ciaScrambleEvents, targetLen, displayedLen, deltaLen: targetLen - displayedLen }
        })
      }).catch(() => {});
    }
    // #endregion agent log

    targetRef.current = target;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!target) {
      displayedRef.current = '';
      setDisplayed('');
      if (spanRef.current) spanRef.current.textContent = '';
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
