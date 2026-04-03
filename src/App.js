import React, { useEffect, useState } from 'react';
import { SessionProvider } from './contexts/SessionContext';
import { AudioSettingsProvider } from './contexts/AudioSettingsContext';
import { DashboardHeader } from './components/DashboardHeader';
import { TranscriptionBoard } from './components/TranscriptionBoard';
import { GreetingsPanel } from './components/GreetingsPanel';
import { NotePad } from './components/NotePad';
import { DictionaryTool } from './components/DictionaryTool';
import { useDeepgram } from './hooks/useDeepgram';
import { loadFile, generateObjectUrl } from './utils/storage';
import './index.css';

const Dashboard = () => {
  const { startRecording, stopRecording, reconnectStream, captions, clearCaptions, sttLanguage, toggleLanguage, connectionState, connectionMessage } = useDeepgram();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  
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
  // Better Hotkeys: 
  // 1. `Alt + Space` or `Escape` will toggle language from anywhere, even when typing
  // 2. Spacebar works if not typing
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

  return (
    <div className="app-container">
      <div id="top-mic-bar-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 9999, pointerEvents: 'none' }}>
        <div id="top-mic-bar" style={{ height: '100%', width: '0%', background: '#10b981', transition: 'width 0.05s ease-out', opacity: 0, boxShadow: '0 0 8px #10b981' }} />
      </div>
      <DashboardHeader 
        onStartAudio={startRecording} 
        onStopAudio={stopRecording} 
        onReconnectStream={reconnectStream}
        sttLanguage={sttLanguage}
        onToggleLanguage={toggleLanguage}
        connectionState={connectionState}
        connectionMessage={connectionMessage}
      />
      <main className={`main-content ${isToolsOpen ? 'tools-open' : ''}`}>
        <TranscriptionBoard 
          captions={captions} 
          onClear={clearCaptions} 
          isToolsOpen={isToolsOpen}
          onToggleTools={() => setIsToolsOpen(!isToolsOpen)}
        />
        {isToolsOpen && (
          <SoundboardAndNotesWrapper />
        )}
      </main>
    </div>
  );
};

// Extracted wrapper to manage expanded state
const SoundboardAndNotesWrapper = () => {
  const [isEditingBg, setIsEditingBg] = useState(false);
  
  return (
    <>
      <div 
        className="glass-panel tools-soundboard" 
        style={{ 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column',
          gridRow: isEditingBg ? '1 / span 2' : '1'
        }}
      >
        <GreetingsPanel onEditModeChange={setIsEditingBg} />
      </div>
      {!isEditingBg && (
        <div className="glass-panel tools-notes" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DictionaryTool />
          <NotePad />
        </div>
      )}
    </>
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
