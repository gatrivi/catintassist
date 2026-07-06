import React, { useEffect, useState, useCallback, useRef } from "react";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import { AudioSettingsProvider } from "./contexts/AudioSettingsContext";
import { AuthProvider } from "./contexts/AuthContext";
import { DashboardHeader } from "./components/DashboardHeader";
import { TranscriptionBoard } from "./components/TranscriptionBoard";
import { GreetingsPanel } from "./components/GreetingsPanel";
import OnCallSoundboardStrip from "./components/OnCallSoundboardStrip";
import { NotePad } from "./components/NotePad";
import { DictionaryTool } from "./components/DictionaryTool";
import { SilenceGuardian } from "./components/SilenceGuardian";
import { DeskExerciseWidget } from "./components/DeskExerciseWidget";
import { RosaryWidget } from "./components/RosaryWidget";
import { MealTrackerWidget } from "./components/MealTrackerWidget";
import { ChoreTrackerWidget } from "./components/ChoreTrackerWidget";
import {
  OFF_CALL_VIEWS,
  loadWorkspaceView,
  saveWorkspaceView,
  hasSeenStudioHint,
  markStudioHintSeen,
} from "./components/WorkspaceViewSwitcher";
import { useDeepgram } from "./hooks/useDeepgram";
import { useAudioSource } from "./hooks/useAudioSource";
import { useDevSimulate } from "./hooks/useDevSimulate";
import { useProgressiveAudio } from "./hooks/useProgressiveAudio";
import { useAppUpdateCheck } from "./hooks/useAppUpdateCheck";
import { UpdateAppBanner } from "./components/UpdateAppBanner";
import { loadFile, generateObjectUrl } from "./utils/storage";
import { resolveAppBackgroundPath } from "./utils/defaultBackgrounds";
import SettingsPanel from "./components/SettingsPanel";
import { OffCallWorkspace } from "./components/OffCallWorkspace";
import { SplashScreen } from "./components/SplashScreen";
import { GuideHostProvider } from "./contexts/GuideHostContext";
import { ElementHintProvider } from "./components/ElementHint";
import { isSplashSeenThisSession } from "./utils/splashStorage";
import { isAppGuideDone } from "./utils/appGuideStorage";
import {
  getRuntimeDeepgramKey,
  hasConfiguredDeepgramKey,
  isValidDeepgramApiKey,
  isRememberExpired,
} from "./utils/deepgramRuntimeKey";
import { applyThemePalette, loadThemePalette } from "./utils/themePalette";
import { APP_VERSION_LABEL } from "./constants/version";
import { setSttActive } from "./utils/routeDiagnostics";
import { isWellbeingDockEnabled } from "./utils/wellbeingDock";
import {
  isComponentVisible,
  useComponentVisibilityRefresh,
} from "./utils/componentVisibility";
import "./index.css";

const focusQuickNotesSoon = () => {
  window.setTimeout(() => {
    window.dispatchEvent(new Event("catint_focus_notes"));
  }, 80);
};

const Dashboard = () => {
  const {
    startRecording,
    startRecordingFresh,
    stopRecording,
    reconnectStream,
    captions,
    clearCaptions,
    sttLanguage,
    toggleLanguage,
    connectionState,
    connectionMessage,
    apiKeyRejected,
    connectProgress,
    lastDataTime,
    micTestMode,
    setMicTestMode,
    tabStreamReady,
    cableStreamReady,
    attachedAudioSourceMode,
    virtualCableFailure,
    switchAudioSourceModeSafely,
  } = useDeepgram();
  useDevSimulate();
  const {
    currentSourceMode: configuredAudioSourceMode,
    switchAudioSourceMode,
  } = useAudioSource();
  const {
    isNotesOpen,
    setIsNotesOpen,
    isActive,
    hipaaGraceActive,
    isBreakActive,
    isZombieCall,
    minutesSinceLastBreak,
    startSession,
    cancelHipaaDisconnectGrace,
    clearZombieState,
    callFocusMode,
    stopBreak,
    isToolbarVisible,
    autoAttachEnabled,
  } = useSession();
  const { playCoin } = useProgressiveAudio();
  const { updateAvailable, latestVersionToken, dismissUpdate, reloadToUpdate } =
    useAppUpdateCheck();
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [workspaceView, setWorkspaceView] = useState(loadWorkspaceView);
  const resetUiState = useCallback(() => {
    // UI-only reset: do NOT touch Deepgram/API keys or transcripts.
    try {
      localStorage.setItem('catint_active', 'false');
    } catch {}

    [
      'catint_workspace_view',
      'catint_workspace_initialized',
      'catint_studio_hint_seen',
      'catint_break',
      'catint_hold',
    ].forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    try {
      // Ensure immediate UI mode switches before reload.
      window.dispatchEvent(new CustomEvent('catint_ui_reset_started'));
    } catch {}

    try {
      window.location.reload();
    } catch {
      // In case reload is blocked, at least clear zombie UI locally.
      clearZombieState?.();
    }
  }, [clearZombieState]);

  // Dev helper (and troubleshooting) for persisted runtime-state mess.
  useEffect(() => {
    try {
      window.catintResetUiState = resetUiState;
    } catch {
      // ignore
    }
  }, [resetUiState]);
  const [showStudioHint, setShowStudioHint] = useState(
    () => !hasSeenStudioHint(),
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState("deepgram");
  const [showWellbeingDock, setShowWellbeingDock] = useState(isWellbeingDockEnabled);
  const [quickNotesNotice, setQuickNotesNotice] = useState("");
  const [, setRuntimeKeyTick] = useState(0);
  const [shellReady, setShellReady] = useState(() => isSplashSeenThisSession());
  const [showSplash, setShowSplash] = useState(() => !isSplashSeenThisSession());
  const [showVersionBadge, setShowVersionBadge] = useState(() => {
    try {
      return localStorage.getItem('catint_show_version_badge_v1') !== '0';
    } catch {
      return true;
    }
  });
  useComponentVisibilityRefresh();

  useEffect(() => {
    setSttActive(connectionState === "connected");
    return () => setSttActive(false);
  }, [connectionState]);

  useEffect(() => {
    const onToggle = (e) => {
      const enabled = e?.detail?.enabled;
      if (typeof enabled === 'boolean') setShowVersionBadge(enabled);
    };
    window.addEventListener('catint_show_version_badge_changed', onToggle);
    return () => window.removeEventListener('catint_show_version_badge_changed', onToggle);
  }, []);

  const showWellbeingWidgets =
    showWellbeingDock &&
    isComponentVisible('wellbeing_dock', { isActive, isZombieCall });

  const showQuickNotesNotice = useCallback((message) => {
    setQuickNotesNotice(message);
    window.setTimeout(() => setQuickNotesNotice(""), 3200);
  }, []);

  const toggleQuickNotes = useCallback(() => {
    setIsNotesOpen((open) => {
      const next = !open;
      console.info(`[QuickNotes] ${next ? "open requested" : "closed"}`, {
        isActive,
        isZombieCall,
        hipaaGraceActive,
        workspaceView,
        isEditingBg,
      });
      if (next) {
        if (isEditingBg) {
          showQuickNotesNotice("Quick notes blocked: close the soundboard/background editor first.");
        } else {
          showQuickNotesNotice("Quick notes opened.");
          focusQuickNotesSoon();
        }
      }
      return next;
    });
  }, [hipaaGraceActive, isActive, isEditingBg, isZombieCall, setIsNotesOpen, showQuickNotesNotice, workspaceView]);

  useEffect(() => {
    console.info("[QuickNotes] state", {
      open: isNotesOpen,
      panelMounted: isNotesOpen,
      blockedByEditor: isEditingBg,
      mode: isActive || isZombieCall || hipaaGraceActive ? "call" : workspaceView,
    });
    if (isNotesOpen && !isEditingBg) focusQuickNotesSoon();
  }, [hipaaGraceActive, isActive, isEditingBg, isNotesOpen, isZombieCall, workspaceView]);
  useEffect(() => {
    const onRuntime = () => setRuntimeKeyTick((t) => t + 1);
    const onShowVault = () => {
      setSettingsSection("deepgram");
      setSettingsOpen(true);
    };
    const onShowSettings = () => {
      setSettingsSection("deepgram");
      setSettingsOpen(true);
    };
    const onShowLanguageSettings = () => {
      setSettingsSection("language");
      setSettingsOpen(true);
    };

    window.addEventListener("cat_deepgram_runtime_key_changed", onRuntime);
    window.addEventListener("cat_show_deepgram_key_vault", onShowVault);
    window.addEventListener("cat_show_settings", onShowSettings);
    window.addEventListener("cat_show_language_settings", onShowLanguageSettings);
    const onWellbeingDock = () => setShowWellbeingDock(isWellbeingDockEnabled());
    window.addEventListener("cat_wellbeing_dock_changed", onWellbeingDock);
    window.addEventListener("cat_personal_dock_changed", onWellbeingDock);
    return () => {
      window.removeEventListener("cat_deepgram_runtime_key_changed", onRuntime);
      window.removeEventListener("cat_show_deepgram_key_vault", onShowVault);
      window.removeEventListener("cat_show_settings", onShowSettings);
      window.removeEventListener("cat_show_language_settings", onShowLanguageSettings);
      window.removeEventListener("cat_wellbeing_dock_changed", onWellbeingDock);
      window.removeEventListener("cat_personal_dock_changed", onWellbeingDock);
    };
  }, []);

  const hasRuntimeKey = isValidDeepgramApiKey(getRuntimeDeepgramKey());
  const apiKeyMissing = !hasConfiguredDeepgramKey();

  useEffect(() => {
    if (hasRuntimeKey) setSettingsOpen(false);
  }, [hasRuntimeKey]);

  // UX: stale tab flag is cleared in useDeepgram when no live stream exists.

  const offCallWorkspace = isActive || isZombieCall ? null : workspaceView;
  const isSoundboardStudio = offCallWorkspace === "soundboard";

  const cycleWorkspaceView = useCallback(() => {
    if (isActive || isZombieCall) return;
    markStudioHintSeen();
    setShowStudioHint(false);
    setWorkspaceView((prev) => {
      const i = OFF_CALL_VIEWS.indexOf(prev);
      const next = OFF_CALL_VIEWS[(i + 1) % OFF_CALL_VIEWS.length];
      saveWorkspaceView(next);
      return next;
    });
  }, [isActive, isZombieCall]);

  const exitSoundboardStudio = useCallback(() => {
    if (isActive || isZombieCall) return;
    markStudioHintSeen();
    setShowStudioHint(false);
    saveWorkspaceView("scoreboard");
    setWorkspaceView("scoreboard");
  }, [isActive, isZombieCall]);

  const prepareGuideView = useCallback((action = {}) => {
    if (!action) return;
    if (action.workspace && OFF_CALL_VIEWS.includes(action.workspace)) {
      markStudioHintSeen();
      setShowStudioHint(false);
      saveWorkspaceView(action.workspace);
      setWorkspaceView(action.workspace);
    }
    if (action.settingsSection) {
      setSettingsSection(action.settingsSection);
      setSettingsOpen(true);
    } else if (action.closeSettings) {
      setSettingsOpen(false);
    }
    window.dispatchEvent(new CustomEvent("cat_guide_prepare_view", { detail: action }));
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    setShellReady(true);
    // Block tour until STT can work — one modal at a time.
    if (!hasConfiguredDeepgramKey()) {
      setSettingsSection("deepgram");
      setSettingsOpen(true);
      return;
    }
    if (!isAppGuideDone()) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("cat_open_app_guide"));
      }, 500);
    }
  }, []);

  const [guideOverlayOpen, setGuideOverlayOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setGuideOverlayOpen(true);
    const onClose = () => setGuideOverlayOpen(false);
    window.addEventListener("cat_open_app_guide", onOpen);
    window.addEventListener("cat_guide_overlay_closed", onClose);
    return () => {
      window.removeEventListener("cat_open_app_guide", onOpen);
      window.removeEventListener("cat_guide_overlay_closed", onClose);
    };
  }, []);

  useEffect(() => {
    if (!shellReady || showSplash || isActive || isZombieCall) return;
    if (!hasConfiguredDeepgramKey()) {
      setSettingsSection("deepgram");
      setSettingsOpen(true);
    }
  }, [shellReady, showSplash, isActive, isZombieCall]);

  const blockSecondaryChrome =
    showSplash || !shellReady || settingsOpen || guideOverlayOpen;

  useEffect(() => {
    applyThemePalette(loadThemePalette());
    const onTheme = (e) => applyThemePalette(e.detail || loadThemePalette());
    window.addEventListener("catint_theme_palette_changed", onTheme);
    return () => window.removeEventListener("catint_theme_palette_changed", onTheme);
  }, []);

  useEffect(() => {
    let objectUrl = null;
    const applyBg = async () => {
      const bgApp = await loadFile("bg_app");
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      const url = bgApp
        ? (objectUrl = generateObjectUrl(bgApp))
        : resolveAppBackgroundPath(null, { advance: true });
      document.body.style.backgroundImage = `url(${url})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundAttachment = "fixed";
    };
    applyBg();

    window.addEventListener("cat_bg_changed", applyBg);
    return () => {
      window.removeEventListener("cat_bg_changed", applyBg);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  // Matrix Mode Easter Egg
  useEffect(() => {
    const konamiCode = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
    let index = 0;
    const handleKeyDown = (e) => {
      if (e.key === konamiCode[index]) {
        index++;
        if (index === konamiCode.length) {
          const current = document.body.getAttribute("data-easter-egg");
          document.body.setAttribute(
            "data-easter-egg",
            current === "matrix" ? "" : "matrix",
          );
          index = 0;
        }
      } else {
        index = 0;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Hotkeys for language switching
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping =
        e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT";

      if (e.code === "Escape" || (e.altKey && e.code === "Space")) {
        e.preventDefault();
        toggleLanguage();
      } else if (e.code === "Space" && !isTyping) {
        e.preventDefault();
        toggleLanguage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleLanguage]);

  // Track idle time for full app vignette
  const [idleSecs, setIdleSecs] = useState(0);
  useEffect(() => {
    if (isActive || isBreakActive) {
      setIdleSecs(0);
      return;
    }
    const iv = setInterval(() => setIdleSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [isActive, isBreakActive]);

  const isBurnoutWarning = !isBreakActive && minutesSinceLastBreak > 110;
  // PRIORITY FIX: isActive (Call) must always block app-idle vignette
  const stateClass = isActive
    ? "app-active"
    : isBreakActive
      ? "app-break"
      : isBurnoutWarning
        ? "burnout-alert"
        : idleSecs > 45
          ? "app-idle"
          : "";
  const appState =
    isZombieCall && connectionState !== "connected"
      ? "zombie"
      : isActive
        ? "call"
        : isBreakActive
          ? "break"
          : "avail";

  // Audio attached = sockets live + tab stream / mic test / virtual cable.
  const audioAttached =
    connectionState === "connected" &&
    (micTestMode || tabStreamReady || cableStreamReady);

  // Step 1: attach audio only (no call timer, no transcript capture).
  const handleAttachAudio = useCallback(
    async (fresh = false) => {
      cancelHipaaDisconnectGrace?.();
      if (isBreakActive) stopBreak();
      return fresh ? startRecordingFresh() : startRecording();
    },
    [startRecording, startRecordingFresh, isBreakActive, stopBreak, cancelHipaaDisconnectGrace],
  );

  // Step 2: start call timer + transcription UI (audio should already be attached).
  const handleStartCall = useCallback(
    (isRecovery = false) => {
      cancelHipaaDisconnectGrace?.();
      if (isBreakActive) stopBreak();
      if (isRecovery) clearZombieState();
      startSession(isRecovery);
    },
    [startSession, clearZombieState, isBreakActive, stopBreak, cancelHipaaDisconnectGrace],
  );

  // Zombie refresh: re-attach audio then resume preserved call state.
  const handleRecovery = useCallback(async () => {
    // HIPAA: cancel any pending disconnect grace when resuming a preserved call.
    cancelHipaaDisconnectGrace?.();
    if (isBreakActive) stopBreak();
    let ok = audioAttached;
    if (!ok) ok = await startRecording();
    if (ok) handleStartCall(true);
  }, [audioAttached, startRecording, handleStartCall, isBreakActive, stopBreak, cancelHipaaDisconnectGrace]);

  const handleConnectAnotherTab = useCallback(async () => {
    // HIPAA: cancel any pending disconnect grace when attaching a new stream.
    cancelHipaaDisconnectGrace?.();
    if (isBreakActive) stopBreak();
    await startRecordingFresh();
  }, [startRecordingFresh, isBreakActive, stopBreak, cancelHipaaDisconnectGrace]);

  const AUTO_ATTACH_KEY = "catint_auto_attach_v1";
  const autoAttachAttemptedRef = useRef(false);

  // Auto-attach interpreting tab at/after 09:00 (once per day, off-call only).
  useEffect(() => {
    const tryAutoAttach = async () => {
      if (!autoAttachEnabled) return;
      const now = new Date();
      if (now.getHours() < 9) return;
      if (isActive || isBreakActive || isZombieCall) return;
      if (audioAttached || connectionState === "connecting") return;

      const today = now.toDateString();
      try {
        if (localStorage.getItem(AUTO_ATTACH_KEY) === today) return;
      } catch {}

      if (autoAttachAttemptedRef.current) return;
      autoAttachAttemptedRef.current = true;

      const ok = await startRecordingFresh();
      if (ok) {
        try {
          localStorage.setItem(AUTO_ATTACH_KEY, today);
        } catch {}
      } else {
        autoAttachAttemptedRef.current = false;
      }
    };

    tryAutoAttach();
    // Single-shot attempt. No retry loops: browser tab-capture prompts are blocking.
    return undefined;
  }, [
    isActive,
    isBreakActive,
    isZombieCall,
    audioAttached,
    startRecordingFresh,
    autoAttachEnabled,
  ]);

  // Hotkeys: C = connect/attach or start call; M = mic test toggle.
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping =
        e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT";
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === "KeyM" && !isActive) {
        e.preventDefault();
        setMicTestMode(!micTestMode);
        return;
      }
      if (e.code === "KeyC" && !isActive && !isBreakActive) {
        e.preventDefault();
        if (isZombieCall) {
          handleRecovery();
        } else if (!audioAttached) {
          handleAttachAudio(false);
        } else {
          handleStartCall(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isActive,
    isBreakActive,
    isZombieCall,
    audioAttached,
    micTestMode,
    setMicTestMode,
    handleAttachAudio,
    handleStartCall,
    handleRecovery,
  ]);

  // Micro-break nudge: top bar color shifts when working too long without a break
  const micBarColor =
    connectionState === "error"
      ? "#ef4444"
      : isZombieCall && connectionState !== "connected"
      ? "#f59e0b"
      : isActive && minutesSinceLastBreak > 110
        ? "#f59e0b"
        : isActive && minutesSinceLastBreak > 90
          ? "#f59e0b"
          : "#10b981";
  const micBarShadow =
    connectionState === "error"
      ? "0 0 8px #ef4444"
      : isZombieCall && connectionState !== "connected"
        ? "0 0 8px #f59e0b"
      : isActive && minutesSinceLastBreak > 90
        ? "0 0 8px #f59e0b"
        : "0 0 8px #10b981";

  // Off-call idle tick: progressively deeper, but less frequent/less annoying
  const idleMinuteCountRef = useRef(0);
  useEffect(() => {
    if (isActive || isBreakActive) {
      idleMinuteCountRef.current = 0;
      return;
    }
    const iv = setInterval(() => {
      idleMinuteCountRef.current += 1;
      playCoin(idleMinuteCountRef.current);
    }, 90000);
    return () => clearInterval(iv);
  }, [isActive, isBreakActive, playCoin]);

  // Escape exits Soundboard Studio when off-call (skip if editor modal open)
  useEffect(() => {
    if (!isSoundboardStudio || isActive || isZombieCall) return;
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector(".sb-editor-overlay")) return;
      exitSoundboardStudio();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSoundboardStudio, isActive, isZombieCall, exitSoundboardStudio]);

  // Demo Scenario Trigger (Shift + D)
  useEffect(() => {
    const scenarios = ["call", "goal_hit", "break", "reset"];
    let scenarioIdx = 0;

    const handleKeyDown = (e) => {
      if (e.shiftKey && e.code === "KeyD") {
        const scenario = scenarios[scenarioIdx];
        scenarioIdx = (scenarioIdx + 1) % scenarios.length;

        // Trigger global demo event
        const event = new CustomEvent("cat_demo_scenario", {
          detail: scenario,
        });
        window.dispatchEvent(event);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const renderNotesPanel = () => {
    if (!isNotesOpen) return null;
    return (
      <div className="tools-column notes-open">
        <div
          className="glass-panel tools-notes"
          style={{
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: isActive && callFocusMode ? "200px" : undefined,
          }}
        >
          {isEditingBg ? (
            <div className="quick-notes-blocked" role="status">
              Quick notes are paused while the soundboard/background editor is open.
              <button type="button" onClick={() => setIsEditingBg(false)}>
                Close editor
              </button>
            </div>
          ) : (
            <>
              {(!isActive || !callFocusMode) && <DictionaryTool />}
              <NotePad />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <ElementHintProvider>
    <GuideHostProvider prepareGuideView={prepareGuideView}>
    <div
      className={`app-container ${stateClass}${shellReady ? " app-shell-ready" : ""}`}
      data-state={appState}
      data-call-mode={isActive || isZombieCall ? "true" : "false"}
      data-off-call-view={isActive || isZombieCall ? "call" : workspaceView}
    >
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialSection={settingsSection}
      />

      {apiKeyMissing && !isActive && !isZombieCall && !blockSecondaryChrome && (
        <div
          style={{
            position: "fixed",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 99990,
            background: "rgba(245,158,11,0.15)",
            border: "1px solid rgba(245,158,11,0.4)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: "0.68rem",
            color: "#fcd34d",
            cursor: "pointer",
          }}
          onClick={() => {
            setSettingsSection("deepgram");
            setSettingsOpen(true);
          }}
        >
          {isRememberExpired()
            ? "🔐 Password expired — open Settings (⚙)"
            : "🔑 Deepgram key needed — open Settings (⚙)"}
        </div>
      )}

      <div
        id="top-mic-bar-container"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <div
          id="top-mic-bar"
          style={{
            height: "100%",
            width: "0%",
            background: micBarColor,
            transition: "width 0.05s ease-out, background 0.5s ease",
            opacity: 0,
            boxShadow: micBarShadow,
          }}
        />
      </div>

      <SilenceGuardian lastDataTime={lastDataTime} />

      <a href="#main-transcript" className="skip-to-main">
        Skip to transcript
      </a>

      <DashboardHeader
        versionLabel={showVersionBadge ? APP_VERSION_LABEL : ''}
        onAttachAudio={() => handleAttachAudio(false)}
        onAttachAudioFresh={() => handleAttachAudio(true)}
        onStartCall={() => handleStartCall(false)}
        onStopAudio={stopRecording}
        onReconnectStream={reconnectStream}
        onRecovery={handleRecovery}
        onConnectAnotherTab={handleConnectAnotherTab}
        audioAttached={audioAttached}
        sttLanguage={sttLanguage}
        onToggleLanguage={toggleLanguage}
        connectionState={connectionState}
        connectionMessage={connectionMessage}
        apiKeyRejected={apiKeyRejected}
        connectProgress={connectProgress}
        lastDataTime={lastDataTime}
        micTestMode={micTestMode}
        setMicTestMode={setMicTestMode}
        tabStreamReady={tabStreamReady}
        cableStreamReady={cableStreamReady}
        configuredAudioSourceMode={configuredAudioSourceMode}
        attachedAudioSourceMode={attachedAudioSourceMode}
        virtualCableFailure={virtualCableFailure}
        onReconnectAudioSource={() => switchAudioSourceModeSafely?.(configuredAudioSourceMode)}
        onSwitchToTabShare={async () => {
          try {
            switchAudioSourceMode("tab");
          } catch (_) {}
          return switchAudioSourceModeSafely?.("tab");
        }}
        offCallWorkspace={offCallWorkspace}
        onCycleWorkspace={cycleWorkspaceView}
        showStudioHint={showStudioHint}
        settingsOpen={settingsOpen}
        onOpenSoundboard={() => {
          if (workspaceView === "soundboard") {
            exitSoundboardStudio();
          } else {
            saveWorkspaceView("soundboard");
            setWorkspaceView("soundboard");
          }
        }}
        soundboardOpen={isSoundboardStudio}
      />

      {!(isActive || isZombieCall) && workspaceView === "scoreboard" && (
        <OffCallWorkspace
          audioAttached={audioAttached}
          micTestMode={micTestMode}
          connectionState={connectionState}
          notesOpen={isNotesOpen}
          notesPanel={renderNotesPanel()}
        />
      )}

      {isSoundboardStudio && (
        <main className={`main-content view-soundboard${isNotesOpen ? " notes-open" : ""}`}>
          <div
            className="workspace-soundboard-pane glass-panel"
            data-guide="soundboard-lab"
          >
            <GreetingsPanel
              onEditModeChange={setIsEditingBg}
              onExitStudio={exitSoundboardStudio}
            />
          </div>
          {renderNotesPanel()}
        </main>
      )}

      {(isActive || isZombieCall || hipaaGraceActive) && (
        <main id="main-transcript" className={`main-content ${isNotesOpen ? "notes-open" : ""}`}>
          {isActive && <OnCallSoundboardStrip />}
          <div className="transcription-pane" data-guide="transcript">
            <TranscriptionBoard
              captions={captions}
              isActive={isActive}
              isBreakActive={isBreakActive}
              connectionState={connectionState}
              audioAttached={audioAttached}
              micTestMode={micTestMode}
              onClearAll={clearCaptions}
              onReconnect={handleRecovery}
              lastDataTime={lastDataTime}
              connectProgress={connectProgress}
            />
          </div>
          {renderNotesPanel()}
        </main>
      )}

      <UpdateAppBanner
        show={updateAvailable && shellReady && !blockSecondaryChrome && isAppGuideDone() && hasConfiguredDeepgramKey()}
        latestVersionToken={latestVersionToken}
        onDismiss={dismissUpdate}
        onUpdate={reloadToUpdate}
      />

      {quickNotesNotice && (
        <div className="quick-notes-status" role="status" aria-live="polite">
          {quickNotesNotice}
        </div>
      )}

      <div className="wellbeing-dock habit-dock">
        {showWellbeingWidgets && (
          <>
            <DeskExerciseWidget />
            <RosaryWidget />
            <MealTrackerWidget />
            <ChoreTrackerWidget />
          </>
        )}
        {/*
          Soundboard access is already provided by the top bar button
          (`AudioRouteStatusBar`), so we intentionally remove the bottom
          WorkspaceViewSwitcher pill to avoid duplicate CTAs.
        */}
        <button
          id="quick-notes-btn"
          data-guide="notes"
          data-tooltip="Quick Notes"
          aria-label="Quick Notes"
          onClick={toggleQuickNotes}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "20px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: isNotesOpen
              ? "rgba(244, 63, 94, 0.25)"
              : "rgba(7, 14, 35, 0.7)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            color: isNotesOpen ? "#f87171" : "rgba(255,255,255,0.6)",
            fontSize: "0.85rem",
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isNotesOpen
              ? "0 0 12px rgba(244, 63, 94, 0.3)"
              : "0 2px 8px rgba(0,0,0,0.3)",
            transition: "all 0.3s ease",
            padding: 0,
            flexShrink: 0,
          }}
        >
          📝
        </button>
      </div>
    </div>
    </GuideHostProvider>
    </ElementHintProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <AudioSettingsProvider>
        <SessionProvider>
          <Dashboard />
        </SessionProvider>
      </AudioSettingsProvider>
    </AuthProvider>
  );
}

export default App;
