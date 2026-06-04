import React, { useEffect, useRef, useState } from 'react';
import { RollingNumber } from './RollingNumber';

const HEIGHT_BY_SIZE = { xs: 10, sm: 12, md: 14, lg: 16, xl: 20 };

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

  useEffect(() => {
    anchorRef.current = { v: discrete, t: performance.now() };
    if (ratePerSecond <= 0) setSmooth(discrete);
  }, [discrete, ratePerSecond]);

  useEffect(() => {
    if (ratePerSecond <= 0) return undefined;
    let frameId;
    const loop = () => {
      const elapsed = (performance.now() - anchorRef.current.t) / 1000;
      setSmooth(anchorRef.current.v + ratePerSecond * elapsed);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [ratePerSecond, discrete]);

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
