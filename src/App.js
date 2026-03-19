import React, { useEffect } from 'react';
import { SessionProvider } from './contexts/SessionContext';
import { DashboardHeader } from './components/DashboardHeader';
import { TranscriptionBoard } from './components/TranscriptionBoard';
import { NotePad } from './components/NotePad';
import { DictionaryTool } from './components/DictionaryTool';
import { useDeepgram } from './hooks/useDeepgram';
import './index.css';

const Dashboard = () => {
  const { startRecording, stopRecording, captions, sttLanguage, toggleLanguage } = useDeepgram();

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
      />
      <main className="main-content">
        <TranscriptionBoard captions={captions} />
        <div className="notes-area glass-panel" style={{ overflow: 'hidden' }}>
          <DictionaryTool />
          <NotePad />
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <SessionProvider>
      <Dashboard />
    </SessionProvider>
  );
}

export default App;
