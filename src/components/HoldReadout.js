import React from 'react';
import { formatTime } from './HeaderWidgets';

// Hold counter readout — HUD end only (no timers, no state).
// Counting lives in SessionContext: holdSeconds ticks 1/s iff isHold+isActive
// and resets to 0 on release, call start/end, and mount (stale restores die).
// Auto triggers live on the other end (holdState.js) and feed the same flag,
// so this component never cares HOW hold started — manual or auto.
export const HoldReadout = ({ isHold, holdSeconds = 0 }) => {
  if (!isHold) return null;
  const elapsed = formatTime(holdSeconds);
  return (
    <span
      aria-label={`On hold ${elapsed} elapsed`}
      title={`On hold — ${elapsed} elapsed. Tap to resume.`}
    >
      H {elapsed}
    </span>
  );
};
