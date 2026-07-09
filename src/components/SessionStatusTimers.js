import React from 'react';
import { formatTime } from './HeaderWidgets';
import { SlotMicroValue } from './SlotMicroValue';

/** On-call + off-call daily totals — slot-text ticks, status bar only. */
export function SessionStatusTimers({
  onCallSeconds = 0,
  offCallSeconds = 0,
  compact = false,
}) {
  const onCallText = formatTime(Math.floor(onCallSeconds));
  const offCallText = formatTime(Math.floor(offCallSeconds));

  return (
    <div
      className={`status-bar-timers${compact ? ' status-bar-timers--compact' : ''}`}
      aria-label={`On-call today ${onCallText}, off-call today ${offCallText}`}
    >
      <span className="status-bar-timer status-bar-timer--on-call" title="On-call banked today (includes live call)">
        <span className="status-bar-timer-icon" aria-hidden>📞</span>
        <SlotMicroValue text={onCallText} />
      </span>
      <span className="status-bar-timer-sep" aria-hidden>·</span>
      <span className="status-bar-timer status-bar-timer--off-call" title="Off-call today (avail + breaks)">
        <span className="status-bar-timer-icon" aria-hidden>🚪</span>
        <SlotMicroValue text={offCallText} />
      </span>
    </div>
  );
}

export default SessionStatusTimers;
