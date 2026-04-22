import React, { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';

/**
 * SilenceGuardian monitors for runaway metrics caused by silent "ghost" calls
 * or forgotten disconnects. It prompts the user if no audio activity is detected
 * for a sustained period while the session is active.
 */
export const SilenceGuardian = () => {
  const { isActive, lastActivityTime, updateActivity, stopSession, startBreak, isHold, holdSeconds } = useSession();
  const audioEngine = useProgressiveAudio();
  const [showWarning, setShowWarning] = useState(false);
  const [showHoldWarning, setShowHoldWarning] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState(0);
  const [alertedLevels, setAlertedLevels] = useState({ 1: false, 2: false, 3: false });
  const [promptCount, setPromptCount] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setShowWarning(false);
      setShowHoldWarning(false);
      setAlertedLevels({ 1: false, 2: false, 3: false });
      setPromptCount(0);
      return;
    }

    const checkSilence = () => {
      const now = Date.now();
      const silenceSecs = (now - lastActivityTime) / 1000;
      
      // HOLD WARNING: Prompt after 15m (900s) on Hold
      if (isHold && holdSeconds >= 900) {
        setShowHoldWarning(true);
      } else {
        setShowHoldWarning(false);
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
  }, [isActive, lastActivityTime, lastAlertTime, showWarning, alertedLevels, audioEngine]);

  if (!showWarning && !showHoldWarning) return null;

  const silenceSecsTotal = Math.floor((Date.now() - lastActivityTime) / 1000);
  const silenceMins = Math.floor(silenceSecsTotal / 60);

  if (showHoldWarning) {
    return (
      <div className="glass-panel" style={{
        position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 10000, padding: '1.2rem', border: '1px solid #f59e0b',
        background: 'rgba(15, 23, 42, 0.98)', backdropFilter: 'blur(20px)',
        boxShadow: '0 15px 50px rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', 
        gap: '0.8rem', width: '340px', borderRadius: '12px',
        animation: 'slideUpBounce 0.4s cubic-bezier(0.17, 0.88, 0.32, 1.28) forwards'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem', color: '#fcd34d' }}>⏳ Long Hold Detected</div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
            You've been on **Hold** for <strong>{Math.floor(holdSeconds / 60)}m</strong>. <br/>
            Is the patient still there?
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => updateActivity()}>Still Holding</button>
        <button className="btn btn-danger" onClick={() => stopSession()}>End Call</button>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{
      position: 'fixed', 
      bottom: '30px', 
      left: '50%', 
      transform: 'translateX(-50%)',
      zIndex: 10000, 
      padding: '1.2rem', 
      border: '1px solid rgba(139, 92, 246, 0.3)',
      background: 'rgba(15, 23, 42, 0.98)', 
      backdropFilter: 'blur(20px)',
      boxShadow: '0 15px 50px rgba(0,0,0,0.9)',
      display: 'flex', 
      flexDirection: 'column', 
      gap: '0.8rem', 
      width: '340px',
      borderRadius: '12px',
      animation: 'slideUpBounce 0.4s cubic-bezier(0.17, 0.88, 0.32, 1.28) forwards'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem', filter: 'drop-shadow(0 0 5px rgba(139, 92, 246, 0.5))' }}>
          {promptCount >= 3 ? '📵 Final Warning' : `🔇 Silence Prompt ${promptCount}/3`}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
          You've been silent for <strong>{silenceMins}m {silenceSecsTotal % 60}s</strong>. <br/>
          {promptCount >= 3 ? '⚠️ AUTO-STOP in 60s if no response! We will move you to Break.' : '"Still Working" resets the silence timer.'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button 
          id="silence-still-working-btn"
          className="btn btn-primary" 
          onClick={() => { updateActivity(); setShowWarning(false); }} 
          style={{ flex: 1.5, padding: '0.7rem', fontSize: '0.85rem' }}
        >
          Still Working (Keep Mins)
        </button>
        <button 
          id="silence-end-call-btn"
          className="btn btn-danger" 
          onClick={() => { stopSession(); setShowWarning(false); }} 
          style={{ flex: 1, padding: '0.7rem', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}
        >
          End Call
        </button>
      </div>
      
      <button 
        id="silence-forgot-break-btn"
        className="btn" 
        onClick={() => { stopSession(); startBreak(); setShowWarning(false); }} 
        style={{ 
          background: 'rgba(251, 146, 60, 0.12)', 
          color: '#fdba74', 
          border: '1px solid rgba(251, 146, 60, 0.25)', 
          padding: '0.5rem', 
          fontSize: '0.75rem',
          marginTop: '0.2rem'
        }}
      >
        I forgot to set Break ☕ (Auto-corrects stats)
      </button>

      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '0.2rem' }}>
        Clicking 'Still Working' resets the 10m silence timer.
      </div>
    </div>
  );
};
