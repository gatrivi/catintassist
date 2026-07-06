import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StatNumber } from './StatNumber';
import { LiveRollingNumber } from './LiveRollingNumber';
import { useRewardAudio } from '../hooks/useRewardAudio';
import { useSession } from '../contexts/SessionContext';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { formatTime } from './HeaderWidgets';
import {
  CoffeeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  FocusIcon,
  FocusOffIcon,
  GameIcon,
  HelpIcon,
  KeyIcon,
  MicIcon,
  MoonIcon,
  NotesIcon,
  PauseIcon,
  SignalIcon,
  SignalOffIcon,
  StopIcon,
  TargetIcon,
  ToolsIcon,
  ZapIcon,
} from './HeaderIcons';
import { buildHeaderStripMetrics } from '../utils/headerMetrics';
import {
  isIdleTipsMuted,
  pickRotatingAdvice,
  readIdleTipPrefs,
} from '../utils/offCallIdleMessages';
import { DialGoalSelector } from './DialGoalSelector';
import { ElementHintTarget, useElementHint, buildHintPayload } from './ElementHint';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { MonthHeatmap } from './MonthHeatmap';
import { TimeEditModal } from './TimeEditModal';
import { GameScoreboard } from './GameScoreboard';
import { AppGuideButton } from './AppGuide';
import { SettingsButton } from './SettingsButton';
import { WorkspaceViewSwitcher } from './WorkspaceViewSwitcher';
import { ConnectInterpretButton } from './ConnectInterpretButton';
import { ConnectionDiagnosticsBar } from './ConnectionDiagnosticsBar';
import { AudioRouteStatusBar } from './AudioRouteStatusBar';
import { HeaderMetricsStrip } from './HeaderMetricsStrip';
import { playTestToneLocal, playTestToneSink } from '../utils/audioSelfTest';
import { APP_VERSION_LABEL } from '../constants/version';
import { SlotMicroValue } from './SlotMicroValue';
import { hasConfiguredDeepgramKey, isRememberExpired, needsUserSuppliedDeepgramKey } from '../utils/deepgramRuntimeKey';
import { dispatchOpenDeepgramSettings } from '../utils/deepgramSettingsPrompt';
import {
  canUseTabCapture,
  isLikelyEmbeddedPreviewBrowser,
} from '../utils/audioSourceManager';
import {
  isComponentVisible,
  shouldShowProgressStack,
  useComponentVisibilityRefresh,
} from '../utils/componentVisibility';
import {
  getPresetConfig,
  PRESET_LABELS,
} from '../utils/scoreboardLayout';
import {
  loadLanguagePair,
  formatPairShort,
  LANG_PAIR_CHANGED_EVENT,
} from '../utils/languageConfig';

const OFF_CALL_METRICS_EXPANDED_KEY = 'catint_off_call_metrics_expanded_v1';
const CelebrationParticles = ({ type, label, coins, onDismiss }) => {
  const [isClosing, setIsClosing] = useState(false);
  const emojis = ['🪙', '🪙', '💸', '💵', '💰', '💎'];
  const spread = type === 'month' ? 800 : (type === 'day' ? 600 : 350);
  const originX = type === 'month' ? '0px' : '-185px';
  const audioEngine = useProgressiveAudio();

  // Cap particles
  const safeCoinCount = Math.min(60, coins);

  useEffect(() => {
    if (isClosing) return;
    // ONLY play the rapid coin loop for Day/Month jackpots. 
    // Standard calls now use the clean Denomination Summary sounds.
    if (type === 'call') return; 

    audioEngine.initAudio();
    const iv = setInterval(() => { audioEngine.playCoin(); }, 150);
    return () => clearInterval(iv);
  }, [isClosing, audioEngine, type]);
  
  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => onDismiss(), 250);
  };

  return (
    <div style={{ position: 'absolute', inset: -50, pointerEvents: 'auto', cursor: 'pointer', zIndex: 100, animation: isClosing ? 'fadeOutFast 0.25s forwards' : 'none' }} onClick={handleDismiss}>
      {Array.from({ length: safeCoinCount }).map((_, i) => (
        <span key={i} style={{
          position: 'absolute', left: '50%', top: '50%', fontSize: `${0.8 + Math.random() * 1.2}rem`,
          animation: `coinVacuum 1.8s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
          animationDelay: `${Math.random() * 0.4}s`,
          '--origin-x': originX, '--origin-y': '0px',
          '--start-x': `calc(${originX} + ${(Math.random() - 0.5) * spread * 1.5}px)`, 
          '--start-y': `${-Math.random() * (spread * 1.2)}px`,
          filter: `drop-shadow(0 0 ${2 + Math.random() * 8}px gold)`,
          zIndex: Math.floor(Math.random() * 10)
        }}>{emojis[Math.floor(Math.random() * emojis.length)]}</span>
      ))}
      <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: '1.4rem', fontWeight: 900,
          color: type === 'day' || type === 'month' ? '#fcd34d' : '#6ee7b7',
          textShadow: `0 0 30px ${type === 'day' ? '#f59e0b' : '#10b981'}`,
          whiteSpace: 'nowrap', animation: `textFloatTarget 2.5s ease-out forwards`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          zIndex: 100
      }}>
        {label.includes('AR$') ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span>{label.split('AR$')[0]}</span>
            <StatNumber value={label.split('AR$')[1].replace(/[^\d]/g, '')} prefix="AR$" size="lg" format={false} />
          </div>
        ) : label}
        <div style={{ fontSize: '0.5rem', fontWeight: 400, color: 'rgba(255,255,255,0.7)', textShadow: 'none', marginTop: '0.2rem' }}>[Click to Skip]</div>
      </div>
    </div>
  );
};

const StateIndicators = ({ state, breakMinutes, isZombie, silenceCount }) => {
  const showSilenceTimer = silenceCount > 30;
  if (state === 'call') {
    return (
      <div className="emoji-money" style={{ fontSize: '1.1rem', marginRight: '0.2rem' }}>💰</div>
    );
  }
  if (state === 'break') {
    // 90 mins total budget. Each cup = 10 mins approx (total 9 cups)
    const cups = 9;
    const spentCups = Math.min(cups, Math.floor(breakMinutes / 10));
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <div className="resource-drain" title={`Break Budget: ${Math.floor(breakMinutes)}/90m used`} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
          {Array.from({ length: cups }).map((_, i) => (
            <span key={i} className={`resource-item ${i < spentCups ? 'spent' : ''}`} style={{ fontSize: '0.85rem', lineHeight: 1 }}>
              {i < spentCups ? '🍵' : '☕'}
            </span>
          ))}
        </div>
        <span
          style={{
            fontSize: '0.65rem',
            color: '#fb923c',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            minWidth: '5.6ch',
            visibility: showSilenceTimer ? 'visible' : 'hidden',
            display: 'inline-block',
            textAlign: 'center',
          }}
        >
          {formatTime(silenceCount)}
        </span>
      </div>
    );
  }
  // Zombie
  if (isZombie) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <div style={{ animation: 'pulseWarning 1s infinite', fontSize: '1rem', color: '#f59e0b' }}>🤖</div>
        <span
          style={{
            fontSize: '0.65rem',
            color: '#f59e0b',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            minWidth: '5.6ch',
            visibility: showSilenceTimer ? 'visible' : 'hidden',
            display: 'inline-block',
            textAlign: 'center',
          }}
        >
          {formatTime(silenceCount)}
        </span>
      </div>
    );
  }
  // Avail
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{ animation: 'encouragePulse 3s infinite', fontSize: '1rem', color: '#fb923c' }}>
        {Math.floor(Date.now() / 2000) % 2 === 0 ? '📡' : '⏳'}
      </div>
      <span
        style={{
          fontSize: '0.75rem',
          color: '#fb923c',
          fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          background: 'rgba(251, 146, 60, 0.1)',
          padding: '0 4px',
          borderRadius: '4px',
          minWidth: '6.6ch',
          visibility: showSilenceTimer ? 'visible' : 'hidden',
          display: 'inline-block',
          textAlign: 'center',
        }}
      >
        {formatTime(silenceCount)}
      </span>
    </div>
  );
};

const buildOffCallStatus = ({
  settingsOpen,
  vaultNeedsDecrypt,
  apiKeyMissingNoVault,
  vaultStatus,
  connectionState,
  connectionMessage,
  apiKeyMissing,
  isBreakActive,
  isZombieCall,
  audioAttached,
  tabStreamReady,
  micTestMode,
  slackText,
}) => {
  const { level: idleLevel, snoozedUntil } = readIdleTipPrefs();
  const idleMuted = isIdleTipsMuted({ level: idleLevel, snoozedUntil });

  if (settingsOpen && vaultNeedsDecrypt) {
    return 'Unlock Deepgram — enter password in Settings (gear, top-right)';
  }
  if (settingsOpen && apiKeyMissingNoVault) {
    return 'Paste your Deepgram key in Settings (gear, top-right)';
  }
  if (vaultStatus === 'unlocking') return 'Unlocking key…';
  if (connectionState === 'connecting') {
    return connectionMessage || 'Deepgram connecting…';
  }
  if (connectionState === 'error') {
    return (
      'Deepgram isn\'t working right now (engine for interpretation). ' +
      'Press ⚡ Zap, then check Settings key + Deepgram WebSocket + tab audio/mic permissions.'
    );
  }
  if (isRememberExpired() && apiKeyMissing) {
    return 'Password expired — open Settings (gear, top-right)';
  }
  if (vaultNeedsDecrypt) {
    return 'Deepgram locked — open Settings or press Decrypt';
  }
  if (apiKeyMissingNoVault) {
    return 'No Deepgram key yet — open Settings (gear, top-right)';
  }
  if (isBreakActive) {
    return 'On break — press the green button when you return';
  }
  if (!micTestMode && !audioAttached && !canUseTabCapture()) {
    return isLikelyEmbeddedPreviewBrowser()
      ? 'Cursor preview cannot share tabs — open in Chrome/Edge, or press 🎤 mic mode'
      : 'This browser cannot share tabs — use Chrome/Edge, or press 🎤 mic mode';
  }
  if (isZombieCall) {
    return `Call still active — press Re-attach (timer saved) · ${slackText}`;
  }
  if (audioAttached) {
    return micTestMode
      ? 'Mic connected — press the green button to start interpreting'
      : 'Tab connected — press the green button to start interpreting';
  }

  // Work-hours: if tab stream is detached, keep the user out of “blocked when call rings”.
  const h = new Date().getHours();
  const isWorkHours = h >= 9 && h < 18;
  if (!micTestMode && !isZombieCall && !tabStreamReady && isWorkHours) {
    return 'Tab disconnected — reconnect now to avoid missing the first lines';
  }
  const micHint = micTestMode
    ? 'Mic mode ON — press the green button to connect the microphone'
    : 'Tab mode — press the green button to connect the other browser tab';

  if (idleMuted) {
    return `${micHint}. Then press it again to start interpreting.`;
  }

  return `${pickRotatingAdvice()} · ${micHint}`;
};

const SessionControlsSticky = React.memo(({
  isActive,
  isBreakActive,
  isZombieCall,
  versionLabel = "",
  apiKeyMissing,
  vaultNeedsDecrypt,
  apiKeyMissingNoVault = false,
  audioAttached,
  micTestMode,
  setMicTestMode,
  connectionState,
  connectionMessage,
  connectProgress,
  apiKeyRejected,
  showEndDayButton,
  onEndDay,

  // Connect UX
  connectFlash,
  connectLabel,
  connectSingleTitle,
  connectDoubleTitle,
  connectOnSingle,
  connectOnDouble,
  requireDoubleTapIndicator,
  pendingDoubleTapTitle,
  onArmDoubleTap,

  settingsOpen = false,
  vaultStatus = 'idle',

  // Break
  minutesSinceLastBreak,
  shouldBreakNudge,
  breakNudgeStage,
  stopBreak,
  onStartBreak,

  // Call controls
  handleStop,
  isHold,
  setIsHold,
  disableZap,
  isZapping,
  onReconnectStream,

  // Call micro bar
  silenceCount,
  lastEnglishActivityTime,
  sessionSeconds,
  sessionArsLive,
  totalOffCallSeconds = 0,
  callModeExpanded,
  setCallModeExpanded,
  isNotesOpen,
  setIsNotesOpen,

  tabStreamReady = false,
  cableStreamReady = false,
  lastDataTime = 0,
  onOpenSoundboard,
  soundboardOpen = false,
  onOpenGoalDial,

  // Audio route UX props (passed into AudioRouteStatusBar)
  configuredAudioSourceMode = "tab",
  attachedAudioSourceMode = "tab",
  virtualCableFailure = null,
  onReconnectAudioSource,
  onSwitchToTabShare,

  sttLanguage = 'auto',
  onToggleLanguage,
  onOpenLanguageSettings,
  languagePairLabel,
}) => {
  const showConnecting = isActive && connectionState !== 'connected';
  const isConnectionError = connectionState === 'error';
  const slackText = `SLACK ${formatTime(silenceCount)}`;

  const offCallStatusText = buildOffCallStatus({
    settingsOpen,
    vaultNeedsDecrypt,
    apiKeyMissingNoVault,
    vaultStatus,
    connectionState,
    connectionMessage,
    apiKeyMissing,
    isBreakActive,
    isZombieCall,
    audioAttached,
    tabStreamReady,
    micTestMode,
    slackText,
  });

  const longPressRef = useRef(null);
  const didLongPressRef = useRef(false);

  const startPress = () => {
    didLongPressRef.current = false;
    longPressRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      onOpenLanguageSettings?.();
    }, 450);
  };

  const endPress = () => {
    clearTimeout(longPressRef.current);
  };

  const handleLangClick = () => {
    if (didLongPressRef.current) return;
    onToggleLanguage?.();
  };

  const toggleQuickNotes = () => {
    setIsNotesOpen((open) => {
      const next = !open;
      if (next) {
        window.setTimeout(() => {
          window.dispatchEvent(new Event('catint_focus_notes'));
        }, 80);
      }
      return next;
    });
  };

  const langPairShort = (languagePairLabel || 'EN|ES').replace(/\s+/g, '');
  const langBtnTitle = `STT ${langPairShort} · ${sttLanguage === 'auto' ? 'auto-detect' : sttLanguage === 'left' ? 'forcing left column' : 'forcing right column'} · Tap: cycle STT · Hold: pair settings`;

  return (
    <>
      <div className="session-controls-sticky-row">
      <div className="session-controls-left-cluster" style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
        <ElementHintTarget
          elementId="header-app-logo-btn"
          heading="App logo"
          body={`CatIntAssist build info. Version: ${APP_VERSION_LABEL}`}
          color="#a855f7"
        >
        <button
          id="header-app-logo-btn"
          type="button"
          className="btn-icon tiny-btn app-logo-btn"
          aria-label={`CatIntAssist ${APP_VERSION_LABEL}`}
        >
          <img
            className="app-logo-img"
            src={`${process.env.PUBLIC_URL || ''}/favicon-96x96.png`}
            alt=""
            width={22}
            height={22}
          />
        </button>
        </ElementHintTarget>

        {!isActive ? (
          <>
            <ConnectInterpretButton
              onSingle={connectOnSingle}
              onDouble={connectOnDouble}
              flash={connectFlash}
              disabled={false}
              size="top"
              label={connectLabel}
              requireDoubleTapIndicator={requireDoubleTapIndicator}
              onArmDoubleTap={onArmDoubleTap}
              pendingDoubleTapTitle={pendingDoubleTapTitle}
              singleTitle={connectSingleTitle}
              doubleTitle={connectDoubleTitle}
            />

            <ElementHintTarget
              elementId="header-mic-test-btn"
              guideKey="mic-test"
              heading="Mic test mode"
              body="Mic ON: Connect uses your microphone (no tab picker). Mic OFF: Connect captures interpreter tab audio (Share audio)."
              color="#f59e0b"
            >
            <button
              id="header-mic-test-btn"
            data-guide="mic-test"
            type="button"
            className="btn-icon tiny-btn"
            onClick={() => setMicTestMode?.(!micTestMode)}
            style={{
              width: '26px',
              height: '26px',
              fontSize: '0.7rem',
              background: isConnectionError
                ? 'rgba(239, 68, 68, 0.25)'
                : micTestMode
                  ? 'rgba(245, 158, 11, 0.25)'
                  : 'rgba(255,255,255,0.06)',
              border: isConnectionError
                ? '1px solid rgba(239, 68, 68, 0.55)'
                : micTestMode
                  ? '1px solid rgba(245, 158, 11, 0.55)'
                  : '1px solid rgba(255,255,255,0.1)',
              boxShadow: isConnectionError
                ? '0 0 10px rgba(239, 68, 68, 0.35)'
                : micTestMode
                  ? '0 0 8px rgba(245, 158, 11, 0.35)'
                  : 'none',
            }}
            title={micTestMode ? 'Mic ON — Connect uses microphone (no tab picker)' : 'Mic OFF — Connect captures interpreter tab audio (Share audio)'}
            aria-pressed={micTestMode}
          >
            <MicIcon size={14} />
          </button>
            </ElementHintTarget>

        {onToggleLanguage && (
          <ElementHintTarget
            elementId="header-lang-pair-btn"
            guideKey="language-pair"
            heading="Language pair / STT mode"
            body={langBtnTitle}
            color="#34d399"
          >
          <button
            id="header-lang-pair-btn"
            data-guide="language-pair"
            type="button"
            className="btn-icon tiny-btn"
            onPointerDown={startPress}
            onPointerUp={endPress}
            onPointerCancel={endPress}
            onPointerLeave={endPress}
            onClick={handleLangClick}
            style={{
              height: '26px',
              padding: '0 6px',
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              background: isConnectionError
                ? 'rgba(239, 68, 68, 0.25)'
                : sttLanguage === 'left'
                  ? 'rgba(239, 68, 68, 0.25)'
                  : sttLanguage === 'right'
                    ? 'rgba(16, 185, 129, 0.25)'
                    : 'rgba(255,255,255,0.06)',
              border: isConnectionError
                ? '1px solid rgba(239, 68, 68, 0.55)'
                : sttLanguage === 'left'
                  ? '1px solid rgba(239, 68, 68, 0.55)'
                  : sttLanguage === 'right'
                    ? '1px solid rgba(16, 185, 129, 0.55)'
                    : '1px solid rgba(255,255,255,0.1)',
            }}
            title={langBtnTitle}
          >
            {langPairShort}
          </button>
          </ElementHintTarget>
        )}

        {!isActive && onOpenGoalDial && (
          <ElementHintTarget
            elementId="header-goal-btn"
            guideKey="goal-wheel"
            heading="Weekly goal wheel"
            body="Weekly hours commitment — tap to open goal picker wheel."
            color="#a855f7"
          >
          <button
            id="header-goal-btn"
            data-guide="goal-wheel"
            type="button"
            className="btn-icon tiny-btn"
            onClick={onOpenGoalDial}
            style={{
              width: '26px',
              height: '26px',
              fontSize: '0.75rem',
              background: isConnectionError
                ? 'rgba(239, 68, 68, 0.22)'
                : 'rgba(139, 92, 246, 0.18)',
              border: isConnectionError
                ? '1px solid rgba(239, 68, 68, 0.55)'
                : '1px solid rgba(167, 139, 250, 0.45)',
            }}
            title="Weekly hours commitment — tap to open goal picker wheel"
          >
            <TargetIcon size={14} />
          </button>
          </ElementHintTarget>
        )}

            <ElementHintTarget
              elementId="header-key-vault-btn"
              heading="Deepgram key vault"
              body="Open settings to manage your Deepgram API key (encrypted vault)."
              color="#10b981"
            >
            <button
              id="header-key-vault-btn"
              type="button"
              className="btn-emoji"
              onClick={() => {
                try {
                  window.dispatchEvent(new CustomEvent("cat_show_settings"));
                } catch (_) {}
              }}
              style={{
                background: apiKeyRejected
                  ? "rgba(16,185,129,0.16)"
                  : "rgba(16,185,129,0.08)",
                color: apiKeyRejected
                  ? "#d1fae5"
                  : "rgba(209,250,229,0.55)",
                width: "30px",
                height: "30px",
                borderRadius: "8px",
                border: apiKeyRejected
                  ? "1px solid rgba(16,185,129,0.35)"
                  : "1px solid rgba(16,185,129,0.22)",
                boxShadow: apiKeyRejected ? "0 0 12px rgba(16,185,129,0.25)" : "none",
              }}
              title="Deepgram Key Vault"
              aria-label="Deepgram Key Vault"
            >
              <KeyIcon size={14} />
            </button>
            </ElementHintTarget>
          </>
        ) : (
          <>
            <ElementHintTarget
              elementId="header-stop-btn"
              guideKey="stop"
              heading="Stop / disconnect"
              body="End the current interpretation session and disconnect Deepgram."
              color="#ef4444"
            >
            <button
              id="header-stop-btn"
              data-guide="stop"
              className="btn-emoji"
              onClick={handleStop}
              style={{ background: '#ef4444', color: '#fff', width: '30px', height: '30px' }}
              title="STOP / DISCONNECT"
            >
              <StopIcon size={14} />
            </button>
            </ElementHintTarget>
            <ElementHintTarget
              elementId="header-hold-btn"
              heading="Hold"
              body="Pause interpretation without ending the call. Shows H when hold is active."
              color="#f59e0b"
            >
            <button
              id="header-hold-btn"
              className="btn btn-condensed"
              onClick={() => setIsHold(!isHold)}
              style={{
                background: isHold ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                height: '30px',
                padding: '0',
                width: '30px',
                fontSize: '0.65rem',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {isHold ? 'H' : <PauseIcon size={14} />}
            </button>
            </ElementHintTarget>
            <ElementHintTarget
              elementId="header-zap-btn"
              heading="Zap reconnect"
              body={disableZap ? 'ZAP disabled — stream is healthy.' : 'Force-reconnect the audio stream when STT goes stale.'}
              color="#ef4444"
            >
            <button
              id="header-zap-btn"
              className={`btn-emoji ${isZapping ? 'zap-active' : ''}`}
              onClick={disableZap ? undefined : () => onReconnectStream()}
              disabled={disableZap}
              style={{
                background: '#ef4444',
                width: '30px',
                height: '30px',
                opacity: disableZap ? 0.25 : 1,
              }}
              title={disableZap ? 'ZAP disabled' : 'ZAP - Reconnect Audio Stream'}
            >
              <ZapIcon size={14} />
            </button>
            </ElementHintTarget>
          </>
        )}

        <ElementHintTarget
          elementId="header-break-btn"
          heading="Break"
          body="Start or end a break. Disabled during active calls. Orange nudge after 90m without break."
          color="#fb923c"
        >
        <button
          id="header-break-btn"
          className="btn-emoji"
          onClick={isBreakActive ? stopBreak : onStartBreak}
          style={{
            background: '#fb923c',
            color: '#fff',
            height: '30px',
            opacity: isActive ? 0.35 : 1,
            width: shouldBreakNudge ? '86px' : '30px',
            padding: shouldBreakNudge ? '0 8px' : '0',
            fontSize: shouldBreakNudge ? '0.62rem' : undefined,
            borderRadius: shouldBreakNudge ? '8px' : undefined,
          }}
          disabled={isActive}
          title="BREAK"
        >
          {shouldBreakNudge ? (
            <span className="header-break-nudge">
              <CoffeeIcon size={14} />
              <span>BREAK</span>
            </span>
          ) : (
            <CoffeeIcon size={14} />
          )}
        </button>
        </ElementHintTarget>

        {showEndDayButton && (
          <ElementHintTarget
            elementId="header-end-day-btn"
            heading="End day"
            body="Close out the work day and reset daily tracking."
            color="#8b5cf6"
          >
          <button
            id="header-end-day-btn"
            className="btn-emoji"
            onClick={onEndDay}
            style={{ background: '#8b5cf6', color: '#fff', width: '30px', height: '30px' }}
            title="END DAY"
          >
            <MoonIcon size={14} />
          </button>
          </ElementHintTarget>
        )}
      </div>

      {isActive ? (
        <div className="call-micro-bar-center">
          <span
            className="call-micro-bar-slot call-micro-bar-hold"
            title="Non-doctor hold time (resets on English speech)"
            style={{ visibility: !showConnecting && silenceCount > 30 ? 'visible' : 'hidden' }}
          >
            {formatTime(Math.max(0, Math.floor((Date.now() - lastEnglishActivityTime) / 1000)))}
          </span>

          <span className="call-micro-bar-slot call-micro-bar-timer">
            {showConnecting ? (
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#f59e0b' }}>
                {connectionMessage || 'Connecting…'}
              </span>
            ) : (
              <SlotMicroValue text={formatTime(sessionSeconds)} />
            )}
          </span>

          {!showConnecting && (
            <span className="call-micro-bar-slot call-micro-bar-earnings">
              <SlotMicroValue text={`AR$${sessionArsLive}`} />
            </span>
          )}

          {showConnecting && (
            <span
              className="call-micro-bar-slot call-micro-bar-disconnected"
              title="No audio packets received — slacking off time"
              style={{
                fontFamily: "var(--font-mono)",
                color: "#fbbf24",
                fontSize: "0.7rem",
                fontWeight: 900,
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
                maxWidth: "10ch",
              }}
            >
              {slackText}
            </span>
          )}

          {!showConnecting && (
            <span
              className="call-micro-bar-slot call-micro-bar-nudge"
              title="Working 90+ minutes without a break"
              style={{ visibility: minutesSinceLastBreak > 90 ? 'visible' : 'hidden' }}
            >
              🍕 {Math.floor(minutesSinceLastBreak)}m
            </span>
          )}
          <span className="call-micro-bar-slot call-micro-bar-reserved" aria-hidden="true" />
        </div>
      ) : (
        <div className="off-call-status-column" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {!(connectionState === 'error' || connectionState === 'connecting') && (
            <div className="call-micro-bar-center off-call-status-bar" title="Connection status">
              <span
                className="call-micro-bar-slot call-micro-bar-status"
                style={{
                  gridColumn: '1 / -1',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: isZombieCall
                    ? '#fbbf24'
                    : audioAttached
                      ? '#34d399'
                      : '#9dffed',
                }}
              >
                {offCallStatusText}
              </span>
              {!isActive && (
                <span
                  className="call-micro-bar-slot"
                  style={{
                    gridColumn: '1 / -1',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    color: '#fdba74',
                    opacity: 0.95,
                    textShadow: '0 0 10px rgba(251,191,36,0.25)',
                  }}
                  title="Off-call elapsed today (avail + breaks)"
                >
                  🚪 {formatTime(Math.floor(totalOffCallSeconds))}
                </span>
              )}
            </div>
          )}
          <ConnectionDiagnosticsBar
            connectProgress={connectProgress}
            connectionState={connectionState}
            connectionMessage={connectionMessage}
            compact
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '3px',
          alignItems: 'center',
          flexShrink: 0,
          position: 'relative',
          zIndex: 320, // ensure gear/help stay above diagnostics chip
        }}
      >
        {isActive && !callModeExpanded && (
          <ElementHintTarget
            elementId="header-expand-btn"
            heading="Expand header"
            body="Show full header controls during an active call."
            color="#94a3b8"
          >
          <button
            id="header-expand-btn"
            className="btn-icon tiny-btn"
            onClick={() => setCallModeExpanded(true)}
            style={{ width: '24px', height: '24px', fontSize: '0.7rem' }}
            title="Expand Header"
          >
            <ChevronUpIcon size={14} />
          </button>
          </ElementHintTarget>
        )}
        {isActive && callModeExpanded && (
          <ElementHintTarget
            elementId="header-compact-btn"
            heading="Compact header"
            body="Minimize header to maximize transcription space during calls."
            color="#94a3b8"
          >
          <button
            id="header-compact-btn"
            className="btn-icon tiny-btn"
            onClick={() => setCallModeExpanded(false)}
            style={{ width: '24px', height: '24px', fontSize: '0.7rem' }}
            title="Compact Header"
          >
            <ChevronDownIcon size={14} />
          </button>
          </ElementHintTarget>
        )}
        <ElementHintTarget
          elementId="header-quick-notes-btn"
          guideKey="notes"
          heading="Quick notes"
          body="Toggle the quick notes sidebar for jotting during calls."
          color="#f43f5e"
        >
        <button
          id="header-quick-notes-btn"
          className="btn-icon tiny-btn"
          onClick={toggleQuickNotes}
          style={{ opacity: isNotesOpen ? 1 : 0.45, width: '24px', height: '24px', fontSize: '0.75rem' }}
          title="Quick Notes"
        >
          <NotesIcon size={14} />
        </button>
        </ElementHintTarget>
        <SettingsButton />
        <AppGuideButton />
      </div>
      </div>
      {!(isActive && !callModeExpanded) && (
        <AudioRouteStatusBar
          micTestMode={micTestMode}
          tabStreamReady={tabStreamReady}
          cableStreamReady={cableStreamReady}
          configuredAudioSourceMode={configuredAudioSourceMode}
          attachedAudioSourceMode={attachedAudioSourceMode}
          virtualCableFailure={virtualCableFailure}
          audioAttached={audioAttached}
          connectionState={connectionState}
          connectProgress={connectProgress}
          lastDataTime={lastDataTime}
          isActive={isActive}
          isZombieCall={isZombieCall}
          onReconnectStream={onReconnectStream}
          onReconnectAudioSource={onReconnectAudioSource}
          onSwitchToTabShare={onSwitchToTabShare}
          onTestLocal={() => playTestToneLocal()}
          onTestRoute={async () => {
            const sinkId = localStorage.getItem('CATINTASSIST_SINK_ID');
            if (!sinkId) {
              document.getElementById('audio-route-sink-select')?.focus();
              return;
            }
            await playTestToneSink(sinkId);
          }}
          onOpenSoundboard={!isActive ? onOpenSoundboard : undefined}
          soundboardOpen={soundboardOpen}
          compact
        />
      )}
    </>
  );
});

export const DashboardHeader = ({
  onAttachAudio,
  onAttachAudioFresh,
  onStartCall,
  onStopAudio,
  onReconnectStream,
  versionLabel = "",
  sttLanguage,
  onToggleLanguage,
  onRecovery,
  connectionState,
  connectionMessage,
  connectProgress,
  lastDataTime,
  micTestMode = false,
  setMicTestMode,
  offCallWorkspace = null,
  onCycleWorkspace,
  showStudioHint = false,
  onConnectAnotherTab,
  tabStreamReady = false,
  cableStreamReady = false,
  configuredAudioSourceMode = "tab",
  attachedAudioSourceMode = "tab",
  virtualCableFailure = null,
  audioAttached = false,
  apiKeyRejected = false,
  settingsOpen = false,
  onOpenSoundboard,
  soundboardOpen = false,
  onReconnectAudioSource,
  onSwitchToTabShare,
}) => {
  const { isActive, sessionSeconds, sessionEarnings, stats, updateStat, stopSession, endDay, RATE_PER_MINUTE, arsRate, setArsRate, isBreakActive, breakSeconds, startBreak, stopBreak, availSeconds, isEditingScoreboard, setIsEditingScoreboard, visibleCards, toggleCard, visibleMetrics, toggleMetric, scoreboardPreset, applyScoreboardPreset, isNotesOpen, setIsNotesOpen, isToolbarVisible, setIsToolbarVisible, isHeatmapOpen, setIsHeatmapOpen, isZombieCall, isScoreboardHelpVisible, setIsScoreboardHelpVisible, isHold, setIsHold, dailyTimeline, historyTimeline, dailyLog, lastActivityTime, lastEnglishActivityTime, isCallDetectionEnabled, setIsCallDetectionEnabled, callFocusMode, setCallFocusMode, minutesSinceLastBreak, requestHipaaDisconnectGrace, vaultStatus } = useSession();

  const headerMinimal = !isActive && offCallWorkspace === 'soundboard';
  const offCallScoreboardView = !isActive && offCallWorkspace === 'scoreboard';
  const studioView = offCallWorkspace === 'soundboard' ? 'soundboard' : 'scoreboard';

  useComponentVisibilityRefresh();
  const visCtx = { isActive, isZombieCall };
  const [languagePair, setLanguagePair] = useState(loadLanguagePair);
  useEffect(() => {
    const onPairChange = (e) => setLanguagePair(e.detail || loadLanguagePair());
    window.addEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
    return () => window.removeEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
  }, []);
  const languagePairLabel = formatPairShort(languagePair);
  const showProgressStack = shouldShowProgressStack(scoreboardPreset, visCtx);
  const showExpandedIncome = isComponentVisible('expanded_income_cards', visCtx) && !offCallScoreboardView;
  const showNumericGrid = isComponentVisible('scoreboard_numeric_grid', visCtx);

  const helpStyle = isScoreboardHelpVisible ? { outline: '1px dashed #ef4444', position: 'relative' } : {};
  const HelpLabel = ({ text }) => isScoreboardHelpVisible ? (
    <div style={{ position: 'absolute', top: '-8px', left: '4px', fontSize: '0.45rem', background: '#ef4444', color: 'white', padding: '0 3px', borderRadius: '2px', zIndex: 100, pointerEvents: 'none', fontWeight: 'bold', textTransform: 'uppercase', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{text}</div>
  ) : null;
  const MetricPct = ({ children }) => (
    <div className="metric-cell-pct">{children}</div>
  );

  const showMetric = (key) => isEditingScoreboard || visibleMetrics[key];

  const MetricVisibilityToggle = ({ metricKey }) => isEditingScoreboard ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggleMetric(metricKey); }}
      style={{
        position: 'absolute', top: 2, right: 2, zIndex: 20,
        background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 3, fontSize: '0.5rem', cursor: 'pointer', padding: '0 3px',
        opacity: visibleMetrics[metricKey] ? 1 : 0.45,
      }}
      title={visibleMetrics[metricKey] ? 'Hide cell' : 'Show cell'}
    >
      {visibleMetrics[metricKey] ? '👁' : '🚫'}
    </button>
  ) : null;

  const CardVisibilityToggle = ({ cardKey }) => isEditingScoreboard ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggleCard(cardKey); }}
      style={{
        position: 'absolute', top: 2, right: 2, zIndex: 20,
        background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 3, fontSize: '0.5rem', cursor: 'pointer', padding: '0 3px',
        opacity: visibleCards[cardKey] ? 1 : 0.45,
      }}
      title={visibleCards[cardKey] ? 'Hide card' : 'Show card'}
    >
      {visibleCards[cardKey] ? '👁' : '🚫'}
    </button>
  ) : null;

  const toggleToolbar = useCallback(() => {
    const next = !isToolbarVisible;
    setIsToolbarVisible(next);
    if (next) {
      setIsNotesOpen(true);
      window.setTimeout(() => {
        window.dispatchEvent(new Event('catint_focus_notes'));
      }, 80);
    }
  }, [isToolbarVisible, setIsToolbarVisible, setIsNotesOpen]);

  const toggleQuickNotes = useCallback(() => {
    setIsNotesOpen((open) => {
      const next = !open;
      if (next) {
        window.setTimeout(() => {
          window.dispatchEvent(new Event('catint_focus_notes'));
        }, 80);
      }
      return next;
    });
  }, [setIsNotesOpen]);
  const { outputDevices, inputDevices, selectedSinkId, selectedMicId, changeSinkId, changeMicId, fetchDevices } = useAudioSettings();
  const audioEngine = useProgressiveAudio();
  const { playChaChing } = useRewardAudio();

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [celebration, setCelebration] = useState(null); // Keep celebration for sound logic
  const [isTodayDialOpen, setIsTodayDialOpen] = useState(false);
  const [displayBounty, setDisplayBounty] = useState(0);
  const [isBountyAnimating, setIsBountyAnimating] = useState(false);
  const [timeEditMode, setTimeEditMode] = useState(null); // 'call' | 'break' | null
  const [scoreView, setScoreView] = useState(() => getPresetConfig(scoreboardPreset).scoreView || 'game'); // 'game' | 'numbers'
  const [silenceCount, setSilenceCount] = useState(0);

  useEffect(() => {
    const cfg = getPresetConfig(scoreboardPreset);
    if (cfg?.scoreView) setScoreView(cfg.scoreView);
  }, [scoreboardPreset]);

  useEffect(() => {
    if (isActive && scoreboardPreset === 'minimal') setIsCollapsed(true);
  }, [isActive, scoreboardPreset]);
  const [hoveredTimelineEvent, setHoveredTimelineEvent] = useState(null);
  const { show: showElementHint, hide: hideElementHint } = useElementHint();
  const [isZapping, setIsZapping] = useState(false);
  const handleZap = useCallback(async () => {
    setIsZapping(true);
    try {
      await onReconnectStream?.();
    } finally {
      setTimeout(() => setIsZapping(false), 1200);
    }
  }, [onReconnectStream]);

  const weeklyGoalHours = Math.round((stats.goalMinutes * 5) / (60 * 22));

  const [showAsHours, setShowAsHours] = useState(false);
  const [rateView, setRateView] = useState('effective'); // 'effective' | 'active'
  const [overtimeMode, setOvertimeMode] = useState('tail'); // 'tail' | 'under'
  const [callModeExpanded, setCallModeExpanded] = useState(false); // User can pin full header during calls
  const [offCallMetricsExpanded, setOffCallMetricsExpanded] = useState(() => {
    try {
      return localStorage.getItem(OFF_CALL_METRICS_EXPANDED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleOffCallMetricsExpanded = useCallback(() => {
    setOffCallMetricsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(OFF_CALL_METRICS_EXPANDED_KEY, next ? 'true' : 'false');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const headerCallCompact = isActive && !callModeExpanded;

  const expandOffCallMetrics = useCallback(() => {
    setOffCallMetricsExpanded(true);
    try {
      localStorage.setItem(OFF_CALL_METRICS_EXPANDED_KEY, 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const handleQuickScoreView = useCallback((view) => {
    setScoreView(view);
    expandOffCallMetrics();
  }, [expandOffCallMetrics]);

  useEffect(() => {
    const iv = setInterval(() => {
      setSilenceCount(Math.floor((Date.now() - lastActivityTime) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [lastActivityTime]);

  // Auto-reset expanded header when call ends
  useEffect(() => {
    if (!isActive) setCallModeExpanded(false);
  }, [isActive]);

  useEffect(() => {
    const onPrepare = (e) => {
      const d = e.detail || {};
      if (d.expandMetrics === true) {
        setOffCallMetricsExpanded(true);
        try {
          localStorage.setItem(OFF_CALL_METRICS_EXPANDED_KEY, 'true');
        } catch {
          /* ignore */
        }
      }
      if (d.expandMetrics === false) {
        setOffCallMetricsExpanded(false);
        try {
          localStorage.setItem(OFF_CALL_METRICS_EXPANDED_KEY, 'false');
        } catch {
          /* ignore */
        }
      }
      if (d.scoreView === 'game' || d.scoreView === 'numbers') setScoreView(d.scoreView);
    };
    window.addEventListener('cat_guide_prepare_view', onPrepare);
    return () => window.removeEventListener('cat_guide_prepare_view', onPrepare);
  }, []);

  // Break nudges during idle (not on a call, not currently on break).
  // Stage thresholds are intentionally coarse to avoid spamming the UI.
  const breakNudgeStage = !isActive && !isBreakActive
    ? (minutesSinceLastBreak >= 180 ? 3 : minutesSinceLastBreak >= 120 ? 2 : minutesSinceLastBreak >= 60 ? 1 : 0)
    : 0;
  const shouldBreakNudge = breakNudgeStage > 0;
  const lastBreakNudgeStageRef = useRef(0);
  useEffect(() => {
    if (isActive || isBreakActive) {
      lastBreakNudgeStageRef.current = 0;
      return;
    }
    if (breakNudgeStage > 0 && lastBreakNudgeStageRef.current !== breakNudgeStage) {
      lastBreakNudgeStageRef.current = breakNudgeStage;
      audioEngine.playWarningPing?.();
    }
  }, [breakNudgeStage, isActive, isBreakActive, audioEngine]);

  const startOfToday = new Date().setHours(0,0,0,0);
  const timelineStart = startOfToday + 9 * 3600000;
  const timelineEnd = startOfToday + 23 * 3600000;
  const timelineDuration = timelineEnd - timelineStart;

  const getTimelinePos = (time) => {
    if (!time) return getTimelinePos(Date.now());
    const t = typeof time === 'number' ? time : new Date(time).getTime();
    return Math.max(0, Math.min(100, ((t - timelineStart) / timelineDuration) * 100));
  };

  // Daily shift bar: 9am-6pm (9h). Overtime tracked separately.
  const DAILY_SHIFT_START = 9;
  const DAILY_SHIFT_END = 18;
  const dailyShiftStartMs = startOfToday + DAILY_SHIFT_START * 3600000;
  const dailyShiftEndMs = startOfToday + DAILY_SHIFT_END * 3600000;
  const dailyShiftDuration = dailyShiftEndMs - dailyShiftStartMs;

  const getDailyTimelinePos = (time) => {
    if (!time) return getDailyTimelinePos(Date.now());
    const t = typeof time === 'number' ? time : new Date(time).getTime();
    return ((t - dailyShiftStartMs) / dailyShiftDuration) * 100; // allow >100 and <0
  };

  const getOvertimePos = (time) => {
    const t = typeof time === 'number' ? time : new Date(time).getTime();
    const maxOvertimeMs = 6 * 3600000; // 18:00-00:00
    return Math.max(0, Math.min(100, ((t - dailyShiftEndMs) / maxOvertimeMs) * 100));
  };

  // Mini-timeline renderer for day notches
  const MiniDayTimeline = ({ dateStr, currentTimeline, dailyMins, goalMins }) => {
    const timeline = currentTimeline || historyTimeline[dateStr];
    
    // Fallback: If no chronological data, just show a solid block based on minutes worked
    if (!timeline || timeline.length === 0) {
      const fillPct = Math.min(100, (dailyMins / (goalMins || 1)) * 100);
      return (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.05)' }}>
           <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fillPct}%`, background: dailyMins >= goalMins ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)' }} />
        </div>
      );
    }

    // Chronological Render (Orange/Blue thing)
    return (
      <div 
        title={`Waiting/Available: ${dailyMins}m worked today.`}
        style={{ position: 'absolute', inset: 0, background: 'rgba(251, 146, 60, 0.15)', cursor: 'crosshair' }}>
        {timeline.map((evt, i) => {
          const s = getTimelinePos(evt.start);
          const e = getTimelinePos(evt.end || Date.now());
          const startTime = new Date(evt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          const endTime = evt.end ? new Date(evt.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Ongoing';
          const duration = Math.round(((evt.end || Date.now()) - evt.start) / 60000);

          if (evt.type === 'avail') return null; // Avail is the background orange
          
          return (
            <div key={i} 
              title={`${evt.type.toUpperCase()}: ${startTime} - ${endTime} (${duration}m)`}
              style={{ 
                position: 'absolute', left: `${s}%`, width: `${Math.max(0.5, e - s)}%`, 
                top: 0, bottom: 0, 
                background: evt.type === 'work' ? '#f87171' : (evt.type === 'break' ? '#fb923c' : 'transparent'),
                opacity: 0.8,
                zIndex: 10,
                borderLeft: '1px solid rgba(255,255,255,0.2)'
              }} />
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (isActive && sessionSeconds > 0 && sessionSeconds % 60 === 0) {
      // PRO LADDER / SOUNDSCAPE INTERPRETER: 
      // Every minute played is a coin earned. Richer sound as minutes pass.
      const currentMin = Math.floor(sessionSeconds / 60);
      playChaChing(currentMin);
      audioEngine.playTick(currentMin); // KEEP legacy bronze tick for depth
    }
  }, [isActive, sessionSeconds, playChaChing, audioEngine]);

  // handleStart and local starting logic REMOVED to favor unified App-level handlers passed via props

  const handleStop = useCallback(() => {
    setCallModeExpanded(false);
    // HIPAA grace: keep transcript/translation/pins for a short window.
    // Final clearing happens inside SessionContext after the grace timer.
    requestHipaaDisconnectGrace?.(15000);
    stopSession((mins) => {
      // Stop audio immediately; transcript/translation destruction is deferred by HIPAA grace.
      onStopAudio?.();

      // DENOMINATION PAYOUT LOGIC
      // Diamonds = 20m, Bills = 5m, Coins = 1m
      let rem = Math.round(mins);
      const diamonds = Math.floor(rem / 20); rem %= 20;
      const bills = Math.floor(rem / 5); rem %= 5;
      const coins = rem;

      // Denomination payout sound effects from audioEngine
      for(let i=0; i < diamonds; i++) setTimeout(() => audioEngine.playDiamond(), i * 400);
      for(let i=0; i < bills; i++) setTimeout(() => audioEngine.playBill(), (diamonds * 400) + (i * 300));
      for(let i=0; i < coins; i++) setTimeout(() => audioEngine.playCoin(), (diamonds * 400) + (bills * 300) + (i * 200));

      setCelebration({ type: 'call', label: `+AR$${Math.round(mins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}`, coins: Math.min(60, Math.floor(mins * 1.5)) });
      setTimeout(() => setCelebration(null), 4000);
    });
    // Keep audio stream attached for the next call (attach once per shift).
  }, [stopSession, onStopAudio, requestHipaaDisconnectGrace, RATE_PER_MINUTE, arsRate, audioEngine]);

  const handleEndDay = () => {
    setCallModeExpanded(false);
    endDay((mins) => {
      audioEngine.playMetalChest();
      const dynamicItems = Math.min(200, Math.max(20, Math.floor(mins * 0.4)));
      setCelebration({ type: 'day', label: `Day Banked! +AR$${Math.round(mins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}`, coins: dynamicItems });
      setTimeout(() => setCelebration(null), 5000 + Math.min(3000, dynamicItems * 25));
    });
  };

  const handleStartBreak = useCallback(() => {
    startBreak();
  }, [startBreak]);

  const getWorkingDays = (y, m) => {
    let count = 0;
    const daysInMo = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMo; d++) {
      const dow = new Date(y, m, d).getDay();
      if (dow !== 0 && dow !== 6) count++; // Mon-Fri
    }
    return count || 22;
  };

  const getRemainingWorkDays = (y, m, dStart) => {
    let count = 0;
    const dInMo = new Date(y, m + 1, 0).getDate();
    for (let d = dStart; d <= dInMo; d++) {
      const dow = new Date(y, m, d).getDay();
      if (dow !== 0 && dow !== 6) count++; 
    }
    return count;
  };

  // Calculations
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), currentDay = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = daysInMonth - currentDay + 1;
  const minutesBeforeToday = Math.max(0, stats.monthlyMinutes - stats.dailyMinutes);
  const remainingMinutesFromStartOfDay = Math.max(0, stats.goalMinutes - minutesBeforeToday);

  const remainingWorkDays = getRemainingWorkDays(year, month, currentDay);
  const baseYield = (stats.goalMinutes || 5500) / (getWorkingDays(year, month) || 22);
  
  // REALISTIC CATCH-UP: Divide remaining by workdays, but cap at 600m (10h)
  const rawCatchUp = remainingWorkDays > 0 ? (remainingMinutesFromStartOfDay / remainingWorkDays) : baseYield;
  const dailyGoal = Math.min(600, Math.max(baseYield, rawCatchUp));
  
  const unbankedMins = isActive ? (sessionSeconds / 60) : 0;
  const totalDailyMins = stats.dailyMinutes + unbankedMins;
  const liveBreakMins = (stats.dailyBreakMinutes || 0) + (breakSeconds / 60);
  const totalOffCallMins = (stats.dailyAvailMinutes || 0) + (stats.dailyBreakMinutes || 0) + (availSeconds / 60) + (breakSeconds / 60);
  const totalOffCallSeconds = (
    ((stats.dailyAvailMinutes || 0) + (stats.dailyBreakMinutes || 0)) * 60
    + (availSeconds || 0)
    + (breakSeconds || 0)
  );

  // CATCH-UP LOGIC: Dynamic shifts and SUCCESS ZONES
  const ABSOLUTE_END = 23;
  const currentTime = now.getHours() + (now.getMinutes() / 60);
  const shiftElapsedRatio = Math.min(1, Math.max(0, (currentTime - DAILY_SHIFT_START) / (DAILY_SHIFT_END - DAILY_SHIFT_START)));

  // Log-off nudge (progressive fill + shine near 18:00, off-call only)
  const logoffGlowWindowStart = 17;
  const logoffGlowWindowEnd = 18;
  const logoffGlowProgress =
    !isActive && !isBreakActive
      ? Math.min(1, Math.max(0, (currentTime - logoffGlowWindowStart) / (logoffGlowWindowEnd - logoffGlowWindowStart)))
      : 0;
  const shouldLogoffShine = !isActive && !isBreakActive && currentTime >= 17.75;
  
  const getDayEmoji = () => {
    if (currentTime < 13) return '🌅';
    if (currentTime < 17) return '☀️';
    return '🌙';
  };
  const activeDayEmoji = getDayEmoji();

  // Condensed View metrics
  const liveDailyArs = Math.round(totalDailyMins * RATE_PER_MINUTE * arsRate);
  const dailyTargetArs = Math.round(dailyGoal * RATE_PER_MINUTE * arsRate);
  const monthlyArs = Math.round(stats.monthlyMinutes * RATE_PER_MINUTE * arsRate);
  const monthlyTargetArs = Math.round(stats.goalMinutes * RATE_PER_MINUTE * arsRate);
  const currentBounty = Math.max(0, dailyTargetArs - liveDailyArs);
  const arsPerSecond = (RATE_PER_MINUTE / 60) * arsRate;
  const sessionArsLive = Math.round(sessionEarnings * arsRate);
  // liveDailyArs already includes the current call (totalDailyMins = dailyMinutes + unbankedMins),
  // so this is the live "$ today" figure as-is — don't add sessionArsLive again or it double-counts.
  const todayArsLive = liveDailyArs;

  const renderLiveArs = (discreteValue, size = 'lg', prefix = '$') =>
    isActive ? (
      <LiveRollingNumber value={discreteValue} ratePerSecond={arsPerSecond} prefix={prefix} size={size} />
    ) : (
      <StatNumber value={discreteValue} prefix={prefix} size={size} />
    );

  const renderSessionArs = (size = 'sm', prefix = 'AR$') => renderLiveArs(sessionArsLive, size, prefix);

  const metricTooltipData = React.useMemo(() => ({
    1: {
      icon: '🕒',
      heading: 'MINS TODAY',
      color: '#f87171',
      body: 'Total minutes you have “banked” today so far (includes current call time). When this climbs toward your Daily Goal, your day quality and pacing stabilize.'
    },
    2: {
      icon: '🧭',
      heading: 'LEFT TODAY',
      color: '#fca5a5',
      body: 'How many minutes you still need to reach today’s goal. If this stays high late in the shift, switch pace: more productive calls, shorter idle gaps.'
    },
    3: {
      icon: '🎯',
      heading: 'TODAY GOAL',
      color: '#34d399',
      body: 'Your dynamic target for today’s minutes. It adapts to your shift timing and remaining workdays so you don’t grind blindly.'
    },
    4: {
      icon: '💵',
      heading: '$ TODAY',
      color: '#34d399',
      body: 'Estimated earnings you’ve made today in AR$ (live if you’re on a call). Use it to judge whether your pacing is paying off right now.'
    },
    5: {
      icon: '🧾',
      heading: '$ LEFT TODAY',
      color: '#fcd34d',
      body: 'Remaining AR$ needed to hit your daily money target. When this trends toward zero, you’re “done” even if your call still has time left.'
    },
    6: {
      icon: '⚡',
      heading: 'STAMINA RATIO',
      color: '#c084fc',
      body: 'On-call minutes divided by break (and downtime). Target is ~5.3x: it means you’re earning while keeping downtime under control.'
    },
    7: {
      icon: '🗓️',
      heading: '$ MONTH',
      color: '#a855f7',
      body: 'Your banked monthly earnings vs the big monthly target. This is the “long game” number—small daily wins compound.'
    },
    8: {
      icon: '🧱',
      heading: '$ LEFT MONTH',
      color: '#fcd34d',
      body: 'How much AR$ you still need to finish the month on target. Use it like a countdown: late-month rush is avoidable with small catch-up beats.'
    },
    9: {
      icon: '🚪',
      heading: 'OFF CALL',
      color: '#fdba74',
      body: 'Minutes you spent off-call today (avail + breaks). If this grows while you’re not actively earning, stamina ratio drops quickly.'
    },
    10: {
      icon: '📊',
      heading: 'MO AVG',
      color: '#a855f7',
      body: 'Average minutes per day so far this month. If the average is climbing, you’re likely ahead of your monthly pacing plan.'
    },
    11: {
      icon: '🔇',
      heading: 'SILENCE',
      color: '#ef4444',
      body: 'Time since the last audio activity (speech resets it). In-call, higher silence usually means the patient/user has gone quiet—pull them back gently.'
    },
    12: {
      icon: '📞',
      heading: 'CURR CALL',
      color: '#10b981',
      body: 'Current call duration and its live unbanked cash. It helps you separate “this call is productive” from “today is good overall.”'
    }
  }), []);

  const showMetricTooltip = useCallback((e, metricKey) => {
    const d = metricTooltipData[metricKey];
    if (!d) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const placement = rect.top < 160 ? 'below' : 'above';
    const y = placement === 'above' ? rect.top : rect.bottom;
    const x = rect.left + rect.width / 2;
    showElementHint(buildHintPayload({
      elementId: `metric-m${metricKey}`,
      heading: d.heading,
      body: d.body,
      icon: d.icon,
      color: d.color,
      x,
      y,
      placement,
    }));
  }, [metricTooltipData, showElementHint]);

  const hideMetricTooltip = useCallback(() => {
    hideElementHint();
  }, [hideElementHint]);

  // Progress-bar hover tooltip (ElementHint — same renderer as metric cards)
  const showProgressBarTooltip = useCallback((e, { icon, heading, color, body, elementId, guideKey }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const placement = rect.top < 160 ? 'below' : 'above';
    const x = rect.left + rect.width / 2;
    const y = placement === 'above' ? rect.top : rect.bottom;

    showElementHint(buildHintPayload({
      elementId,
      guideKey,
      heading,
      body,
      icon,
      color,
      x,
      y,
      placement,
    }));
  }, [showElementHint]);

  useEffect(() => {
    if (Math.abs(displayBounty - currentBounty) > 1) {
      setIsBountyAnimating(true);
      const timer = setTimeout(() => {
        setDisplayBounty(currentBounty);
        setIsBountyAnimating(false);
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [currentBounty, displayBounty]);

  // Initialize bounty on load
  useEffect(() => {
    setDisplayBounty(currentBounty);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  let hoursLeftToAbsolute = Math.max(0, ABSOLUTE_END - currentTime);
  
  // Estimated workable mins from now
  const workableMinsRemaining = hoursLeftToAbsolute * 35;
  
  // realistic max is now computed inline in the daily bar label
  
  const remainingWorkdaysThisMonth = Math.max(0, remainingDays - 1);
  const monthlyMaxMins = stats.monthlyMinutes + workableMinsRemaining + (remainingWorkdaysThisMonth * 14 * 35);
  const monthlyRemainingCashVal = Math.round((workableMinsRemaining + remainingWorkdaysThisMonth * 14 * 35) * RATE_PER_MINUTE * arsRate);
  const monthlyMaxArs = Math.round(monthlyMaxMins * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR');
  const actualDailyAverage = currentDay > 0 ? (stats.monthlyMinutes / currentDay) : 0;
  
  const monthElapsedRatio = currentDay / daysInMonth;
  const isMonthlyGoalMet = stats.monthlyMinutes >= stats.goalMinutes;
  const monthlyProgressRatio = stats.goalMinutes > 0 ? Math.min(1, stats.monthlyMinutes / stats.goalMinutes) : 0;
  const monthlyPendingRatio = stats.goalMinutes > 0 ? Math.min(1, (stats.monthlyMinutes + unbankedMins) / stats.goalMinutes) : 0;

  const getCompensatedLogOff = () => {
    if (!stats.dayStartTime) return '18:00';
    const start = new Date(stats.dayStartTime);
    const nineAM = new Date(stats.dayStartTime);
    nineAM.setHours(9, 0, 0, 0);
    const lateStartMs = Math.max(0, start.getTime() - nineAM.getTime());
    const totalBreakMs = (stats.dailyBreakMinutes || 0) * 60000;
    const safeDateString = stats.lastDate || new Date().toDateString();
    const end = new Date(safeDateString + ' 18:00:00');
    const compensatedTime = new Date(end.getTime() + lateStartMs + totalBreakMs);
    if (isNaN(compensatedTime.getTime())) return '18:00';
    return compensatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const shiftElapsedMins = stats.dayStartTime ? Math.max(0, (Date.now() - stats.dayStartTime) / 60000) : 0;
  const breakLimit = 90;
  const breakUsed = stats.dailyBreakMinutes || 0;
  const breakLeft = Math.max(0, breakLimit - breakUsed);
  const cashToTodayGoal = Math.max(0, dailyTargetArs - liveDailyArs);

  const staminaRatioVal = totalDailyMins / Math.max(0.1, liveBreakMins);
  const metricPcts = {
    minsToday: dailyGoal > 0 ? `${((totalDailyMins / dailyGoal) * 100).toFixed(0)}% of goal` : '—',
    leftToday: dailyGoal > 0 ? `${((Math.max(0, dailyGoal - totalDailyMins) / dailyGoal) * 100).toFixed(0)}% left` : '—',
    todayGoal: '100% target',
    arsToday: dailyTargetArs > 0 ? `${((todayArsLive / dailyTargetArs) * 100).toFixed(0)}% of tgt` : '—',
    arsLeft: dailyTargetArs > 0 ? `${((cashToTodayGoal / dailyTargetArs) * 100).toFixed(0)}% left` : '—',
    stamina: `${((staminaRatioVal / 5.3) * 100).toFixed(0)}% of 5.3x`,
    arsMonth: monthlyTargetArs > 0 ? `${((monthlyArs / monthlyTargetArs) * 100).toFixed(0)}% of tgt` : '—',
    arsLeftMonth: monthlyTargetArs > 0 ? `${((Math.max(0, monthlyTargetArs - monthlyArs) / monthlyTargetArs) * 100).toFixed(0)}% left` : '—',
    offCall: (totalDailyMins + totalOffCallMins) > 0 ? `${((totalOffCallMins / (totalDailyMins + totalOffCallMins)) * 100).toFixed(0)}% off-call` : '—',
    moAvg: baseYield > 0 ? `${((actualDailyAverage / baseYield) * 100).toFixed(0)}% vs pace` : '—',
    silence: silenceCount > 30 ? `${Math.min(100, ((silenceCount / 600) * 100)).toFixed(0)}% of 10m` : '—',
    currCall: isActive && dailyGoal > 0 ? `${(((sessionSeconds / 60) / dailyGoal) * 100).toFixed(0)}% of day` : '—',
  };

  const formatHoursMins = (totalMins) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    return `${h}h${m > 0 ? `${m}m` : ''}`;
  };

  const formatValue = (mins) => {
    if (showAsHours) return formatHoursMins(mins);
    return `${Math.round(mins)}m`;
  };

  // SIMPLIFIED 12-STEP ENGINE (5500m floor based)
  const WEEK_STEP = 1375; // 5500 / 4
  
  const milestones = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => (i + 1) * WEEK_STEP);
  }, []);

  const milestoneLabels = [
    "Step 1: Floor Prep", "Step 2: Floor Rise", "Step 3: Floor Push", "🪜 LADDER: FLOOR (5500m)",
    "Step 5: Growth Prep", "Step 6: Growth Rise", "Step 7: Growth Push", "🚀 LADDER: GROWTH (11k)",
    "Step 9: Legend Prep", "Step 10: Legend Rise", "Step 11: Legend Push", "👑 LADDER: LEGEND (16.5k)"
  ];

  const nextMilestone = milestones.find(m => m > stats.monthlyMinutes) || milestones[milestones.length - 1];
  const currentIdx = milestones.indexOf(nextMilestone);
  const nextGoalLabel = milestoneLabels[currentIdx];

  const HARD_CUTOFF_HOUR = 24; 
  const currentHour = new Date().getHours();
  const currentMin = new Date().getMinutes();
  const minsToHardCutoff = Math.max(0, ((HARD_CUTOFF_HOUR * 60) - (currentHour * 60 + currentMin)));

  // ── MILESTONE TARGETS ──────────────────────────────────────────────────────
  // Milestone 1: 5500m/month (5 days/week)
  // Milestone 2: 480m/day (6 days/week)
  const workingDaysMo = getWorkingDays(year, month);
  const totalWindowMins = shiftElapsedMins + minsToHardCutoff;
  const timeRatio = totalWindowMins > 0 ? shiftElapsedMins / totalWindowMins : 0;

  const milestoneTargets = {
    m5500: 5500 / workingDaysMo,
    m480: 480,
    m5500Ideal: (5500 / workingDaysMo) * timeRatio,
    m480Ideal: 480 * timeRatio
  };
  
  const cutoffWarning = (() => {
    if (minsToHardCutoff <= 1)   return { label: 'MIDNIGHT DEADLINE', color: '#ef4444', pulse: true };
    if (minsToHardCutoff <= 20)  return { label: `🚨 ${Math.round(minsToHardCutoff)}m left`, color: '#ef4444', pulse: true };
    if (minsToHardCutoff <= 45)  return { label: `⚠️ ${Math.round(minsToHardCutoff)}m`, color: '#f59e0b', pulse: false };
    if (minsToHardCutoff <= 90)  return { label: `🌙 Nightly Stop`, color: '#fcd34d', pulse: false };
    return null;
  })();
  const availableWindowMins = minsToHardCutoff;

  // ── MONTHLY DEFICIT ───────────────────────────────────
  const expectedByToday = Math.round((stats.goalMinutes / daysInMonth) * currentDay);
  const monthlyDeficitMins = expectedByToday - stats.monthlyMinutes; // positive = behind
  const isInDeficit = monthlyDeficitMins > 30;


  // PACE ETA: predicts when you'll hit today's goal at current earned rate
  const pacePrediction = (() => {
    const remaining = Math.max(0, dailyGoal - totalDailyMins);
    if (remaining <= 0) return { label: '✅ Done!', color: '#10b981', detail: null };
    if (totalDailyMins < 5 || shiftElapsedMins < 10) return { label: '–', color: 'var(--text-muted)', detail: 'Warming up...' };
    const ratePerShiftMin = totalDailyMins / shiftElapsedMins; // live rate
    if (ratePerShiftMin <= 0) return { label: '–', color: 'var(--text-muted)', detail: null };
    const minsToGoal = remaining / ratePerShiftMin;
    const goalTime = new Date(Date.now() + minsToGoal * 60000);
    const hh = goalTime.getHours().toString().padStart(2, '0');
    const mm = goalTime.getMinutes().toString().padStart(2, '0');
    const isBeforeCutoff = goalTime.getHours() < HARD_CUTOFF_HOUR;
    const isBeforeShift = goalTime.getHours() < 18;
    return {
      label: `${hh}:${mm}`,
      color: isBeforeCutoff ? (isBeforeShift ? '#10b981' : '#34d399') : '#ef4444',
      detail: isBeforeCutoff ? 'achievable today' : 'past 20:00 cutoff'
    };
  })();

  // QUALITY: late-start aware pacing score (uses live mins)
  const maxEarnableToday = totalDailyMins + (availableWindowMins * 0.58);
  const qualityScore = (() => {
    if (shiftElapsedMins < 5 || dailyGoal <= 0) return null;
    const sessionWindowMins = shiftElapsedMins + availableWindowMins;
    const idealNow = Math.min(dailyGoal, dailyGoal * (shiftElapsedMins / Math.max(sessionWindowMins, 30)));
    if (idealNow <= 0) return null;
    const pct = Math.round((totalDailyMins / idealNow) * 100);
    const capped = Math.min(150, pct);
    let color = '#ef4444';
    if (capped >= 100) color = '#10b981';
    else if (capped >= 80) color = '#34d399';
    else if (capped >= 60) color = '#f59e0b';
    const goalUnreachable = maxEarnableToday < dailyGoal;
    // Suggest a realistic goal rounded to nearest 5m
    const suggestedGoal = Math.floor(maxEarnableToday / 5) * 5;
    return { pct: capped, color, goalUnreachable, suggestedGoal };
  })();

  // STREAK: past days + live "today on track" indicator
  const streak = stats.streak || 0;
  const todayOnTrack = dailyGoal > 0 && totalDailyMins >= dailyGoal;

  // CALL RATE, EFFECTIVE RATE
  const callsToday = stats.callsToday || 0;
  const avgCallMins = callsToday > 0 ? Math.round(totalDailyMins / Math.max(callsToday, 1)) : 0;
  const effectiveRateArsHr = shiftElapsedMins > 10
    ? Math.round((liveDailyArs / shiftElapsedMins) * 60)
    : null;

  const activeRateArsHr = totalDailyMins > 0
    ? Math.round((liveDailyArs / totalDailyMins) * 60)
    : null;

  const rateOf = (view) => view === 'effective' ? effectiveRateArsHr : activeRateArsHr;

  // Sticky connect/stop bar — attach audio first, start call separately.
  // Sticky connect “flash” helper: for virtual cable we treat `cableStreamReady`
  // as the attach condition; for tab share we keep the legacy `tabStreamReady`.
  const tabNeedsReconnect =
    configuredAudioSourceMode === "virtualCable"
      ? !cableStreamReady
      : !micTestMode && !tabStreamReady;
  const apiKeyMissing = needsUserSuppliedDeepgramKey();

  // Encrypted token presence (vault setup) exists even if the session key isn't unlocked yet.
  const encryptedKeySaved = (() => {
    try {
      return (
        !!localStorage.getItem("dg_cipher") &&
        !!localStorage.getItem("dg_salt") &&
        !!localStorage.getItem("dg_iv")
      );
    } catch (_) {
      return false;
    }
  })();
  const vaultNeedsDecrypt = apiKeyMissing && encryptedKeySaved;
  const apiKeyMissingNoVault = apiKeyMissing && !encryptedKeySaved;

  const showKeyVault = (trigger = 'connect') => {
    dispatchOpenDeepgramSettings(trigger);
  };

  const connectRequireDoubleTapIndicator = false;

  const connectLabel = vaultNeedsDecrypt
    ? 'Decrypt'
    : isZombieCall
    ? 'Re-attach'
    : audioAttached
        ? 'Start interpreting'
        : micTestMode
          ? 'Connect microphone'
          : configuredAudioSourceMode === "virtualCable"
            ? 'Click to connect cable'
            : 'Click to connect tab';
  const connectSingleTitle = isZombieCall
    ? 'Re-attach to your call (timer saved)'
    : vaultNeedsDecrypt
      ? 'Unlock Deepgram with your password (gear icon)'
      : apiKeyMissingNoVault
        ? 'Connect tab audio — if STT fails, add Deepgram key in Settings (gear)'
      : audioAttached
          ? 'Start interpreting — begin transcription'
          : micTestMode
            ? 'Connect using your microphone'
            : configuredAudioSourceMode === "virtualCable"
              ? 'Press here to connect to the selected virtual cable input (VB-CABLE / Voicemeeter)'
              : 'Press here to connect to another browser tab where a conversation to interpret is happening';
  const connectDoubleTitle = micTestMode
    ? 'Pick a different microphone'
    : vaultNeedsDecrypt
      ? 'Unlock Deepgram with your password'
      : apiKeyMissingNoVault
        ? 'Enter your Deepgram key in Settings'
      : configuredAudioSourceMode === "virtualCable"
        ? 'Pick a different virtual cable input'
        : 'Pick a different browser tab';

  const connectOnSingle = (() => {
    if (isZombieCall) return onRecovery;
    if (!audioAttached) return onAttachAudio;
    return onStartCall;
  })();

  const connectOnDouble = (() => {
    if (isZombieCall) return onRecovery;
    if (!audioAttached) return onAttachAudioFresh || onAttachAudio;
    return onConnectAnotherTab;
  })();

  const connectFlash = !isBreakActive && (tabNeedsReconnect || (!audioAttached && !isZombieCall));
  const showEndDayButton = !isActive && stats.dailyMinutes > 0 && !isBreakActive;

  // Listen for Demo Scenarios
  useEffect(() => {
    const handleScenario = (e) => {
      const scenario = e.detail;
      if (scenario === 'call') {
        if (audioAttached) onStartCall();
        else onAttachAudio?.();
      } else if (scenario === 'ui_call') {
        // Dev helper: start the “in call UI” without requiring real tab audio.
        // (Captions will stay empty until real audio is attached.)
        onStartCall?.();
      } else if (scenario === 'goal_hit') {
        handleStop();
        setTimeout(() => {
          setCelebration({ 
            type: 'day', 
            label: 'DAILY GOAL SECURED! 🏆', 
            coins: 100 
          });
          audioEngine.playJackpot?.() || audioEngine.playMetalChest();
        }, 1000);
      } else if (scenario === 'break') {
        handleStartBreak();
      } else if (scenario === 'reset') {
        stopBreak();
        stopSession();
        onStopAudio();
        setCelebration(null);
      }
    };
    window.addEventListener('cat_demo_scenario', handleScenario);
    return () => window.removeEventListener('cat_demo_scenario', handleScenario);
  }, [onAttachAudio, onStartCall, audioAttached, onStopAudio, handleStop, handleStartBreak, stopBreak, stopSession, audioEngine]);

  const renderHeaderMetricsStrip = (expandedFlag, { showBars = true, showQuickRow = true } = {}) => (
    <HeaderMetricsStrip
      {...buildHeaderStripMetrics({
        stats,
        totalDailyMins,
        dailyGoal,
        monthlyProgressRatio,
        monthlyPendingRatio,
        isMonthlyGoalMet,
        isInDeficit,
        currentIdx,
        milestoneLabels,
        liveDailyArs,
      })}
      expanded={expandedFlag}
      onToggleExpand={toggleOffCallMetricsExpanded}
      onBarHover={showProgressBarTooltip}
      onBarLeave={hideMetricTooltip}
      scoreView={scoreView}
      onScoreViewChange={expandedFlag ? handleQuickScoreView : undefined}
      studioView={studioView}
      onCycleWorkspace={expandedFlag ? onCycleWorkspace : undefined}
      showStudioHint={showStudioHint}
      showBars={showBars}
      showQuickRow={showQuickRow}
    />
  );

  const renderOffCallCollapsedBody = () => renderHeaderMetricsStrip(false, {
    showBars: false,
    showQuickRow: false,
  });

  const renderWorkspaceBody = () => (
      <div className={`dashboard-header-fill${offCallScoreboardView ? ' scoreboard-workspace scoreboard-workspace--header' : ''}`} data-guide={offCallScoreboardView ? 'scoreboard' : undefined}>
      <>
      {offCallScoreboardView && offCallMetricsExpanded && renderHeaderMetricsStrip(true)}
      {/* COLLAPSED VIEW (hidden when in compact call mode) */}
      {(!isActive || callModeExpanded) && isCollapsed && (
        <div className="condensed-header-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0.35rem 0', flexWrap: 'wrap' }}>
            {!offCallScoreboardView && (
            <button
              type="button"
              className="goal-weekly-pill"
              onClick={() => setIsTodayDialOpen(true)}
              title="Weekly commitment — open goal picker wheel"
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(167, 139, 250, 0.35)',
                borderRadius: 6,
                color: '#c4b5fd',
                cursor: 'pointer',
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '0.2rem 0.5rem',
              }}
            >
              <TargetIcon size={12} />
              <span>{weeklyGoalHours}h/wk goal</span>
            </button>
            )}
          </div>
          
          {/* Full-width scoreboard (numbers / game flip) */}
          <div id="header-scoreboard-center" data-guide="scoreboard" className="condensed-scoreboard-panel">
            <div className="flip-container scoreboard-flip-container">
              <div className={`flip-card ${scoreView === 'numbers' ? 'is-flipped' : ''}`}>
                
                <div className="flip-front">
                  <GameScoreboard
                    liveDailyArs={liveDailyArs} dailyTargetArs={dailyTargetArs}
                    monthlyArs={monthlyArs} monthlyTargetArs={monthlyTargetArs}
                    stats={stats} dailyGoal={dailyGoal} totalDailyMins={totalDailyMins}
                    totalOffCallMins={totalOffCallMins}
                    shiftElapsedMins={shiftElapsedMins}
                    pacePrediction={pacePrediction} qualityScore={qualityScore} cutoffWarning={cutoffWarning}
                    breakLeft={breakLeft} breakLimit={breakLimit}
                    nextGoalLabel={nextGoalLabel} nextMilestone={nextMilestone}
                    daysInMonth={daysInMonth} currentDay={currentDay} remainingDays={remainingDays}
                    isActive={isActive} isBreakActive={isBreakActive}
                    isZombieCall={isZombieCall}
                    connectionState={connectionState}
                    connectProgress={connectProgress}
                    onAttachAudio={onAttachAudio}
                    onAttachAudioFresh={onAttachAudioFresh}
                    onStartCall={onStartCall}
                    onRecovery={onRecovery}
                    onConnectAnotherTab={onConnectAnotherTab}
                    audioAttached={audioAttached}
                    onSwitchToNumbers={() => setScoreView('numbers')}
                    milestoneTargets={milestoneTargets}
                    isEditingScoreboard={isEditingScoreboard}
                    getCompensatedLogOff={getCompensatedLogOff}
                    connectInHeader={offCallScoreboardView}
                    compactPane={offCallScoreboardView}
                  />
                </div>

                <div className="flip-back">
                  {showNumericGrid ? (
                  <div id="numeric-metric-grid" className="metric-grid metric-grid--scoreboard">
                    {isEditingScoreboard && (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '3px', flexWrap: 'wrap', padding: '2px 0', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.5rem', opacity: 0.5, marginRight: 4 }}>Preset:</span>
                        {Object.entries(PRESET_LABELS).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => applyScoreboardPreset(id)}
                            style={{
                              fontSize: '0.5rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, cursor: 'pointer',
                              background: scoreboardPreset === id ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)',
                              border: scoreboardPreset === id ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                              color: scoreboardPreset === id ? '#93c5fd' : 'rgba(255,255,255,0.6)',
                            }}
                            title={`Apply ${label} scoreboard preset`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* 1. Mins worked today */}
                    {showMetric('m1') && (
                    <div
                      id="metric-m1"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Minutes worked today (Click to toggle H:M)"
                      style={{ position: 'relative', background: 'rgba(239,68,68,0.06)', cursor: 'pointer' }}
                      onClick={() => setShowAsHours(!showAsHours)}
                      onMouseEnter={(e) => showMetricTooltip(e, 1)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m1" />
                      <HelpLabel text="1. MINS TODAY" />
                      <div className="metric-cell-val" style={{ color: '#f87171' }}><StatNumber value={formatValue(totalDailyMins)} size="lg" format={false} /></div>
                      <MetricPct>{metricPcts.minsToday}</MetricPct>
                      <div className="metric-cell-label">MINS TODAY</div>
                    </div>
                    )}

                    {showMetric('m2') && (
                    <div
                      id="metric-m2"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Minutes left for daily goal (Click to toggle H:M)"
                      style={{ position: 'relative', background: 'rgba(239,68,68,0.04)', cursor: 'pointer' }}
                      onClick={() => setShowAsHours(!showAsHours)}
                      onMouseEnter={(e) => showMetricTooltip(e, 2)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m2" />
                      <HelpLabel text="2. LEFT TODAY" />
                      <div className="metric-cell-val" style={{ color: '#fca5a5' }}><StatNumber value={formatValue(Math.max(0, dailyGoal - totalDailyMins))} size="lg" format={false} /></div>
                      <MetricPct>{metricPcts.leftToday}</MetricPct>
                      <div className="metric-cell-label">LEFT TODAY</div>
                    </div>
                    )}

                    {/* 3. Goal mins */}
                    {showMetric('m3') && (
                    <div
                      id="metric-m3"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Target goal minutes for today (Click to toggle H:M)"
                      style={{ position: 'relative', background: 'rgba(52,211,153,0.04)', cursor: 'pointer' }}
                      onClick={() => setShowAsHours(!showAsHours)}
                      onMouseEnter={(e) => showMetricTooltip(e, 3)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m3" />
                      <HelpLabel text="3. TODAY GOAL" />
                      <div className="metric-cell-val"><StatNumber value={formatValue(dailyGoal)} size="lg" format={false} /></div>
                      <MetricPct>{metricPcts.todayGoal}</MetricPct>
                      <div className="metric-cell-label">TODAY GOAL</div>
                    </div>
                    )}

                    {/* 4. Money today */}
                    {showMetric('m4') && (
                    <div
                      id="metric-m4"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Money earned today"
                      style={{ position: 'relative', background: 'rgba(16,185,129,0.06)' }}
                      onMouseEnter={(e) => showMetricTooltip(e, 4)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m4" />
                      <HelpLabel text="4. $ TODAY" />
                      <div className="metric-cell-val" style={{ color: '#34d399' }}>{renderLiveArs(todayArsLive, 'lg', '$')}</div>
                      <MetricPct>{metricPcts.arsToday}</MetricPct>
                      <div className="metric-cell-label">$ TODAY</div>
                    </div>
                    )}

                    {/* 5. Money to be made today */}
                    {showMetric('m5') && (
                    <div
                      id="metric-m5"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Money remaining for today's goal"
                      style={{ position: 'relative', background: 'rgba(245,158,11,0.04)' }}
                      onMouseEnter={(e) => showMetricTooltip(e, 5)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m5" />
                      <HelpLabel text="5. $ LEFT TODAY" />
                      <div className="metric-cell-val" style={{ color: '#fcd34d' }}><StatNumber value={cashToTodayGoal} prefix="$" size="lg" /></div>
                      <MetricPct>{metricPcts.arsLeft}</MetricPct>
                      <div className="metric-cell-label">$ LEFT TODAY</div>
                    </div>
                    )}

                    {/* 6. Stamina Ratio (On-Call vs Break) */}
                    {showMetric('m6') && (
                    <div
                      id="metric-m6"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="STAMINA RATIO: Your on-call minutes divided by break minutes. Target is 5.3x (8h on / 90m off)."
                      style={{ position: 'relative', background: 'rgba(168,85,247,0.04)' }}
                      onMouseEnter={(e) => showMetricTooltip(e, 6)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m6" />
                      <HelpLabel text="6. STAMINA RATIO" />
                      <div className="metric-cell-val" style={{ color: (totalDailyMins / Math.max(0.1, liveBreakMins)) >= 5.3 ? '#c084fc' : '#9ca3af' }}>
                        {(totalDailyMins / Math.max(0.1, liveBreakMins)).toFixed(1)}x
                      </div>
                      <MetricPct>{metricPcts.stamina}</MetricPct>
                      <div className="metric-cell-label">STAMINA RATIO</div>
                    </div>
                    )}

                    {/* 7. Money month */}
                    {showMetric('m7') && (
                    <div
                      id="metric-m7"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Money earned this month"
                      style={{ position: 'relative' }}
                      onMouseEnter={(e) => showMetricTooltip(e, 7)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m7" />
                      <HelpLabel text="7. $ MONTH" />
                      <div className="metric-cell-val"><StatNumber value={monthlyArs} prefix="$" size="lg" /></div>
                      <MetricPct>{metricPcts.arsMonth}</MetricPct>
                      <div className="metric-cell-label">$ MONTH</div>
                    </div>
                    )}

                    {/* 8. Money left month */}
                    {showMetric('m8') && (
                    <div
                      id="metric-m8"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Money remaining for monthly goal"
                      style={{ position: 'relative' }}
                      onMouseEnter={(e) => showMetricTooltip(e, 8)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m8" />
                      <HelpLabel text="8. $ LEFT MONTH" />
                      <div className="metric-cell-val"><StatNumber value={Math.max(0, monthlyTargetArs - monthlyArs)} prefix="$" size="lg" /></div>
                      <MetricPct>{metricPcts.arsLeftMonth}</MetricPct>
                      <div className="metric-cell-label">$ LEFT MONTH</div>
                    </div>
                    )}

                    {/* 9. Off-call total today */}
                    {showMetric('m9') && (
                    <div
                      id="metric-m9"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Total time spent off-call today (Click to toggle H:M)"
                      style={{ position: 'relative', background: 'rgba(251,146,60,0.06)', cursor: 'pointer' }}
                      onClick={() => setShowAsHours(!showAsHours)}
                      onMouseEnter={(e) => showMetricTooltip(e, 9)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m9" />
                      <HelpLabel text="9. OFF CALL" />
                      <div className="metric-cell-val" style={{ color: '#fdba74' }}><StatNumber value={formatValue(totalOffCallMins)} size="lg" format={false} /></div>
                      <MetricPct>{metricPcts.offCall}</MetricPct>
                      <div className="metric-cell-label">OFF CALL</div>
                    </div>
                    )}

                    {/* 10. Avg so far mo */}
                    {showMetric('m10') && (
                    <div
                      id="metric-m10"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Average minutes per day so far (Click to toggle H:M)"
                      style={{ position: 'relative', background: 'rgba(139,92,246,0.04)', cursor: 'pointer' }}
                      onClick={() => setShowAsHours(!showAsHours)}
                      onMouseEnter={(e) => showMetricTooltip(e, 10)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m10" />
                      <HelpLabel text="10. MO AVG" />
                      <div className="metric-cell-val"><StatNumber value={formatValue(actualDailyAverage)} size="lg" format={false} /></div>
                      <MetricPct>{metricPcts.moAvg}</MetricPct>
                      <div className="metric-cell-label">MO AVG</div>
                    </div>
                    )}

                    {/* 11. Silence/Idle Timer */}
                    {showMetric('m11') && (
                    <div
                      id="metric-m11"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Time since last audio activity (Reset by speech). In call, this tracks patient/user silence."
                      style={{ position: 'relative', background: isActive ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)' }}
                      onMouseEnter={(e) => showMetricTooltip(e, 11)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m11" />
                      <HelpLabel text="11. SILENCE" />
                      <div className="metric-watermark">{isActive ? '🔇' : '⏳'}</div>
                      <div className="metric-cell-val" style={{ color: silenceCount > 600 ? '#f87171' : 'white' }}>
                        <div style={{ visibility: silenceCount > 30 ? 'visible' : 'hidden' }}>
                          <StatNumber value={formatTime(silenceCount)} size="md" format={false} />
                        </div>
                      </div>
                      <MetricPct>{metricPcts.silence}</MetricPct>
                      <div className="metric-cell-label">{isActive ? 'CALL SILENCE' : 'APP IDLE'}</div>
                    </div>
                    )}

                    {/* 12. Current call min and cash */}
                    {showMetric('m12') && (
                    <div
                      id="metric-m12"
                      className={`metric-cell ${isEditingScoreboard ? 'grid-edit-mode' : ''}`}
                      title="Current call duration and unbanked cash"
                      style={{ position: 'relative', background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)', border: isActive ? '1px solid rgba(16,185,129,0.3)' : 'none' }}
                      onMouseEnter={(e) => showMetricTooltip(e, 12)}
                      onMouseLeave={hideMetricTooltip}
                    >
                      <MetricVisibilityToggle metricKey="m12" />
                      <HelpLabel text="12. CURR CALL" />
                      <div className="metric-cell-val" style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                        <StatNumber value={formatTime(sessionSeconds)} size="md" format={false} />
                        {renderSessionArs('lg', '$')}
                      </div>
                      <MetricPct>{metricPcts.currCall}</MetricPct>
                      <div className="metric-cell-label">CURR CALL</div>
                    </div>
                    )}
                    <div id="cell-switch-game" className="metric-cell" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.04)', gridColumn: 'span 3', flexDirection: 'row', minHeight: '26px' }} onClick={() => setScoreView('game')} title="Switch back to gamified view">
                      <GameIcon size={14} />
                      <div className="metric-cell-label" style={{ opacity: 0.8, marginLeft: '6px' }}>BACK TO GAME VIEW</div>
                    </div>
                    <div className="metric-cell metric-cell-studio" style={{ gridColumn: 'span 1', minHeight: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} title="Studio view switch">
                      {!isActive && onCycleWorkspace && (
                        <WorkspaceViewSwitcher
                          view={studioView}
                          onCycle={onCycleWorkspace}
                          variant="inline"
                          showHint={showStudioHint}
                        />
                      )}
                      <AppGuideButton />
                    </div>
                  </div>
                  ) : (
                    <div style={{ padding: '0.5rem', fontSize: '0.6rem', opacity: 0.45, textAlign: 'center' }}>
                      Number grid hidden — Settings → Display
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Slim toolbar under scoreboard — hidden in portaled pane (sticky header owns controls) */}
          {!offCallScoreboardView && (
          <div className="condensed-header-toolbar">
          <div id="controls-left-col" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
            <div id="connection-controls-horizontal" className={`${isActive ? 'active-working-state' : ''}`} style={{ display: 'flex', flexDirection: 'row', gap: '0.35rem', alignItems: 'center' }}>
              <StateIndicators 
                state={isActive ? 'call' : isBreakActive ? 'break' : 'avail'} 
                breakMinutes={stats.dailyBreakMinutes || 0} 
                isZombie={isZombieCall} 
                silenceCount={silenceCount}
              />
              <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '2px 4px', borderRadius: '3px' }}>
                ⏳{Math.floor(minutesSinceLastBreak)}m
              </div>
              <div id="header-edit-tools-mini" style={{ display: 'flex', gap: '2px' }}>
                <button className="edit-btn-tiny" onClick={() => setTimeEditMode('call')} title="Edit call time" style={{ width: '20px', height: '26px', fontSize: '0.5rem' }}>📞</button>
                <button className="edit-btn-tiny" onClick={() => setTimeEditMode('break')} title="Edit break time" style={{ width: '20px', height: '26px', fontSize: '0.5rem' }}>☕</button>
              </div>
            </div>
            <div id="left-pills-row" style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
               <div id="pill-shift" className="metric-pill compact-pill" title="SHIFT" style={{ padding: '0.1rem 0.3rem' }}>
                 <span style={{ fontSize: '0.55rem' }}>🏃{formatHoursMins(shiftElapsedMins)}</span>
               </div>
               <div
                 id="pill-logoff"
                 className="metric-pill compact-pill"
                 title="LOG OFF"
                 style={{
                   position: 'relative',
                   overflow: 'hidden',
                   background: 'rgba(245,158,11,0.08)',
                   border: '1px solid rgba(245,158,11,0.2)',
                   padding: '0.1rem 0.3rem',
                   boxShadow: shouldLogoffShine ? '0 0 14px rgba(245,158,11,0.45)' : undefined,
                   animation: shouldLogoffShine ? 'shineSweep 3s linear infinite' : undefined,
                   backgroundImage: shouldLogoffShine ? 'linear-gradient(90deg, rgba(245,158,11,0.10), rgba(245,158,11,0.22), rgba(245,158,11,0.10))' : undefined,
                   backgroundSize: shouldLogoffShine ? '200% 100%' : undefined,
                   backgroundPosition: '0% 0%',
                 }}
               >
                 <div
                   aria-hidden="true"
                   style={{
                     position: 'absolute',
                     left: 0,
                     top: 0,
                     bottom: 0,
                     width: `${Math.round(logoffGlowProgress * 100)}%`,
                     background: 'rgba(245,158,11,0.22)',
                     transition: 'width 0.8s ease',
                     pointerEvents: 'none',
                   }}
                 />
                 <span style={{ position: 'relative', zIndex: 1, color: '#fcd34d', fontSize: '0.55rem' }}>
                   🚪{getCompensatedLogOff()}
                 </span>
               </div>
            </div>
          </div>

          <div id="controls-right-col" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center', justifyContent: 'flex-end', ...helpStyle }}>
            <HelpLabel text="Tools & Rates" />
            
            {/* Rate Pills */}
            <div id="right-pills-vertical" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.2rem', alignItems: 'center' }}>
              {callsToday > 0 ? (
                <div id="pill-call-rate" className="metric-pill compact-pill" title={`CALL METRICS: You've taken ${callsToday} calls today. Your average call duration is ${avgCallMins} minutes per call.`} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.05rem 0.15rem' }}>
                  <span style={{ fontSize: '0.55rem', color: '#93c5fd', fontWeight: 700 }}>📞{callsToday}×{avgCallMins}m</span>
                </div>
              ) : (
                <div id="pill-no-calls" className="metric-pill compact-pill" style={{ opacity: 0.2, padding: '0.05rem 0.15rem' }}>
                  <span style={{ fontSize: '0.55rem' }}>📞 –</span>
                </div>
              )}
              {effectiveRateArsHr ? (
                <div id="pill-eff-rate" className="metric-pill compact-pill" 
                  onClick={() => setRateView(prev => prev === 'effective' ? 'active' : 'effective')}
                  title={rateView === 'effective' ? "EFFECTIVE RATE: Hourly wage including dead time. Click to see ACTIVE RATE." : "ACTIVE RATE: Hourly wage during actual calls (Max Rate). Click to see EFFECTIVE RATE."} 
                  style={{ background: rateView === 'effective' ? 'rgba(139,92,246,0.08)' : 'rgba(16,185,129,0.08)', border: rateOf(rateView) ? `1px solid ${rateView === 'effective' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)'}` : 'none', padding: '0.05rem 0.15rem', cursor: 'pointer' }}>
                  <span style={{ fontSize: '0.55rem', color: rateView === 'effective' ? '#c4b5fd' : '#10b981', fontWeight: 700 }}>
                    {rateView === 'effective' ? '⚡' : '🔥'}${Math.round(rateOf(rateView) / 1000)}k/h
                  </span>
                </div>
              ) : (
                <div id="pill-no-rate" className="metric-pill compact-pill" style={{ opacity: 0.2, padding: '0.05rem 0.15rem' }}>
                  <span style={{ fontSize: '0.55rem' }}>⚡ –</span>
                </div>
              )}
            </div>

            {/* Utility Tool Buttons - Consolidated Row */}
            <div id="right-tool-vertical" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '2px', marginTop: 'auto', justifyContent: 'center', alignItems: 'center' }}>
                {Object.entries(PRESET_LABELS).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="btn-icon tiny-btn"
                    onClick={() => applyScoreboardPreset(id)}
                    style={{
                      height: '22px', fontSize: '0.45rem', fontWeight: 800, padding: '0 3px',
                      opacity: scoreboardPreset === id ? 1 : 0.4,
                      background: scoreboardPreset === id ? 'rgba(239,68,68,0.2)' : 'transparent',
                    }}
                    title={`Scoreboard: ${label}`}
                  >
                    {id === 'minimal' ? 'Min' : id === 'standard' ? 'Std' : 'Full'}
                  </button>
                ))}
                <button id="header-notes-secondary-btn" className="btn-icon tiny-btn" onClick={toggleQuickNotes} style={{ opacity: isNotesOpen ? 1 : 0.3, width: '22px', height: '22px' }} title="Notes"><NotesIcon size={14} /></button>
                <button id="header-tools-btn" className="btn-icon tiny-btn" onClick={toggleToolbar} style={{ opacity: isToolbarVisible ? 1 : 0.3, background: isToolbarVisible ? 'rgba(239,68,68,0.15)' : 'transparent', width: '22px', height: '22px' }} title="Show tools (notes + background)"><ToolsIcon size={14} /></button>
                <button id="header-help-btn" className="btn-icon tiny-btn" onClick={() => setIsScoreboardHelpVisible(!isScoreboardHelpVisible)} style={{ opacity: isScoreboardHelpVisible ? 1 : 0.3, background: isScoreboardHelpVisible ? 'rgba(239,68,68,0.15)' : 'transparent', width: '22px', height: '22px' }} title="Scoreboard help labels"><HelpIcon size={14} /></button>
                <button id="header-edit-btn" className="btn-icon tiny-btn" onClick={() => { if(isCollapsed) setIsCollapsed(false); setIsEditingScoreboard(!isEditingScoreboard); }} style={{ opacity: isEditingScoreboard ? 1 : 0.3, width: '22px', height: '22px' }} title="Edit Grid"><EditIcon size={14} /></button>
                <button id="header-expand-btn" className="btn-icon tiny-btn" onClick={() => setIsCollapsed(!isCollapsed)} style={{ width: '22px', height: '22px' }} title={isCollapsed ? "Expand HUD" : "Collapse HUD"}>{isCollapsed ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}</button>
                <button id="header-calldetect-btn" className="btn-icon tiny-btn" onClick={() => setIsCallDetectionEnabled(!isCallDetectionEnabled)} style={{ opacity: isCallDetectionEnabled ? 1 : 0.3, background: isCallDetectionEnabled ? 'rgba(16,185,129,0.1)' : 'transparent', width: '22px', height: '22px' }} title="Call Detection">{isCallDetectionEnabled ? <SignalIcon size={14} /> : <SignalOffIcon size={14} />}</button>
                <button id="header-focus-btn" className="btn-icon tiny-btn" onClick={() => setCallFocusMode(!callFocusMode)} style={{ opacity: callFocusMode ? 1 : 0.3, background: callFocusMode ? 'rgba(16,185,129,0.1)' : 'transparent', width: '22px', height: '22px' }} title="Call Focus: auto-hide sidebars during calls">{callFocusMode ? <FocusIcon size={14} /> : <FocusOffIcon size={14} />}</button>
            </div>
          </div>
          </div>
          )}
        </div>
      )}

      {/* ── EXPANDED TWO-ROW DASHBOARD ── */}
      {(!isActive || callModeExpanded) && !isCollapsed && showExpandedIncome && (
        <div className={`income-dashboard${isActive ? ' income-dashboard--on-call' : ''}`}>
          
          {/* UPPER ROW: High-Level Progress & The Bounty */}
          <div className="dashboard-row dashboard-row-upper">
            
            {/* Today's Bounty (THE STAR) */}
            <div className="income-card" style={{ flex: '2 1 0', minWidth: 0, background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', padding: '0.3rem 0.4rem', borderRadius: '10px', ...helpStyle }} title={`TODAY'S BOUNTY: The remaining AR$ you need to earn today to hit your personalized daily goal (Target: AR$${dailyTargetArs.toLocaleString('es-AR')}).`}>
              <HelpLabel text="Bounty" />
              <span className="income-label" style={{ color: '#6ee7b7', fontWeight: 800 }}>💰 TODAY'S BOUNTY</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 900, 
                  color: isBountyAnimating ? '#fcd34d' : '#fff',
                  transition: 'color 0.3s ease',
                  textShadow: isBountyAnimating ? '0 0 15px rgba(252, 211, 77, 0.5)' : 'none',
                  whiteSpace: 'nowrap'
                }}>
                  <StatNumber value={displayBounty} prefix="AR$" size="xl" />
                </div>
                {isBountyAnimating && <span style={{ fontSize: '0.7rem', color: '#6ee7b7', animation: 'slideUpBounce 0.5s' }}>-tick</span>}
              </div>
              <span style={{ fontSize: '0.55rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Target: AR${dailyTargetArs.toLocaleString('es-AR')}</span>
            </div>

            {/* Monthly Profit */}
            {(isEditingScoreboard || visibleCards.month) && (
              <div className="income-card income-tier-1" style={{ flex: '1 1 0', minWidth: 0, position: 'relative' }} title="MONTHLY PROFIT: Your total banked earnings for the month against your ultimate monthly target.">
                <CardVisibilityToggle cardKey="month" />
                <span className="income-label">🗓️ MO.PROFIT</span>
                <span className="income-ars" style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span>🌊</span>
                  <StatNumber value={monthlyArs} prefix="$" size="lg" />
                </span>
                <span style={{ fontSize: '0.55rem', opacity: 0.5, whiteSpace: 'nowrap', display: 'flex', gap: '0.1rem' }}>
                  <span>/</span>
                  <StatNumber value={monthlyTargetArs} prefix="$" size="xs" />
                </span>
              </div>
            )}

            {/* Today's Shift Progress */}
            {(isEditingScoreboard || visibleCards.today) && (
              <div className="income-card income-tier-2" style={{ flex: '1 1 0', minWidth: 0, cursor: 'pointer', position: 'relative', ...helpStyle }} onClick={() => !isEditingScoreboard && setIsTodayDialOpen(true)} title="DAILY PROGRESS: Minutes banked today out of your total daily target minutes required based on your monthly pacing.">
                <CardVisibilityToggle cardKey="today" />
                <HelpLabel text="Daily Mins" />
                <span className="income-label">{activeDayEmoji} DAILY</span>
                <span className="income-ars" style={{ whiteSpace: 'nowrap' }}>🌊{Math.round(stats.dailyMinutes)}m/🎯{Math.round(dailyGoal)}m</span>
                <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>({(stats.dailyMinutes / (dailyGoal || 1) * 100).toFixed(0)}%)</span>
              </div>
            )}

            {/* Goal Ladder */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem', ...helpStyle }} title={`PRO LADDER: Your next immediate target on the 12-step ladder. Reaching ${nextMilestone}m levels you up!`}>
               <HelpLabel text="Ladder" />
               <span className="income-label">🪜 NEXT</span>
               <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#a855f7', whiteSpace: 'nowrap' }}>{nextGoalLabel}</span>
               <span style={{ fontSize: '0.55rem', opacity: 0.6, whiteSpace: 'nowrap' }}>{nextMilestone}m</span>
            </div>
          </div>

          {/* MIDDLE ROW: Smart Intelligence Metrics */}
          <div style={{ display: 'flex', gap: '0.4rem', padding: '0.2rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

            {/* PACE ETA */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: 'rgba(239,68,68,0.06)' }}
              title={`PACE ETA: Predicts the exact clock time you will hit your daily goal if you maintain your current rate of earning minutes. Currently projecting ${pacePrediction.label}. ${pacePrediction.detail || ''}`}>
              <span className="income-label">🎯 PACE ETA</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: pacePrediction.color }}>{pacePrediction.label}</span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{pacePrediction.detail || 'at current rate'}</span>
            </div>

            {/* QUALITY */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: 'rgba(239,68,68,0.06)' }}
              title={qualityScore?.goalUnreachable
                ? `DAY QUALITY: Goal (${Math.round(dailyGoal)}m) unreachable before midnight cutoff. Suggested adaptive realistic goal: ${qualityScore.suggestedGoal}m.`
                : qualityScore ? `DAY QUALITY: ${qualityScore.pct}% of your ideal required pace for your current session window. Keep it near 100%!` : 'DAY QUALITY: Not enough data yet to calculate pacing quality.'}>
              <span className="income-label">📈 QUALITY</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: qualityScore?.goalUnreachable ? '#f59e0b' : (qualityScore?.color || 'var(--text-muted)') }}>
                {qualityScore?.goalUnreachable ? `→ ${qualityScore.suggestedGoal}m` : qualityScore ? `${qualityScore.pct}%` : '–'}
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>
                {qualityScore?.goalUnreachable ? 'adapt today\'s goal' : 'vs ideal pace'}
              </span>
            </div>

            {/* STREAK */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: todayOnTrack ? 'rgba(16,185,129,0.08)' : 'rgba(251,146,60,0.06)' }}
              title={`STREAK: You have hit your goal for ${streak} consecutive past days. ${todayOnTrack ? "You have already hit today's goal! (+1 day added to streak at midnight)" : "Today is still in progress."}`}>
              <span className="income-label">🔥 STREAK</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: todayOnTrack ? '#10b981' : streak >= 3 ? '#fb923c' : streak > 0 ? '#fcd34d' : 'var(--text-muted)' }}>
                {streak > 0 ? `${streak}d` : ''}{todayOnTrack ? (streak > 0 ? '+today ✅' : 'today ✅') : streak === 0 ? 'none yet' : ''}
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{todayOnTrack ? 'goal already hit!' : 'past days at goal'}</span>
            </div>

            {/* CALL RATE */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: 'rgba(239,68,68,0.06)' }}
              title={`CALLS: You have taken ${callsToday} calls today, with an average duration of ${avgCallMins} minutes each.`}>
              <span className="income-label">📞 CALLS</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: callsToday > 0 ? '#93c5fd' : 'var(--text-muted)' }}>
                {callsToday > 0 ? `${callsToday}×${avgCallMins}m` : '–'}
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>count × avg mins</span>
            </div>

            {/* EFFECTIVE RATE */}
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, background: 'rgba(139,92,246,0.06)' }}
              title={`EFFECTIVE RATE: AR$${effectiveRateArsHr?.toLocaleString('es-AR') || '–'}/hr. This represents your true hourly wage today, factoring in both active call time and unpaid waiting time (Avail).`}>
              <span className="income-label">⚡ EFF. RATE</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: effectiveRateArsHr ? '#c4b5fd' : 'var(--text-muted)' }}>
                {effectiveRateArsHr ? `$${effectiveRateArsHr.toLocaleString('es-AR')}/h` : '–'}
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>incl. avail time</span>
            </div>

            {/* BREAK BUDGET */}
            {(isEditingScoreboard || visibleCards.break) && (
            <div className="income-card" style={{ flex: '1 1 0', minWidth: 0, position: 'relative', background: breakLeft < 15 ? 'rgba(239,68,68,0.06)' : 'rgba(251,146,60,0.06)' }}
              title={`BREAK BUDGET: You have ${Math.round(breakLeft)} minutes left of your ${breakLimit}-minute daily coffee break allowance.`}>
              <CardVisibilityToggle cardKey="break" />
              <span className="income-label">☕ BREAK LEFT</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: breakLeft < 15 ? '#ef4444' : breakLeft < 30 ? '#f59e0b' : '#6ee7b7' }}>
                {Math.round(breakLeft)}m
              </span>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>of {breakLimit}m budget</span>
            </div>
            )}

          </div>

          {/* LOWER ROW: Interaction & Live Metrics (no duplicate STOP/HOLD — sticky bar owns those) */}
          <div className="dashboard-row dashboard-row-lower">
            
            {/* Main Controls Group */}
            <div className="header-utility-inline" style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
              {!isActive && (
                <StateIndicators state={isBreakActive ? 'break' : 'avail'} breakMinutes={stats.dailyBreakMinutes || 0} />
              )}
              {isBreakActive ? (
                <button id="stop-break-btn" className="btn" onClick={stopBreak} style={{ background: '#fb923c', color: 'white' }}>STOP BREAK</button>
              ) : (
                <button id="break-btn" className="btn" onClick={startBreak} disabled={isActive} style={{ opacity: isActive ? 0.3 : 1 }}>COFFEE</button>
              )}
              
              <div className="header-utility-group" style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn-icon-tiny" onClick={() => setTimeEditMode('call')} title="Edit call time">✏️📞</button>
                <button className="btn-icon-tiny" onClick={() => setTimeEditMode('break')} title="Edit break time">✏️☕</button>
                <button className={`btn-icon-tiny ${isNotesOpen ? 'active' : ''}`} onClick={toggleQuickNotes} title="Notes">📝</button>
                <button className={`btn-icon-tiny ${isToolbarVisible ? 'active' : ''}`} onClick={toggleToolbar} title="Show tools (notes + background)">🛠️</button>
                <button className={`btn-icon-tiny ${isEditingScoreboard ? 'active' : ''}`} onClick={() => setIsEditingScoreboard(!isEditingScoreboard)} title="Edit Grid">{isEditingScoreboard ? '💾' : '✏️'}</button>
                <button className={`btn-icon-tiny ${isScoreboardHelpVisible ? 'active' : ''}`} onClick={() => setIsScoreboardHelpVisible(!isScoreboardHelpVisible)} title="Help">❓</button>
                <button className="btn-icon-tiny" onClick={() => setIsHeatmapOpen(true)} title="Heatmap">📅</button>
                <button className="btn-icon-tiny danger" onClick={() => setIsCollapsed(true)} title="Collapse">▲</button>
              </div>
            </div>

            {/* Current Call (Live) — hidden during active call (sticky bar shows timer) */}
            {(isEditingScoreboard || visibleCards.call) && !isActive && (
              <div className={`income-card ${isActive ? 'active' : ''}`} style={{ flex: '1 1 0', minWidth: 0, position: 'relative', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '0.5rem', ...helpStyle }} title="CURRENT CALL: Active duration and unbanked earnings of the ongoing call.">
                <CardVisibilityToggle cardKey="call" />
                <HelpLabel text="Call" />
                <span className="income-label" style={{ fontSize: '0.55rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>CALL ({formatTime(sessionSeconds)})</span>
                </span>
                <span className="income-ars" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  {renderSessionArs('sm')}
                </span>
              </div>
            )}

            {/* Audio Sinks — off-call only (I/O strip in sticky header during calls) */}
            {!isActive && (
            <div className="dashboard-audio-sinks" style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', flexShrink: 1, minWidth: 0 }}>
              <select
                className="btn"
                style={{ fontSize: '0.6rem', maxWidth: '80px', minWidth: '50px', flex: '1 1 0' }}
                value={selectedMicId}
                onChange={(e) => changeMicId(e.target.value)}
                onFocus={() => fetchDevices({ requestMicPermissionForLabels: true })}
              >
                <option value="">🎤 Mic</option>
                {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
              </select>
              <select
                className="btn"
                style={{ fontSize: '0.6rem', maxWidth: '80px', minWidth: '50px', flex: '1 1 0' }}
                value={selectedSinkId}
                onChange={(e) => changeSinkId(e.target.value)}
                onFocus={() => fetchDevices({ requestMicPermissionForLabels: false })}
              >
                <option value="">🔊 Spk</option>
                {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Spk ${d.deviceId.slice(0,5)}`}</option>)}
              </select>
            </div>
            )}

            {/* Shift Recovery Stats */}
            <div className="dashboard-shift-stats" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', borderLeft: isActive ? 'none' : '1px solid rgba(255,255,255,0.1)', paddingLeft: isActive ? 0 : '0.4rem', marginLeft: isActive ? 0 : 'auto', flexWrap: 'wrap', minWidth: 0 }}>
              <div className="income-card" title="SHIFT LATE: Minutes past 9:00 AM you first connected today.">
                <span className="income-label">🕒 LATE</span>
                <span style={{ fontSize: '0.8rem', color: (stats.shiftStartSentiment || 0) > 30 ? '#ef4444' : '#6ee7b7' }}>{Math.round(stats.shiftStartSentiment || 0)}m</span>
              </div>
              <div className="income-card" title="ESTIMATED LOG OFF: 18:00 + late arrival + breaks.">
                <span className="income-label">🚪LOGOUT</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fcd34d' }}>{getCompensatedLogOff()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress bars */}
      {(!isActive || callModeExpanded) && dailyGoal > 0 && showProgressStack && !offCallScoreboardView && (
        <div className="header-progress-stack" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.25rem 0.15rem 0.1rem' }}>
          {/* Monthly bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>🗓️ Day {currentDay}/{daysInMonth}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {!isMonthlyGoalMet ? (
                  <>
                    <span 
                      title={`PRO LADDER: Step ${currentIdx+1} of 12. Next target is ${nextMilestone}m. Reaching this unlocks richer sounds and levels up your status!`}
                      style={{ color: '#fff', background: 'rgba(239,68,68,0.3)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.4)', fontWeight: 800, cursor: 'help' }}>
                       🪜 {nextGoalLabel} ({nextMilestone}m)
                    </span>
                    <span 
                      title={`MONTHLY PROGRESS: ${Math.round(stats.monthlyMinutes)}m banked out of ${stats.goalMinutes}m target. 
You are ${((stats.monthlyMinutes / stats.goalMinutes) * 100).toFixed(1)}% through your goal.
${isInDeficit ? `⚠️ DEFICIT: Behind pace by ${Math.round(monthlyDeficitMins)}m.` : `✅ ON PACE: Ahead of projected daily average.`}`}
                      style={{ margin: '0 0.4rem', fontSize: '0.75rem', color: isMonthlyGoalMet ? '#10b981' : (isInDeficit ? '#f59e0b' : '#a855f7'), fontWeight: 800, cursor: 'help' }}>
                      {((stats.monthlyMinutes / (stats.goalMinutes || 1)) * 100).toFixed(1)}%
                    </span>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span 
                      title={`PACED MAX: If you keep working ${Math.round(dailyGoal)}m every day for the rest of the month, you are on track to bank AR$${monthlyMaxArs} total. Target is AR$${monthlyTargetArs.toLocaleString('es-AR')}.`}
                      style={{ background: 'rgba(139,92,246,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.3)', cursor: 'help' }}>
                      Paced Max: <strong style={{ color: '#d8b4fe', textShadow: '0 0 8px rgba(139,92,246,0.5)', display: 'inline-flex', alignItems: 'center' }}>
                        <StatNumber value={monthlyRemainingCashVal + monthlyArs} prefix="AR$" size="xs" />
                      </strong>
                    </span>
                  </>
                ) : (
                  <span style={{ color: stats.monthlyMinutes > stats.goalMinutes * 1.2 ? '#fcd34d' : '#34d399', fontWeight: 800 }}>
                    {stats.monthlyMinutes > milestones[11] ? '👑 LEGENDARY STATUS REACHED!' : stats.monthlyMinutes > stats.goalMinutes * 1.2 ? '🔥 UNSTOPPABLE!' : stats.monthlyMinutes > stats.goalMinutes * 1.1 ? '🚀 ORBIT (110%!)' : '🎉 Goal Met!'}
                  </span>
                )}
              </div>
              <span style={{ opacity: 0.5 }}>Goal: {stats.goalMinutes}m</span>
            </div>
            <div
              style={{ position: 'relative', marginTop: '0.3rem' }}
              onMouseEnter={(e) =>
                showProgressBarTooltip(e, {
                  icon: '🗓️',
                  heading: 'MONTHLY PROGRESS',
                  color: isMonthlyGoalMet ? '#10b981' : (isInDeficit ? '#f59e0b' : '#a855f7'),
                  body: `Banked: ${Math.round(stats.monthlyMinutes)}m / ${Math.round(stats.goalMinutes)}m.\n` +
                    `Including current call: ${Math.round(stats.monthlyMinutes + unbankedMins)}m.\n` +
                    `Progress: ${((monthlyProgressRatio || 0) * 100).toFixed(1)}% (pending: ${((monthlyPendingRatio || 0) * 100).toFixed(1)}%).`
                })
              }
              onMouseLeave={hideMetricTooltip}
            >
              <div style={{ height: '7px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${monthlyPendingRatio * 100}%`, backgroundColor: '#f97316', opacity: 0.9, transition: 'width 1s linear', zIndex: 1, boxShadow: unbankedMins > 0 ? '0 0 10px #f97316' : 'none' }} />
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${monthlyProgressRatio * 100}%`, backgroundColor: isMonthlyGoalMet ? '#10b981' : '#a855f7', transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 2 }} />
              {stats.monthlyMinutes > stats.goalMinutes && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, (stats.monthlyMinutes - stats.goalMinutes) / (stats.goalMinutes * 0.2)) * 100}%`, backgroundColor: 'rgba(245,158,11,0.8)', zIndex: 3 }} />}
              
              {/* Milestone Indicators (Checkpoints at 5.5k, 11k, 16.5k) */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 4 }}>
                {[5500, 11000, 16500].map((m, i) => {
                  const ratio = m / 16500;
                  return (
                    <div 
                      key={m} 
                      title={`Monthly Rank: ${['Floor (5.5k)', 'Growth (11k)', 'Legend (16.5k)'][i]}`}
                      style={{ 
                        position: 'absolute', left: `${ratio * 100}%`, top: 0, bottom: 0, width: '1px', 
                        background: 'rgba(255,255,255,0.6)',
                        boxShadow: '0 0 4px white',
                        pointerEvents: 'auto', cursor: 'help'
                      }}>
                    </div>
                  );
                })}
              </div>

              {/* 500min Nudges (8h shifts) overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none', zIndex: 4 }}>
                {Array.from({ length: Math.max(0, Math.floor((stats.goalMinutes || 16500) / 500)) }).map((_, i) => {
                  const m = (i + 1) * 500;
                  const ratio = m / (stats.goalMinutes || 16500);
                  if (ratio >= 1) return null;
                  
                  // Calculate absolute distance to the NEXT milestone on the Pro Ladder (steps of 1375)
                  const nextMilestoneAbsolute = Math.ceil((m + 1) / 1375) * 1375;
                  const minsToNextMilestone = nextMilestoneAbsolute - m;
                  const shiftsToNextMilestone = (minsToNextMilestone / 500).toFixed(1);

                  return (
                    <div 
                      key={m} 
                      title={`Shift Checkpoint: ${m}m. You are ${shiftsToNextMilestone} shifts (${minsToNextMilestone}m) away from the next Ladder Milestone (${nextMilestoneAbsolute}m).`}
                      style={{ 
                        position: 'absolute', left: `${ratio * 100}%`, top: 0, bottom: 0, width: '1px', 
                        background: 'rgba(239,68,68,0.5)',
                        pointerEvents: 'auto', cursor: 'help'
                      }}>
                    </div>
                  );
                })}
              </div>

              {/* Day Notches overlay */}
              <div 
                title="Each vertical notch represents one day of the month. The thick white line is TODAY."
                style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'auto', zIndex: 5, cursor: 'help' }}>
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1;
                  const dateObj = new Date(year, month, d);
                  const dStr = dateObj.toDateString();
                  const isToday = d === currentDay;
                  
                  return (
                    <div key={i} style={{ 
                      flex: 1, position: 'relative', 
                      borderRight: i < daysInMonth - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                      overflow: 'hidden'
                    }}>
                      <MiniDayTimeline 
                        dateStr={dStr} 
                        currentTimeline={isToday ? dailyTimeline : null}
                        dailyMins={isToday ? totalDailyMins : (dailyLog[dStr] || 0)}
                        goalMins={dailyGoal}
                      />
                    </div>
                  );
                })}
              </div>

              <div 
                title={`Today is Day ${currentDay}. Stay ahead of this line to keep your pace!`}
                style={{ position: 'absolute', top: 0, bottom: 0, left: `${monthElapsedRatio * 100}%`, width: '2px', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, cursor: 'help', pointerEvents: 'auto' }} />
            </div>
          </div>
          </div>

          {/* Step Goal (Weekly Replenishing Bar) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 600 }}>🪜 STEP {currentIdx + 1}/12 (1 WEEK OF MINIMUM WORK)</span>
                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', color: '#fff', fontSize: '0.55rem', fontWeight: 800 }}>
                  🗓️ Day {currentDay} (Week {Math.ceil(currentDay / 7)})
                </span>
              </div>
              <span title={`Each step on the Ladder is 1,375m. 4 steps = Min Goal (5.5k). 8 steps = Growth (11k). 12 steps = Legend (16.5k).`}>
                <strong style={{ color: stats.monthlyMinutes >= 11000 ? '#FCD34D' : (stats.monthlyMinutes >= 5500 ? '#C084FC' : '#60A5FA') }}>
                  {milestoneLabels[currentIdx]}
                </strong> ({Math.round(stats.monthlyMinutes % 1375)}m / 1375m)
              </span>
            </div>
            <div 
              title="Weekly Ladder: This bar fills up every 1375m. It's your current sprint target."
              onMouseEnter={(e) =>
                showProgressBarTooltip(e, {
                  icon: '🪜',
                  heading: 'WEEKLY LADDER',
                  color: stats.monthlyMinutes >= 11000 ? '#fcd34d' : (stats.monthlyMinutes >= 5500 ? '#a855f7' : '#ef4444'),
                  body: `Step: ${currentIdx + 1}/12.\n` +
                    `This sprint: ${Math.round(stats.monthlyMinutes % 1375)}m / 1375m.\n` +
                    `Current tier: ${milestoneLabels[currentIdx]}.`
                })
              }
              onMouseLeave={hideMetricTooltip}
              style={{ height: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden', position: 'relative', cursor: 'help' }}>
              <div style={{ 
                position: 'absolute', left: 0, top: 0, bottom: 0, 
                width: `${((stats.monthlyMinutes % 1375) / 1375) * 100}%`, 
                background: stats.monthlyMinutes >= 11000 ? '#fcd34d' : (stats.monthlyMinutes >= 5500 ? '#a855f7' : '#ef4444'),
                boxShadow: `0 0 10px ${stats.monthlyMinutes >= 11000 ? 'rgba(251,191,36,0.4)' : (stats.monthlyMinutes >= 5500 ? 'rgba(139,92,246,0.4)' : 'rgba(239,68,68,0.4)')}`,
                transition: 'width 0.5s ease-out',
                zIndex: 2
              }} />
              
              {/* 500min Nudges (8h shifts) overlay for the Step Bar */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 5 }}>
                {Array.from({ length: 7 }).map((_, i) => {
                   // Map 7 segments to the current week
                   const dayOfStep = Math.floor(currentDay / 7) * 7 + i;
                   if (dayOfStep > daysInMonth) return null;
                   const dateObj = new Date(year, month, dayOfStep);
                   const dStr = dateObj.toDateString();
                   const isToday = dayOfStep === currentDay;

                   return (
                     <div key={i} style={{ flex: 1, position: 'relative', borderRight: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                        <MiniDayTimeline 
                           dateStr={dStr} 
                           currentTimeline={isToday ? dailyTimeline : null}
                           dailyMins={isToday ? totalDailyMins : (dailyLog[dStr] || 0)}
                           goalMins={dailyGoal}
                        />
                     </div>
                   );
                })}
              </div>
            </div>
          </div>

          {/* Daily bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span title="Shift starts at 9:00 AM">☀️ 09:00 (Min: {dailyGoal}m)</span>
                {!isActive && (
                  <span
                    style={{ color: '#fdba74', fontWeight: 900 }}
                    title="Off-call elapsed today (avail + breaks)"
                  >
                    🚪 {formatTime(Math.floor(totalOffCallSeconds))}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {stats.dailyMinutes >= 480 ? (
                  <span style={{ color: '#fcd34d', fontWeight: 800 }}>👑 LEGENDARY DAY (480m+)</span>
                ) : stats.dailyMinutes >= 350 ? (
                  <span style={{ color: '#c084fc', fontWeight: 800 }}>🚀 GROWTH DAY (350m+)</span>
                ) : stats.dailyMinutes >= dailyGoal ? (
                  <span style={{ color: '#34d399', fontWeight: 800 }}>🎉 SHIFT MET ({dailyGoal}m)</span>
                ) : (
                  <>
                    <span title={`SHIFT REMAINING: ${Math.max(0, DAILY_SHIFT_END - currentTime).toFixed(1)} hours left until 18:00.`}>⏳ {Math.max(0, DAILY_SHIFT_END - currentTime).toFixed(1)}h left</span>
                    <span title={`ESTIMATED YIELD: Based on your current rate, you can realistically bank another ${Math.round(Math.max(0, DAILY_SHIFT_END - currentTime) * 35)}m today, worth AR$${Math.round(Math.max(0, DAILY_SHIFT_END - currentTime) * 35 * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')}.`}>({Math.round(Math.max(0, DAILY_SHIFT_END - currentTime) * 35)}m / AR$${Math.round(Math.max(0, DAILY_SHIFT_END - currentTime) * 35 * RATE_PER_MINUTE * arsRate).toLocaleString('es-AR')})</span>
                  </>
                )}
                <button
                  onClick={() => setOvertimeMode(m => m === 'tail' ? 'under' : 'tail')}
                  title={`Overtime display: ${overtimeMode === 'tail' ? 'Extended tail' : 'Micro under-bar'}. Click to toggle.`}
                  style={{ fontSize: '0.5rem', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', cursor: 'pointer', fontWeight: 700 }}
                >
                  {overtimeMode === 'tail' ? '➡️ TAIL' : '⬇️ UNDER'}
                </button>
              </div>
              <span title="Shift ends at 6:00 PM">🌙 18:00 (Focus: 480m)</span>
            </div>
            <div 
              title="Daily Multi-Tier Bar: Blue (Floor), Purple (350m Growth), Gold (480m focus)."
              onMouseEnter={(e) =>
                showProgressBarTooltip(e, {
                  icon: '☀️',
                  heading: 'DAILY PROGRESS',
                  color: stats.dailyMinutes >= 480 ? '#fcd34d' : (stats.dailyMinutes >= 350 ? '#c084fc' : '#f87171'),
                  body: `Banked today: ${Math.round(stats.dailyMinutes)}m.\n` +
                    `Including current call: ${Math.round(totalDailyMins)}m / 480m.\n` +
                    `Min target: ${Math.round(dailyGoal)}m.\n` +
                    `Off-call elapsed today: ${formatValue(totalOffCallMins)}`
                })
              }
              onMouseLeave={hideMetricTooltip}
              style={{ height: '6px', background: 'rgba(251, 146, 60, 0.1)', borderRadius: '3px', position: 'relative', overflow: overtimeMode === 'tail' ? 'visible' : 'hidden', cursor: 'help' }}>
              
              {/* Target Notches */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 4 }}>
                {[dailyGoal, 350].map(m => (
                  <div key={m} style={{ position: 'absolute', left: `${(m / 480) * 100}%`, top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }} />
                ))}
              </div>

              {/* Chronological Timeline Segments */}
              <div style={{ position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'auto' }}>
                {(() => {
                  const items = [];
                  const shiftEndMs = dailyShiftEndMs;
                  
                  dailyTimeline.forEach((evt, idx) => {
                    const start = evt.start;
                    const end = evt.end || Date.now();
                    const isHovered = hoveredTimelineEvent?.idx === idx;
                    
                    const renderSeg = (key, sPos, ePos, isOvertime) => (
                      <div 
                        key={key}
                        className={`timeline-segment ${evt.type} ${!evt.end ? 'ongoing' : ''} ${isOvertime ? 'overtime' : ''}`}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredTimelineEvent({ ...evt, idx, left: rect.left + rect.width/2 });
                        }}
                        onMouseLeave={() => setHoveredTimelineEvent(null)}
                        style={{ 
                          left: `${Math.max(0, sPos)}%`, 
                          width: `${Math.max(0.5, ePos - Math.max(0, sPos))}%`,
                          zIndex: evt.type === 'work' ? 10 : (evt.type === 'break' ? 9 : 8),
                          cursor: 'crosshair',
                          opacity: hoveredTimelineEvent && !isHovered ? 0.3 : 1,
                          transition: 'opacity 0.2s ease'
                        }} 
                      />
                    );
                    
                    if (overtimeMode === 'tail') {
                      if (end <= shiftEndMs || start >= shiftEndMs) {
                        const startPos = getDailyTimelinePos(start);
                        const endPos = getDailyTimelinePos(end);
                        items.push(renderSeg(idx, startPos, endPos, start >= shiftEndMs));
                      } else {
                        const startPos1 = getDailyTimelinePos(start);
                        items.push(renderSeg(idx, startPos1, 100, false));
                        items.push(renderSeg(`${idx}-ot`, 100, getDailyTimelinePos(end), true));
                      }
                    } else {
                      // under mode: main bar only shows shift time
                      if (start < shiftEndMs) {
                        const startPos = getDailyTimelinePos(start);
                        const endPos = Math.min(100, getDailyTimelinePos(end));
                        items.push(renderSeg(idx, startPos, endPos, false));
                      }
                    }
                  });
                  
                  return items;
                })()}

                {/* Popover */}
                {hoveredTimelineEvent && (
                  <div style={{
                    position: 'fixed',
                    left: `${hoveredTimelineEvent.left}px`,
                    bottom: 'calc(100% - 10px)',
                    transform: 'translateX(-50%) translateY(-20px)',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${hoveredTimelineEvent.type === 'work' ? '#f87171' : '#fb923c'}`,
                    padding: '0.4rem 0.6rem',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    animation: 'slideUpBounce 0.2s cubic-bezier(0.17, 0.88, 0.32, 1.28) forwards'
                  }}>
                    <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 900, color: hoveredTimelineEvent.type === 'work' ? '#f87171' : '#fb923c', letterSpacing: '0.05em' }}>
                      {hoveredTimelineEvent.type} PERIOD
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                      {new Date(hoveredTimelineEvent.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                      <span style={{ margin: '0 4px', opacity: 0.5 }}>→</span>
                      {hoveredTimelineEvent.end ? new Date(hoveredTimelineEvent.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NOW'}
                    </div>
                    <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>
                      Duration: {Math.round(((hoveredTimelineEvent.end || Date.now()) - hoveredTimelineEvent.start) / 60000)}m
                    </div>
                  </div>
                )}

                {/* Fill Avail gaps proactively */}
                {(() => {
                  const items = [];
                  if (dailyTimeline.length === 0 && stats.dayStartTime) {
                    const startPos = Math.max(0, getDailyTimelinePos(stats.dayStartTime));
                    const nowPos = getDailyTimelinePos(Date.now());
                    const endPos = overtimeMode === 'under' ? Math.min(100, nowPos) : nowPos;
                    items.push(<div key="init-avail" className="timeline-segment avail ongoing" style={{ left: `${startPos}%`, width: `${Math.max(0, endPos - startPos)}%` }} />);
                  }
                  return items;
                })()}
              </div>

              {/* Progress Fill (Unbanked) */}
              <div 
                title={`Unbanked Progress: You have ${formatTime(sessionSeconds)} in the current call.`}
                style={{ 
                  position: 'absolute', left: 0, top: 0, bottom: 0, 
                  width: `${Math.min(1, (stats.dailyMinutes + unbankedMins) / 480) * 100}%`, 
                  backgroundColor: '#f97316', 
                  opacity: 0.3, transition: 'width 1s linear', zIndex: 1, 
                  pointerEvents: 'none' 
                }} />
              
              {/* Progress Fill (Total Mins Goal Overlay) */}
              <div 
                title={`Daily Total (banked + current call): ${Math.round(totalDailyMins)}m`}
                style={{ 
                  position: 'absolute', left: 0, top: 0, bottom: 0, 
                  width: `${Math.min(1, totalDailyMins / 480) * 100}%`, 
                  backgroundColor: 'rgba(255,255,255,0.05)', 
                  transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 2, pointerEvents: 'none' 
                }} />
              
              {/* Hour Notches overlay */}
              <div 
                title={`Progress: ${liveDailyArs.toLocaleString('es-AR')} / ${dailyTargetArs.toLocaleString('es-AR')} ARS. Each notch = 1 hour of shift (9 AM - 6 PM).`}
                style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'auto', zIndex: 11, cursor: 'help' }}>

                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, borderRight: i < 8 ? '1px solid rgba(255,255,255,0.15)' : 'none' }} />
                ))}
              </div>

              <div 
                title="Current Time indicator. Keep the daily bar touching or ahead of this line."
                style={{ position: 'absolute', top: 0, bottom: 0, left: `${shiftElapsedRatio * 100}%`, width: '2px', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, cursor: 'help', pointerEvents: 'auto' }} />
            </div>
            
            {/* Overtime under-bar */}
            {overtimeMode === 'under' && (
              <div style={{ height: '3px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '1px', position: 'relative', overflow: 'hidden', marginTop: '1px' }}>
                {dailyTimeline.map((evt, idx) => {
                  const start = evt.start;
                  const end = evt.end || Date.now();
                  if (end <= dailyShiftEndMs) return null;
                  const startPos = start < dailyShiftEndMs ? 0 : getOvertimePos(start);
                  const endPos = getOvertimePos(end);
                  const isHovered = hoveredTimelineEvent?.idx === idx;
                  return (
                    <div 
                      key={`ot-${idx}`}
                      className={`timeline-segment ${evt.type} ${!evt.end ? 'ongoing' : ''} overtime`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredTimelineEvent({ ...evt, idx, left: rect.left + rect.width/2 });
                      }}
                      onMouseLeave={() => setHoveredTimelineEvent(null)}
                      style={{ 
                        left: `${startPos}%`, 
                        width: `${Math.max(0.5, endPos - startPos)}%`,
                        zIndex: evt.type === 'work' ? 10 : (evt.type === 'break' ? 9 : 8),
                        cursor: 'crosshair',
                        opacity: hoveredTimelineEvent && !isHovered ? 0.3 : 1,
                        transition: 'opacity 0.2s ease'
                      }} 
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      </>
      </div>
  );

  return (
    <>
    <header className={`dashboard-header glass-panel${headerMinimal ? ' dashboard-header--minimal' : ''}${headerCallCompact ? ' dashboard-header--call-compact' : ''}${isActive && callModeExpanded ? ' dashboard-header--call-expanded' : ''}${offCallScoreboardView ? ' dashboard-header--off-call-scoreboard' : ''}${offCallScoreboardView && offCallMetricsExpanded ? ' dashboard-header--metrics-expanded' : ''}`} style={{ position: 'relative', zIndex: 100 }}>
      {versionLabel && (
        <div className="app-version-pill" style={{ position: 'absolute', top: 6, right: 8 }}>
          {versionLabel}
        </div>
      )}
      <SessionControlsSticky
        isActive={isActive}
        isBreakActive={isBreakActive}
        isZombieCall={isZombieCall}
        apiKeyMissing={apiKeyMissing}
        vaultNeedsDecrypt={vaultNeedsDecrypt}
        apiKeyMissingNoVault={apiKeyMissingNoVault}
        audioAttached={audioAttached}
        micTestMode={micTestMode}
        setMicTestMode={setMicTestMode}
        connectionState={connectionState}
        connectionMessage={connectionMessage}
        connectProgress={connectProgress}
        apiKeyRejected={apiKeyRejected}
        settingsOpen={settingsOpen}
        vaultStatus={vaultStatus}

        showEndDayButton={showEndDayButton}
        onEndDay={handleEndDay}

        connectFlash={connectFlash}
        connectLabel={connectLabel}
        connectSingleTitle={connectSingleTitle}
        connectDoubleTitle={connectDoubleTitle}
        connectOnSingle={connectOnSingle}
        connectOnDouble={connectOnDouble}
        requireDoubleTapIndicator={connectRequireDoubleTapIndicator}
        pendingDoubleTapTitle="Tap again to pick tab"
        onArmDoubleTap={() => audioEngine.playWarningPing?.()}

        minutesSinceLastBreak={minutesSinceLastBreak}
        shouldBreakNudge={shouldBreakNudge}
        breakNudgeStage={breakNudgeStage}
        stopBreak={stopBreak}
        onStartBreak={handleStartBreak}

        handleStop={handleStop}
        isHold={isHold}
        setIsHold={setIsHold}
        disableZap={false}
        isZapping={isZapping}
        onReconnectStream={handleZap}

        silenceCount={silenceCount}
        lastEnglishActivityTime={lastEnglishActivityTime}
        sessionSeconds={sessionSeconds}
        sessionArsLive={sessionArsLive}
        totalOffCallSeconds={totalOffCallSeconds}
        callModeExpanded={callModeExpanded}
        setCallModeExpanded={setCallModeExpanded}
        isNotesOpen={isNotesOpen}
        setIsNotesOpen={setIsNotesOpen}

        tabStreamReady={tabStreamReady}
        cableStreamReady={cableStreamReady}
        lastDataTime={lastDataTime}
        onOpenSoundboard={onOpenSoundboard}
        soundboardOpen={soundboardOpen}
        onOpenGoalDial={() => setIsTodayDialOpen(true)}
        sttLanguage={sttLanguage}
        onToggleLanguage={onToggleLanguage}
        configuredAudioSourceMode={configuredAudioSourceMode}
        attachedAudioSourceMode={attachedAudioSourceMode}
        virtualCableFailure={virtualCableFailure}
        onReconnectAudioSource={onReconnectAudioSource}
        onSwitchToTabShare={onSwitchToTabShare}
        onOpenLanguageSettings={() => {
          try {
            window.dispatchEvent(new CustomEvent('cat_show_language_settings'));
          } catch (_) {}
        }}
        languagePairLabel={languagePairLabel}
        versionLabel={versionLabel}
      />

      {!headerMinimal && (
        headerCallCompact
          ? null
          : offCallScoreboardView && !offCallMetricsExpanded
            ? renderOffCallCollapsedBody()
            : renderWorkspaceBody()
      )}

      {isTodayDialOpen && createPortal(
        <>
          <div
            role="presentation"
            onClick={() => setIsTodayDialOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9998 }}
          />
          <DialGoalSelector
            modal
            ratePerMinute={RATE_PER_MINUTE}
            arsRate={arsRate}
            setArsRate={setArsRate}
            initialGoalMinutes={stats.goalMinutes}
            onSave={(m) => { updateStat('goalMinutes', m); setIsTodayDialOpen(false); }}
            onCancel={() => setIsTodayDialOpen(false)}
          />
        </>,
        document.body
      )}

      {isHeatmapOpen && <MonthHeatmap />}

      {timeEditMode && <TimeEditModal mode={timeEditMode} onClose={() => setTimeEditMode(null)} />}

      {celebration && (
        <CelebrationParticles
          {...celebration}
          onDismiss={() => setCelebration(null)}
        />
      )}
    </header>

    </>
  );
};
