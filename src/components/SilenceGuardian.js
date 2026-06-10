import { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { safeSet } from '../contexts/SessionContext';

/**
 * SilenceGuardian monitors for runaway metrics caused by silent "ghost" calls
 * or forgotten disconnects. It prompts the user if no audio activity is detected
 * for a sustained period while the session is active.
 */
export const SilenceGuardian = ({ lastDataTime }) => {
  const { isActive, lastActivityTime, stopSession, startBreak, isHold, holdSeconds } = useSession();
  const audioEngine = useProgressiveAudio();
  const [showWarning, setShowWarning] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState(0);
  const [alertedLevels, setAlertedLevels] = useState({ 1: false, 2: false, 3: false });
  const [promptCount, setPromptCount] = useState(0);
  const STORAGE_KEY = 'catintassist_silence_disconnect_tooltip_dismissed';
  const [doNotShowDisconnectTooltip, setDoNotShowDisconnectTooltip] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showDisconnectTooltip, setShowDisconnectTooltip] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setShowWarning(false);
      setAlertedLevels({ 1: false, 2: false, 3: false });
      setPromptCount(0);
      setShowDisconnectTooltip(false);
      return;
    }

    const checkSilence = () => {
      const now = Date.now();
      const silenceSecs = (now - lastActivityTime) / 1000;
      
      // HOLD WARNING logic removed (unused showHoldWarning)

      // BYPASS: If on hold, do not play intrusive alerts or auto-disconnect
      if (isHold) {
        if (showWarning) setShowWarning(false);
        if (promptCount > 0) setPromptCount(0);
        if (showDisconnectTooltip) setShowDisconnectTooltip(false);
        return;
      }

      // PRE-PROMPT AUDIO NUDGES (Keep tiered sounds but aligned with new thresholds)
      if (silenceSecs >= 360 && !alertedLevels[3]) {
        audioEngine.playWarningTiered(3);
        setAlertedLevels(prev => ({ ...prev, 3: true }));
        setShowWarning(true);
        setPromptCount(3);
      } else if (silenceSecs >= 240 && !alertedLevels[2]) {
        audioEngine.playWarningTiered(2);
        setAlertedLevels(prev => ({ ...prev, 2: true }));
        setShowWarning(true);
        setPromptCount(2);
      } else if (silenceSecs >= 120 && !alertedLevels[1]) {
        audioEngine.playWarningTiered(1);
        setAlertedLevels(prev => ({ ...prev, 1: true }));
        setShowWarning(true);
        setPromptCount(1);
      }

      // RESET ALERTS: if user speaks, reset alerted state
      if (silenceSecs < 10 && (alertedLevels[1] || alertedLevels[2] || alertedLevels[3])) {
        setAlertedLevels({ 1: false, 2: false, 3: false });
        setPromptCount(0);
        setShowWarning(false);
      }

      // AUTO-STOP LOGIC: If 3rd prompt is ignored for more than 1 minute (total 7m+ silence)
      if (silenceSecs > 420 && promptCount >= 3) {
        // Auto-correct to break
        stopSession();
        startBreak();
        setShowWarning(false);
        setPromptCount(0);
        audioEngine.playWarningTiered(1); // Small sound to notify auto-stop
      }

      // Keep legacy 10m sound if everything else failed
      if (silenceSecs > 600) {
        const timeSinceAlert = (now - lastAlertTime) / 1000;
        if (timeSinceAlert > 180) {
          audioEngine.playWarningPing();
          // Silence "ping" is your cue to disconnect and reset.
          if (!doNotShowDisconnectTooltip) setShowDisconnectTooltip(true);
          setLastAlertTime(now);
        }
      }
    };

    const iv = setInterval(checkSilence, 5000);
    return () => clearInterval(iv);
  }, [
    isActive,
    lastActivityTime,
    lastAlertTime,
    showWarning,
    alertedLevels,
    audioEngine,
    isHold,
    holdSeconds,
    promptCount,
    startBreak,
    stopSession,
    doNotShowDisconnectTooltip,
    showDisconnectTooltip
  ]);

  if (!isActive || isHold) return null;
  if (!showDisconnectTooltip || doNotShowDisconnectTooltip) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '48px',
        right: '10px',
        zIndex: 100000,
        width: 'min(320px, calc(100vw - 20px))',
        background: 'rgba(2, 6, 23, 0.92)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '10px',
        padding: '10px 10px 9px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      role="dialog"
      aria-label="Silence disconnect reminder"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, color: '#fb923c', fontSize: '0.78rem', letterSpacing: '0.02em' }}>
            Silence detected
          </div>
          <div style={{ marginTop: '4px', color: 'rgba(255,255,255,0.82)', fontSize: '0.72rem', lineHeight: 1.25 }}>
            Disconnect and reconnect to refresh translations.
          </div>
        </div>
        <button
          onClick={() => setShowDisconnectTooltip(false)}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.14)',
            color: 'rgba(255,255,255,0.78)',
            borderRadius: '7px',
            padding: '6px 8px',
            fontSize: '0.7rem',
            fontWeight: 800,
            cursor: 'pointer',
            flexShrink: 0
          }}
          title="Hide this reminder"
        >
          Hide
        </button>
      </div>

      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => {
            setDoNotShowDisconnectTooltip(true);
            try {
              safeSet(STORAGE_KEY, 'true');
            } catch {}
            setShowDisconnectTooltip(false);
          }}
          style={{
            background: 'rgba(251, 146, 60, 0.18)',
            border: '1px solid rgba(251, 146, 60, 0.35)',
            color: '#fdba74',
            borderRadius: '7px',
            padding: '6px 10px',
            fontSize: '0.7rem',
            fontWeight: 900,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
          title="Disable this tooltip permanently"
        >
          Do not show again
        </button>
      </div>
    </div>
  );
};
