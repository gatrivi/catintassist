import React, { useEffect, useState, useCallback } from 'react';
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
  const { isNotesOpen, isToolbarVisible, isActive, isBreakActive, startSession, clearZombieState } = useSession();
  const [isEditingBg, setIsEditingBg] = useState(false);
  
  const handleConnection = useCallback((isRecovery = false) => {
    if (isRecovery) clearZombieState();
    startSession(isRecovery);
    startRecording();
  }, [clearZombieState, startSession, startRecording]);

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
    window.addEventListener('cat_bg_changed', applyBg);
    return () => window.removeEventListener('cat_bg_changed', applyBg);
  }, []);

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

  const appState = isActive ? 'active' : isBreakActive ? 'break' : 'idle';

  return (
    <div className="app-container" data-state={appState}>
      <div style={{ 
        position: 'fixed', top: '2px', right: '4px', zIndex: 10000, 
        fontSize: '0.5rem', fontWeight: 400, color: 'var(--text-muted)', 
        pointerEvents: 'none', fontFamily: 'var(--font-mono)'
      }}>
        v4.14.2 (Deep-Sea)
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

      <main className="main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '4px', gap: '4px' }}>
        <div className="transcription-pane" style={{ flex: 1, minWidth: 0, height: '100%' }}>
            <TranscriptionBoard 
              captions={captions} 
              onClearAll={clearCaptions}
              onReconnect={() => handleConnection(true)}
              lastDataTime={lastDataTime}
            />
        </div>
        {(isNotesOpen || isToolbarVisible) && (
          <div className="tools-column" style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
             {isToolbarVisible && (
               <div className="brutalist-panel tools-soundboard" style={{ flex: isEditingBg ? '1' : '1.5', overflow: 'hidden', background: '#09090b', border: '1px solid #18181b' }}>
                 <GreetingsPanel onEditModeChange={setIsEditingBg} />
               </div>
             )}
             {(isNotesOpen && !isEditingBg) && (
               <div className="brutalist-panel tools-notes" style={{ flex: 1, overflow: 'hidden', background: '#09090b', border: '1px solid #18181b', display: 'flex', flexDirection: 'column' }}>
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
