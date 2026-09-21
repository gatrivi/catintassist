import React, { useEffect, useMemo, useState } from 'react';
import { NewcomerIdleGuide } from './NewcomerIdleGuide';
import { isNewcomerGuideDismissed } from '../utils/newcomerGuide';
import {
  isComponentVisible,
  useComponentVisibilityRefresh,
} from '../utils/componentVisibility';
import { ConnectionDiagnosticsBar } from './ConnectionDiagnosticsBar';
import {
  buildOffCallIdleDetail,
  checklistForMode,
  pickRotatingAdvice,
} from '../utils/offCallIdleMessages';
import { needsUserSuppliedDeepgramKey, rememberDeepgramKey, isValidDeepgramApiKey } from '../utils/deepgramRuntimeKey';
import { StudyCueCards } from './StudyCueCards';
import { MicVerifyPanel } from './MicVerifyPanel';
import { COMPONENT_IDS } from '../utils/componentVisibility';

/** Off-call main (~80%): guidance + future transcript workspace below dashboard-header. */
export const OffCallWorkspace = ({
  audioAttached = false,
  micTestMode = false,
  audioSourceMode = 'tab',
  connectionState = 'disconnected',
  connectionMessage = '',
  connectProgress = {},
  tabStreamReady = false,
  cableStreamReady = false,
  isZombieCall = false,
  isBreakActive = false,
  settingsOpen = false,
  vaultStatus = 'idle',
  notesPanel = null,
  notesOpen = false,
}) => {
  const [sessionHidden, setSessionHidden] = useState(false);
  const [tipTick, setTipTick] = useState(0);
  const [pastedKey, setPastedKey] = useState('');
  const [keySavedTick, setKeySavedTick] = useState(0);
  useComponentVisibilityRefresh();
  const showOffCallGuide = isComponentVisible('off_call_guide', { isActive: false, isZombieCall: false });
  const showGuide = showOffCallGuide && !sessionHidden && !isNewcomerGuideDismissed();

  useEffect(() => {
    const iv = setInterval(() => setTipTick((n) => n + 1), 12000);
    return () => clearInterval(iv);
  }, []);

  const apiKeyMissing = needsUserSuppliedDeepgramKey();
  const vaultNeedsDecrypt = useMemo(() => {
    try {
      return (
        apiKeyMissing &&
        !!localStorage.getItem('dg_cipher') &&
        !!localStorage.getItem('dg_salt') &&
        !!localStorage.getItem('dg_iv')
      );
    } catch {
      return false;
    }
  }, [apiKeyMissing]);
  const apiKeyMissingNoVault = apiKeyMissing && !vaultNeedsDecrypt;

  const detail = buildOffCallIdleDetail({
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
    cableStreamReady,
    micTestMode,
    audioSourceMode,
  });

  const idleMode = detail.mode || 'tab';
  const rotatingTip = pickRotatingAdvice(Date.now() + tipTick * 12000, idleMode);
  const checklist = checklistForMode(idleMode);

  return (
    <main id="interpret-root" className={`main-content view-interpret interpret-workspace${notesOpen ? ' notes-open' : ''}`}>
      <div className="interpret-pane" data-guide="transcript">
        {showGuide ? (
          <NewcomerIdleGuide
            audioAttached={audioAttached}
            micTestMode={micTestMode}
            audioSourceMode={audioSourceMode}
            connectionState={connectionState}
            isActive={false}
            onHideSession={() => setSessionHidden(true)}
          />
        ) : (
          <div className="interpret-pane-idle" role="status">
            {detail.lines.map((line) => (
              <p key={line} className="interpret-pane-idle-line">{line}</p>
            ))}
            {/* v4.88.0: cue cards supersede the rotating tip in healthy idle */}
            {detail.showRotatingTip && isComponentVisible(COMPONENT_IDS.study_cue_cards) ? (
              <StudyCueCards variant="idle" />
            ) : (
              detail.showRotatingTip && (
                <p className="interpret-pane-tip">{rotatingTip}</p>
              )
            )}
            {detail.showChecklist && (
              <ul className="interpret-pane-checklist">
                {checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {/* v4.97.0 mic verify · v4.139.0 hideable via Settings → Display */}
            {isComponentVisible(COMPONENT_IDS.mic_verify_panel, { isActive: false, isZombieCall: false }) && (
              <MicVerifyPanel />
            )}
            {detail.showDiagnostics && (
              <div className="interpret-pane-diagnostics">
                <ConnectionDiagnosticsBar
                  connectProgress={connectProgress}
                  connectionState={connectionState}
                  connectionMessage={connectionMessage}
                />
              </div>
            )}
            {/* v4.145.1 hotfix: paste Deepgram API key when none is configured */}
            {apiKeyMissingNoVault && (
              <form
                className="interpret-pane-key-paste"
                onSubmit={(e) => {
                  e.preventDefault();
                  const k = pastedKey.trim();
                  if (!isValidDeepgramApiKey(k)) return;
                  rememberDeepgramKey(k);
                  setPastedKey('');
                  setKeySavedTick((n) => n + 1);
                }}
                style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}
              >
                <input
                  type="password"
                  value={pastedKey}
                  onChange={(e) => setPastedKey(e.target.value)}
                  placeholder="Paste Deepgram API key…"
                  autoComplete="off"
                  style={{ flex: 1, minWidth: 0, padding: '4px 8px', fontSize: 13 }}
                />
                <button type="submit" className="interpret-pane-tip-link" disabled={!isValidDeepgramApiKey(pastedKey.trim())}>
                  🔑 Save key
                </button>
                {keySavedTick > 0 && <span style={{ fontSize: 12 }}>✅ saved — reconnect</span>}
              </form>
            )}
            {/* v4.139.0: QA guidelines — reopens the guided tour on demand */}
            <button
              type="button"
              id="off-call-guidelines-btn"
              className="interpret-pane-tip-link"
              onClick={() => window.dispatchEvent(new CustomEvent('cat_open_app_guide'))}
              title="Open QA / setup guidelines (guided tour)"
            >
              📖 Guidelines
            </button>
          </div>
        )}
      </div>
      {notesPanel}
    </main>
  );
};
