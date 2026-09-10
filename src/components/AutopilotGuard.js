import { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';

/**
 * Call Autopilot UI (v4.98.0).
 *
 * AutopilotGuard: 10s cancellable countdown banner while an end phrase is
 * pending. On expiry it stops the call exactly like SilenceGuardian does
 * (stop audio pipeline, then stop the session/billing). The poll effect runs
 * before the early return so the deadline can't be missed while unmounted.
 *
 * AutopilotChip: tiny header indicator — armed shows 🤖 AUTO, hover shows
 * the last autopilot action.
 */
export const AutopilotGuard = ({ onStopAudio }) => {
  const {
    isActive,
    stopSession,
    autopilotEndsAt,
    cancelAutopilotEnd,
    consumeAutopilotEnd,
  } = useSession();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!autopilotEndsAt) return;
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, [autopilotEndsAt]);

  useEffect(() => {
    // Call ended by other means while a countdown was pending → drop it.
    if (!isActive && autopilotEndsAt) cancelAutopilotEnd();
  }, [isActive, autopilotEndsAt, cancelAutopilotEnd]);

  useEffect(() => {
    if (!autopilotEndsAt || now < autopilotEndsAt) return;
    if (!consumeAutopilotEnd()) return;
    onStopAudio?.();
    stopSession();
  }, [autopilotEndsAt, now, consumeAutopilotEnd, onStopAudio, stopSession]);

  if (!autopilotEndsAt || !isActive) return null;
  const secsLeft = Math.max(0, Math.ceil((autopilotEndsAt - now) / 1000));

  return (
    <div
      role="alertdialog"
      aria-label="Call autopilot auto-end countdown"
      style={{
        position: 'fixed',
        top: '48px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100000,
        background: 'rgba(2, 6, 23, 0.94)',
        border: '1px solid rgba(245, 158, 11, 0.5)',
        borderRadius: '10px',
        padding: '9px 12px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <span style={{ fontWeight: 900, color: '#fbbf24', fontSize: '0.78rem' }}>
        🤖 Auto-end in {secsLeft}s — disconnect phrase heard
      </span>
      <button
        onClick={cancelAutopilotEnd}
        style={{
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid rgba(16, 185, 129, 0.45)',
          color: '#6ee7b7',
          borderRadius: '7px',
          padding: '5px 10px',
          fontSize: '0.72rem',
          fontWeight: 900,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
        title="Cancel — stay on the call"
      >
        Keep call
      </button>
      <button
        onClick={() => {
          if (consumeAutopilotEnd()) {
            onStopAudio?.();
            stopSession();
          }
        }}
        style={{
          background: 'rgba(239, 68, 68, 0.18)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          borderRadius: '7px',
          padding: '5px 10px',
          fontSize: '0.72rem',
          fontWeight: 900,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
        title="End the call right now"
      >
        End now
      </button>
    </div>
  );
};

export const AutopilotChip = () => {
  const { callAutopilot, autopilotEvent } = useSession();
  if (!callAutopilot) return null;
  return (
    <span
      id="header-autopilot-chip"
      title={`Call Autopilot armed — ring/bridge phrase starts, disconnect phrase ends (10s cancellable).${autopilotEvent ? ` Last: ${autopilotEvent}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        marginLeft: '4px',
        padding: '2px 7px',
        borderRadius: '999px',
        background: 'rgba(16, 185, 129, 0.16)',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        color: '#6ee7b7',
        fontSize: '0.62rem',
        fontWeight: 900,
        letterSpacing: '0.04em',
        cursor: 'default',
      }}
    >
      🤖 AUTO
    </span>
  );
};
