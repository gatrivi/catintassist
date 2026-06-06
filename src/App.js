import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { AudioSettingsProvider, useAudioSettings } from './contexts/AudioSettingsContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { AppGuideProvider } from './contexts/AppGuideContext';
import { WelcomeBar } from './components/WelcomeBar';
import { FirstVisitCoach } from './components/FirstVisitCoach';
import { ConnectHint } from './components/ConnectHint';
import { IdleDiscoveryHint } from './components/IdleDiscoveryHint';
import { AppUpdateBanner } from './components/AppUpdateBanner';
import { hapticConnect, flashConnectMode } from './utils/connectFeedback';
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
import {
  WorkspaceViewSwitcher,
  OFF_CALL_VIEWS,
  loadWorkspaceView,
  saveWorkspaceView,
  hasSeenStudioHint,
  markStudioHintSeen,
} from './components/WorkspaceViewSwitcher';
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
  const { startRecording, stopRecording, reconnectStream, captions, clearCaptions, sttLanguage, toggleLanguage, connectionState, connectionMessage, lastDataTime, captureMode } = useDeepgram();
  const { isNotesOpen, setIsNotesOpen, isActive, isBreakActive, isZombieCall, minutesSinceLastBreak, startSession, clearZombieState, callFocusMode } = useSession();
  const { sourceLang, isDefaultPair, setCaptureMode: setLangCaptureMode } = useLanguage();
  const { selectedMicId } = useAudioSettings();
  const { playCoin, playMicConnect, playTabConnect } = useProgressiveAudio();
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [workspaceView, setWorkspaceView] = useState(loadWorkspaceView);
  const [showStudioHint, setShowStudioHint] = useState(() => !hasSeenStudioHint());

  const offCallWorkspace = isActive ? null : workspaceView;
  const isSoundboardStudio = offCallWorkspace === 'soundboard';

  const cycleWorkspaceView = useCallback(() => {
    if (isActive) return;
    markStudioHintSeen();
    setShowStudioHint(false);
    setWorkspaceView((prev) => {
      const i = OFF_CALL_VIEWS.indexOf(prev);
      const next = OFF_CALL_VIEWS[(i + 1) % OFF_CALL_VIEWS.length];
      saveWorkspaceView(next);
      return next;
    });
  }, [isActive]);

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

  const runConnect = useCallback(async (mode, isRecovery = false) => {
    const interpreterSockets = mode === 'tab' || isDefaultPair;
    if (mode === 'tab') {
      playTabConnect();
      hapticConnect('tab');
      flashConnectMode('tab');
    } else {
      playMicConnect();
      hapticConnect('mic');
      flashConnectMode('mic');
    }
    const ok = await startRecording({
      mode,
      sourceLang,
      interpreterSockets,
      micDeviceId: selectedMicId || undefined,
    });
    if (ok) {
      setLangCaptureMode(mode);
      if (isRecovery) clearZombieState();
      startSession(isRecovery);
    }
  }, [startRecording, startSession, clearZombieState, sourceLang, isDefaultPair, selectedMicId, setLangCaptureMode, playMicConnect, playTabConnect]);

  const handleMicConnect = useCallback(() => runConnect('mic', false), [runConnect]);
  const handleTabConnect = useCallback(() => runConnect('tab', false), [runConnect]);
  const handleRecovery = useCallback(() => runConnect(captureMode || 'tab', true), [runConnect, captureMode]);

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
      document.documentElement.setAttribute('data-habit-minute-flash', 'true');
      setTimeout(() => document.documentElement.removeAttribute('data-habit-minute-flash'), 800);
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
    <div
      className={`app-container ${stateClass}`}
      data-state={appState}
      data-call-mode={isActive ? 'true' : 'false'}
      data-off-call-view={isActive ? 'call' : workspaceView}
    >
      {/* Version Tag - Always visible in the upper right */}
      <div style={{ 
        position: 'fixed', top: '1px', right: '4px', zIndex: 10000, 
        fontSize: '0.55rem', fontWeight: 900, color: 'rgba(255,255,255,0.2)', 
        pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '0.05em',
        display: 'flex', alignItems: 'center', gap: '4px'
      }}>
        <CloudSyncIndicator />
        v4.46.2 (Full Stack)
      </div>

      <div id="top-mic-bar-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 9999, pointerEvents: 'none' }}>
        <div id="top-mic-bar" style={{ height: '100%', width: '0%', background: micBarColor, transition: 'width 0.05s ease-out, background 0.5s ease', opacity: 0, boxShadow: micBarShadow }} />
      </div>

      <AppUpdateBanner />
      <WelcomeBar />
      <ConnectHint />
      <FirstVisitCoach />
      <IdleDiscoveryHint isActive={isActive} isBreakActive={isBreakActive} />

      <SilenceGuardian lastDataTime={lastDataTime} />

      {!isActive && workspaceView === 'scoreboard' && (
        <main id="scoreboard-root" className="main-content view-scoreboard" />
      )}

      <DashboardHeader 
        onStartMicConnect={handleMicConnect}
        onStartTabConnect={handleTabConnect}
        onStopAudio={stopRecording} 
        onReconnectStream={reconnectStream}
        onRecovery={handleRecovery}
        captureMode={captureMode}
        sttLanguage={sttLanguage}
        onToggleLanguage={toggleLanguage}
        connectionState={connectionState}
        connectionMessage={connectionMessage}
        lastDataTime={lastDataTime}
        offCallWorkspace={offCallWorkspace}
        onCycleWorkspace={cycleWorkspaceView}
        showStudioHint={showStudioHint}
      />

      {isSoundboardStudio && (
        <main className="main-content view-soundboard">
          <div className="workspace-soundboard-pane glass-panel" data-guide="soundboard-lab">
            <div className="workspace-soundboard-head">
              <span className="workspace-soundboard-title">Soundboard Studio</span>
              <span className="workspace-soundboard-hint">Record · preview · health-check — off-call only</span>
            </div>
            <GreetingsPanel onEditModeChange={setIsEditingBg} />
          </div>
        </main>
      )}

      {isActive && (
        <main className={`main-content ${isNotesOpen ? 'notes-open' : ''}`}>
          <div className="transcription-pane" data-guide="transcript">
            <TranscriptionBoard 
              captions={captions} 
              isActive={isActive} 
              isBreakActive={isBreakActive}
              connectionState={connectionState}
              onClearAll={clearCaptions}
              onReconnect={handleRecovery}
              lastDataTime={lastDataTime}
            />
          </div>
          {isNotesOpen && !isEditingBg && (
            <div className="tools-column notes-open">
              <div className="glass-panel tools-notes" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: isActive && callFocusMode ? '200px' : undefined }}>
                {(!isActive || !callFocusMode) && <DictionaryTool />}
                <NotePad />
              </div>
            </div>
          )}
        </main>
      )}

      <div className="habit-dock">
        <DeskExerciseWidget />
        <RosaryWidget />
        <MealTrackerWidget />
        <ChoreTrackerWidget />
        {!isActive && (
          <WorkspaceViewSwitcher
            view={workspaceView}
            onCycle={cycleWorkspaceView}
            variant="dock"
            showHint={showStudioHint}
          />
        )}
        <button
          data-guide="notes"
          className={`habit-dock-btn${isNotesOpen ? ' is-active' : ''}`}
          onClick={() => setIsNotesOpen(o => !o)}
          title="Quick Notes"
          style={{ color: isNotesOpen ? '#38bdf8' : 'rgba(255,255,255,0.65)', fontSize: '0.85rem' }}
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
      <LanguageProvider>
        <SessionProvider>
          <AppGuideProvider>
            <Dashboard />
          </AppGuideProvider>
        </SessionProvider>
      </LanguageProvider>
    </AudioSettingsProvider>
  );
}

export default App;

