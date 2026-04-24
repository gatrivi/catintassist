import { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';

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

  useEffect(() => {
    if (!isActive) {
      setShowWarning(false);
      setAlertedLevels({ 1: false, 2: false, 3: false });
      setPromptCount(0);
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
          setLastAlertTime(now);
        }
      }
    };

    const iv = setInterval(checkSilence, 5000);
    return () => clearInterval(iv);
  }, [isActive, lastActivityTime, lastAlertTime, showWarning, alertedLevels, audioEngine, isHold, holdSeconds, promptCount, startBreak, stopSession]);

  return null;
};
