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
      <DashboardHeader 
        onStartAudio={startRecording} 
        onStopAudio={stopRecording} 
        sttLanguage={sttLanguage}
        onToggleLanguage={toggleLanguage}
        connectionState={connectionState}
        connectionMessage={connectionMessage}
      />
      <main className="main-content">
        <TranscriptionBoard captions={captions} onClear={clearCaptions} />
        <div className="notes-area glass-panel" style={{ overflow: 'hidden' }}>
          <GreetingsPanel />
          <DictionaryTool />
          <NotePad />
        </div>
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
