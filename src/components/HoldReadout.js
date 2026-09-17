import React from 'react';
import { formatTime } from './HeaderWidgets';

// Hold readout — HUD end only (no timers, no state).
// Counting lives in SessionContext: holdSeconds ticks 1/s iff isHold+isActive
// and resets to 0 on release, call start/end, and mount (stale restores die).
// Auto triggers live on the other end (holdState.js) and feed the same flag,
// so this component never cares HOW hold started — manual or auto.
//
// Uniform-buttons rule: the button is one 23px cell like CAT/ZAP, so only
// "H" fits — elapsed time lives in aria-label + title (screen readers and
// hover), and the call micro-bar hold slot shows it live during calls.
export const HoldReadout = ({ isHold, holdSeconds = 0 }) => {
  if (!isHold) return null;
  const elapsed = formatTime(holdSeconds);
  return (
    <span
      aria-label={`On hold ${elapsed} elapsed`}
      title={`On hold — ${elapsed} elapsed. Tap to resume.`}
    >
      H
    </span>
  );
};
