import { useEffect, useRef, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { safeSet } from '../contexts/SessionContext';

/**
 * SilenceGuardian monitors for runaway metrics caused by silent "ghost" calls
 * or forgotten disconnects. It prompts the user if no audio activity is detected
 * for a sustained period while the session is active.
 */
export const SilenceGuardian = ({ lastDataTime }) => {
  const { isActive, lastActivityTime, stopSession, startBreak, isHold } = useSession();
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

  const alertedRef = useRef(alertedLevels);
  const promptRef = useRef(promptCount);
  const lastAlertRef = useRef(lastAlertTime);
  alertedRef.current = alertedLevels;
  promptRef.current = promptCount;
  lastAlertRef.current = lastAlertTime;

  useEffect(() => {
    if (!isActive) {
      setShowWarning((w) => (w ? false : w));
      setAlertedLevels((prev) => (
        prev[1] || prev[2] || prev[3] ? { 1: false, 2: false, 3: false } : prev
      ));
      setPromptCount((p) => (p ? 0 : p));
      setShowDisconnectTooltip((d) => (d ? false : d));
      return;
    }

    const checkSilence = () => {
      const now = Date.now();
      const silenceSecs = (now - lastActivityTime) / 1000;
      const levels = alertedRef.current;
      const pc = promptRef.current;

      if (isHold) {
        setShowWarning((w) => (w ? false : w));
        setPromptCount((p) => (p ? 0 : p));
        setShowDisconnectTooltip((d) => (d ? false : d));
        return;
      }

      if (silenceSecs >= 360 && !levels[3]) {
        audioEngine.playWarningTiered(3);
        setAlertedLevels((prev) => ({ ...prev, 3: true }));
        setShowWarning(true);
        setPromptCount(3);
      } else if (silenceSecs >= 240 && !levels[2]) {
        audioEngine.playWarningTiered(2);
        setAlertedLevels((prev) => ({ ...prev, 2: true }));
        setShowWarning(true);
        setPromptCount(2);
      } else if (silenceSecs >= 120 && !levels[1]) {
        audioEngine.playWarningTiered(1);
        setAlertedLevels((prev) => ({ ...prev, 1: true }));
        setShowWarning(true);
        setPromptCount(1);
      }

      if (silenceSecs < 10 && (levels[1] || levels[2] || levels[3])) {
        setAlertedLevels((prev) => (
          prev[1] || prev[2] || prev[3] ? { 1: false, 2: false, 3: false } : prev
        ));
        setPromptCount((p) => (p ? 0 : p));
        setShowWarning((w) => (w ? false : w));
      }

      if (silenceSecs > 420 && pc >= 3) {
        stopSession();
        startBreak();
        setShowWarning(false);
        setPromptCount(0);
        audioEngine.playWarningTiered(1);
      }

      if (silenceSecs > 600) {
        const timeSinceAlert = (now - lastAlertRef.current) / 1000;
        if (timeSinceAlert > 180) {
          audioEngine.playWarningPing();
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
    audioEngine,
    isHold,
    startBreak,
    stopSession,
    doNotShowDisconnectTooltip,
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
