import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { AudioSettingsProvider } from './contexts/AudioSettingsContext';
import { DashboardHeader } from './components/DashboardHeader';
import { TranscriptionBoard } from './components/TranscriptionBoard';
import { GreetingsPanel } from './components/GreetingsPanel';
import { NotePad } from './components/NotePad';
import { DictionaryTool } from './components/DictionaryTool';
import { SilenceGuardian } from './components/SilenceGuardian';
import { DeskExerciseWidget } from './components/DeskExerciseWidget';
import { RosaryWidget } from './components/RosaryWidget';
import { MealTrackerWidget } from './components/MealTrackerWidget';
import { ChoreTrackerWidget } from './components/ChoreTrackerWidget';
import { useDeepgram } from './hooks/useDeepgram';
import { useProgressiveAudio } from './hooks/useProgressiveAudio';
import { loadFile, generateObjectUrl } from './utils/storage';
import './index.css';

const CloudSyncIndicator = () => {
  const { syncStatus } = useSession();
  const colors = { syncing: '#3b82f6', synced: '#10b981', error: '#ef4444', idle: 'transparent' };
  const label = { syncing: '☁️...', synced: '☁️ ok', error: '☁️ !', idle: '' };
  return (
    <span style={{ color: colors[syncStatus], transition: 'color 0.3s' }}>{label[syncStatus]}</span>
  );
};

const Dashboard = () => {
  const { startRecording, stopRecording, reconnectStream, captions, clearCaptions, sttLanguage, toggleLanguage, connectionState, connectionMessage, lastDataTime } = useDeepgram();
  const { isNotesOpen, setIsNotesOpen, isToolbarVisible, setIsToolbarVisible, isActive, isBreakActive, isZombieCall, minutesSinceLastBreak, startSession, clearZombieState, callFocusMode } = useSession();
  const canShowSoundboard = !isActive || !callFocusMode;
  const { playCoin } = useProgressiveAudio();
  const [isEditingBg, setIsEditingBg] = useState(false);
  
  useEffect(() => {
    const applyBg = async () => {
      const bgApp = await loadFile('bg_app');
      if (bgApp) {
        const url = generateObjectUrl(bgApp);
        document.body.style.backgroundImage = `url(${url})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
      }
    };
    applyBg();
    
    // Listen for custom event when background changes in settings
    window.addEventListener('cat_bg_changed', applyBg);
    return () => window.removeEventListener('cat_bg_changed', applyBg);
  }, []);

  // Matrix Mode Easter Egg
  useEffect(() => {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let index = 0;
    const handleKeyDown = (e) => {
      if (e.key === konamiCode[index]) {
        index++;
        if (index === konamiCode.length) {
          const current = document.body.getAttribute('data-easter-egg');
          document.body.setAttribute('data-easter-egg', current === 'matrix' ? '' : 'matrix');
          index = 0;
        }
      } else {
        index = 0;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Hotkeys for language switching
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT';
      
      if (e.code === 'Escape' || (e.altKey && e.code === 'Space')) {
        e.preventDefault();
        toggleLanguage();
      } else if (e.code === 'Space' && !isTyping) {
        e.preventDefault();
        toggleLanguage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleLanguage]);

  // Track idle time for full app vignette
  const [idleSecs, setIdleSecs] = useState(0);
  useEffect(() => {
    if (isActive || isBreakActive) { setIdleSecs(0); return; }
    const iv = setInterval(() => setIdleSecs(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [isActive, isBreakActive]);

  const isBurnoutWarning = !isBreakActive && minutesSinceLastBreak > 110;
  // PRIORITY FIX: isActive (Call) must always block app-idle vignette
  const stateClass = isActive ? 'app-active' : isBreakActive ? 'app-break' : (isBurnoutWarning ? 'burnout-alert' : (idleSecs > 45 ? 'app-idle' : ''));
  const appState = isZombieCall && connectionState !== 'connected'
    ? 'zombie'
    : isActive ? 'call' : isBreakActive ? 'break' : 'avail';

  // UNIFIED CONNECTION ENGINE
  const handleConnection = useCallback(async (isRecovery = false) => {
    const ok = await startRecording();
    if (ok) {
      if (isRecovery) clearZombieState();
      startSession(isRecovery);
    }
  }, [startRecording, startSession, clearZombieState]);

  // Micro-break nudge: top bar color shifts when working too long without a break
  const micBarColor = isZombieCall && connectionState !== 'connected' ? '#f59e0b'
    : isActive && minutesSinceLastBreak > 110 ? '#ef4444'
    : isActive && minutesSinceLastBreak > 90 ? '#f59e0b'
    : '#10b981';
  const micBarShadow = isZombieCall && connectionState !== 'connected' ? '0 0 8px #f59e0b'
    : isActive && minutesSinceLastBreak > 90 ? '0 0 8px #f59e0b' : '0 0 8px #10b981';

  // Off-call minute chime: progressively deeper each minute
  const idleMinuteCountRef = useRef(0);
  useEffect(() => {
    if (isActive || isBreakActive) {
      idleMinuteCountRef.current = 0;
      return;
    }
    const iv = setInterval(() => {
      idleMinuteCountRef.current += 1;
      playCoin(idleMinuteCountRef.current);
    }, 60000);
    return () => clearInterval(iv);
  }, [isActive, isBreakActive, playCoin]);

  // Demo Scenario Trigger (Shift + D)
  useEffect(() => {
    const scenarios = ['call', 'goal_hit', 'break', 'reset'];
    let scenarioIdx = 0;
    
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.code === 'KeyD') {
        const scenario = scenarios[scenarioIdx];
        scenarioIdx = (scenarioIdx + 1) % scenarios.length;
        
        // Trigger global demo event
        const event = new CustomEvent('cat_demo_scenario', { detail: scenario });
        window.dispatchEvent(event);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`app-container ${stateClass}`} data-state={appState} data-call-mode={isActive}>
      {/* Version Tag - Always visible in the upper right */}
      <div style={{ 
        position: 'fixed', top: '1px', right: '4px', zIndex: 10000, 
        fontSize: '0.55rem', fontWeight: 900, color: 'rgba(255,255,255,0.2)', 
        pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '0.05em',
        display: 'flex', alignItems: 'center', gap: '4px'
      }}>
        <CloudSyncIndicator />
        v4.35.0 (Full Stack)
      </div>

      <div id="top-mic-bar-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 9999, pointerEvents: 'none' }}>
        <div id="top-mic-bar" style={{ height: '100%', width: '0%', background: micBarColor, transition: 'width 0.05s ease-out, background 0.5s ease', opacity: 0, boxShadow: micBarShadow }} />
      </div>

      <SilenceGuardian lastDataTime={lastDataTime} />

      <DashboardHeader 
        onStartAudio={() => handleConnection(false)} 
        onStopAudio={stopRecording} 
        onReconnectStream={reconnectStream}
        onRecovery={() => handleConnection(true)}
        sttLanguage={sttLanguage}
        onToggleLanguage={toggleLanguage}
        connectionState={connectionState}
        connectionMessage={connectionMessage}
        lastDataTime={lastDataTime}
      />

      <main className={`main-content ${isNotesOpen ? 'notes-open' : ''} ${isToolbarVisible && (!isActive || !callFocusMode) ? 'tools-open' : ''}`}>
        <div className="transcription-pane" data-guide="transcript">
            <TranscriptionBoard 
              captions={captions} 
              isActive={isActive} 
              isBreakActive={isBreakActive}
              connectionState={connectionState}
              onClearAll={clearCaptions}
              onReconnect={() => handleConnection(true)}
              lastDataTime={lastDataTime}
            />
        </div>
        {(isNotesOpen || ((!isActive || !callFocusMode) && isToolbarVisible)) && (
          <div className={`tools-column ${isNotesOpen ? 'notes-open' : ''}`}>
             {canShowSoundboard && isToolbarVisible && (
               <div className="glass-panel tools-soundboard" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: isEditingBg ? '1' : '1.5' }}>
                 <div className="soundboard-chrome">
                   <div className="soundboard-chrome-label">
                     <span className="soundboard-chrome-title">🔊 SOUNDBOARD</span>
                     <span className="soundboard-chrome-hint">Audio routing WIP — hide while on calls</span>
                   </div>
                   <button
                     type="button"
                     className="soundboard-hide-btn"
                     onClick={() => setIsToolbarVisible(false)}
                     title="Hide soundboard panel"
                   >
                     ✕ HIDE SOUNDBOARD
                   </button>
                 </div>
                 <GreetingsPanel onEditModeChange={setIsEditingBg} />
               </div>
             )}
             {isNotesOpen && !isEditingBg && (
               <div className="glass-panel tools-notes" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: isActive && callFocusMode ? '200px' : undefined }}>
                 {(!isActive || !callFocusMode) && <DictionaryTool />}
                 <NotePad />
               </div>
             )}
          </div>
        )}
      </main>

      {canShowSoundboard && !isToolbarVisible && (
        <button
          type="button"
          className="soundboard-show-fab"
          onClick={() => setIsToolbarVisible(true)}
          title="Show soundboard panel"
        >
          🔊 SHOW SOUNDBOARD
        </button>
      )}

      <div className="habit-dock">
        <DeskExerciseWidget />
        <RosaryWidget />
        <MealTrackerWidget />
        <ChoreTrackerWidget />
        <button
          data-guide="notes"
          onClick={() => setIsNotesOpen(o => !o)}
          title="Quick Notes"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: isNotesOpen ? 'rgba(14, 165, 233, 0.25)' : 'rgba(7, 14, 35, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: isNotesOpen ? '#38bdf8' : 'rgba(255,255,255,0.6)',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isNotesOpen ? '0 0 12px rgba(14, 165, 233, 0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease',
            padding: 0,
            flexShrink: 0,
          }}
        >
          📝
        </button>
      </div>
    </div>
  );
};

function App() {
  return (
    <AudioSettingsProvider>
      <SessionProvider>
        <Dashboard />
      </SessionProvider>
    </AudioSettingsProvider>
  );
}

export default App;

