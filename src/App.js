import React, { useEffect, useState } from 'react';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { AudioSettingsProvider } from './contexts/AudioSettingsContext';
import { DashboardHeader } from './components/DashboardHeader';
import { TranscriptionBoard } from './components/TranscriptionBoard';
import { GreetingsPanel } from './components/GreetingsPanel';
import { NotePad } from './components/NotePad';
import { DictionaryTool } from './components/DictionaryTool';
import { SilenceGuardian } from './components/SilenceGuardian';
import { useDeepgram } from './hooks/useDeepgram';
import { loadFile, generateObjectUrl } from './utils/storage';
import './index.css';

const Dashboard = () => {
  const { startRecording, stopRecording, reconnectStream, captions, clearCaptions, sttLanguage, toggleLanguage, connectionState, connectionMessage, lastDataTime } = useDeepgram();
  const { isNotesOpen, isToolbarVisible, isActive, isBreakActive, minutesSinceLastBreak, startSession, clearZombieState } = useSession();
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
  const stateClass = isActive ? 'app-active' : isBreakActive ? 'app-break' : (isBurnoutWarning ? 'burnout-alert' : (idleSecs > 45 ? 'app-idle' : ''));
  const appState = isActive ? 'call' : isBreakActive ? 'break' : 'avail';

  // UNIFIED CONNECTION ENGINE: Ensures all start/reconnect buttons follow the exactly same gesture chain
  const handleConnection = async (isRecovery = false) => {
    const ok = await startRecording();
    if (ok) {
      startSession(isRecovery);
      clearZombieState();
    }
  };

  return (
    <div className={`app-container ${stateClass}`} data-state={appState}>
      {/* Version Tag - Always visible in the upper right */}
      <div style={{ 
        position: 'fixed', top: '1px', right: '4px', zIndex: 10000, 
        fontSize: '0.55rem', fontWeight: 900, color: 'rgba(255,255,255,0.2)', 
        pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        v4.4.7 (Trigger Filter)
      </div>

      <div id="top-mic-bar-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 9999, pointerEvents: 'none' }}>
        <div id="top-mic-bar" style={{ height: '100%', width: '0%', background: '#10b981', transition: 'width 0.05s ease-out', opacity: 0, boxShadow: '0 0 8px #10b981' }} />
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

      <main className="main-content">
        <div className="transcription-pane">
            <TranscriptionBoard 
              captions={captions} 
              isActive={isActive} 
              isBreakActive={isBreakActive}
              onClearAll={clearCaptions}
              onReconnect={() => handleConnection(true)}
              lastDataTime={lastDataTime}
            />
        </div>
        {(isNotesOpen || isToolbarVisible) && (
          <div className="tools-column">
             {isToolbarVisible && (
               <div className="glass-panel tools-soundboard" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: isEditingBg ? '1' : '1.5' }}>
                 <GreetingsPanel onEditModeChange={setIsEditingBg} />
               </div>
             )}
             {(isNotesOpen && !isEditingBg) && (
               <div className="glass-panel tools-notes" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
                 <DictionaryTool />
                 <NotePad />
               </div>
             )}
          </div>
        )}
      </main>
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
