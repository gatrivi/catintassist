import React, { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';

/**
 * SilenceGuardian monitors for runaway metrics caused by silent "ghost" calls
 * or forgotten disconnects. It prompts the user if no audio activity is detected
 * for a sustained period while the session is active.
 */
export const SilenceGuardian = () => {
  const { isActive, lastActivityTime, updateActivity, stopSession, startBreak } = useSession();
  const audioEngine = useProgressiveAudio();
  const [showWarning, setShowWarning] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setShowWarning(false);
      return;
    }

    const checkSilence = () => {
      const now = Date.now();
      const silenceSecs = (now - lastActivityTime) / 1000;
      
      // TRIGGER 1: Initial nudge at 10 mins (600s)
      // High density tracking prevents "Metrics veering into fantasy"
      if (silenceSecs > 600) {
        setShowWarning(true);
        
        // REPEAT ALERT: Sound plays every 3 minutes (180s) to grab attention without being obnoxious
        const timeSinceAlert = (now - lastAlertTime) / 1000;
        if (timeSinceAlert > 180) {
          audioEngine.playWarningPing();
          setLastAlertTime(now);
        }
      } else {
        if (showWarning) setShowWarning(false);
      }
    };

    const iv = setInterval(checkSilence, 5000);
    return () => clearInterval(iv);
  }, [isActive, lastActivityTime, lastAlertTime, showWarning, audioEngine]);

  if (!showWarning) return null;

  const silenceMins = Math.floor((Date.now() - lastActivityTime) / 60000);

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
          {silenceMins >= 15 ? '🔇 Silence Limit!' : '🔇 Detecting Silence'}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
          You've been silent for <strong>{silenceMins}m</strong>. <br/>
          {silenceMins >= 14 ? '⚠️ Provider limit is 15m.' : 'Still on a call or waiting for provider?'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button 
          className="btn btn-primary" 
          onClick={() => { updateActivity(); setShowWarning(false); }} 
          style={{ flex: 1.5, padding: '0.7rem', fontSize: '0.85rem' }}
        >
          Still Working
        </button>
        <button 
          className="btn btn-danger" 
          onClick={() => { stopSession(); setShowWarning(false); }} 
          style={{ flex: 1, padding: '0.7rem', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}
        >
          End Call
        </button>
      </div>
      
      <button 
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
        I forgot to set Break ☕
      </button>

      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '0.2rem' }}>
        Prevents metrics from "veering into fantasy"
      </div>
    </div>
  );
};
