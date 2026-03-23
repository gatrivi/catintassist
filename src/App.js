import React, { useEffect, useState } from 'react';
import { SessionProvider } from './contexts/SessionContext';
import { AudioSettingsProvider } from './contexts/AudioSettingsContext';
import { DashboardHeader } from './components/DashboardHeader';
import { TranscriptionBoard } from './components/TranscriptionBoard';
import { GreetingsPanel } from './components/GreetingsPanel';
import { NotePad } from './components/NotePad';
import { DictionaryTool } from './components/DictionaryTool';
import { useDeepgram } from './hooks/useDeepgram';
import './index.css';

const Dashboard = () => {
  const { startRecording, stopRecording, captions, clearCaptions, sttLanguage, toggleLanguage, connectionState, connectionMessage } = useDeepgram();
  const [isToolsOpen, setIsToolsOpen] = useState(false); // Default false, maximizing transcription


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
      <div id="top-mic-bar-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 9999, pointerEvents: 'none', background: 'transparent' }}>
        <div id="top-mic-bar" style={{ height: '100%', width: '0%', background: '#10b981', transition: 'width 0.05s ease-out, opacity 0.2s', opacity: 0, boxShadow: '0 0 8px #10b981' }} />
      </div>
      <DashboardHeader 
        onStartAudio={startRecording} 
        onStopAudio={stopRecording} 
        sttLanguage={sttLanguage}
        onToggleLanguage={toggleLanguage}
        connectionState={connectionState}
        connectionMessage={connectionMessage}
      />
      <main className="main-content">
        <TranscriptionBoard 
          captions={captions} 
          onClear={clearCaptions} 
          isToolsOpen={isToolsOpen}
          onToggleTools={() => setIsToolsOpen(!isToolsOpen)}
        />
        {isToolsOpen && (
          <div className="notes-area glass-panel" style={{ overflow: 'hidden' }}>
            <GreetingsPanel />
            <DictionaryTool />
            <NotePad />
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
