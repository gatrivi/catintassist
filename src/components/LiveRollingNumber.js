import React, { useEffect, useRef, useState } from 'react';
import { RollingNumber } from './RollingNumber';

const HEIGHT_BY_SIZE = { xs: 14, sm: 16, md: 20, lg: 24, xl: 30 };

/**
 * Smoothly increases displayed value between parent ticks (e.g. once per second),
 * with per-digit odometer roll — income meters, session AR$, etc.
 */
export const LiveRollingNumber = ({
  value,
  ratePerSecond = 0,
  prefix = '',
  suffix = '',
  size = 'md',
  format = true,
  className = '',
  title,
}) => {
  const discrete = typeof value === 'number' ? value : Math.round(parseFloat(value) || 0);
  const [smooth, setSmooth] = useState(discrete);
  const anchorRef = useRef({ v: discrete, t: performance.now() });
  const [reduceMotion] = useState(() => {
    try {
      return !!window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    anchorRef.current = { v: discrete, t: performance.now() };
    if (ratePerSecond <= 0) setSmooth(discrete);
  }, [discrete, ratePerSecond]);

  useEffect(() => {
    if (ratePerSecond <= 0) return undefined;
    if (reduceMotion) {
      // Respect reduced motion: keep it stable (still updates on prop changes).
      setSmooth(discrete);
      return undefined;
    }

    // CPU hotfix: avoid per-frame React updates (RAF). Update only ~1Hz.
    const tick = () => {
      const elapsed = (performance.now() - anchorRef.current.t) / 1000;
      setSmooth(anchorRef.current.v + ratePerSecond * elapsed);
    };

    tick(); // immediate update for responsiveness
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [ratePerSecond, discrete, reduceMotion]);

  const display = ratePerSecond > 0 ? smooth : discrete;
  const height = HEIGHT_BY_SIZE[size] || 14;
  const live = ratePerSecond > 0;

  return (
    <span title={title} className={className ? `live-rolling-wrap ${className}` : 'live-rolling-wrap'}>
      <RollingNumber
        value={format ? Math.floor(display) : display}
        prefix={prefix}
        suffix={suffix}
        height={height}
        format={format}
        liveMode={live}
        className={`stat-number stat-number--${size}`}
      />
    </span>
  );
};
