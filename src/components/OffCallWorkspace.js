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
import { needsUserSuppliedDeepgramKey } from '../utils/deepgramRuntimeKey';

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
            {detail.showRotatingTip && (
              <p className="interpret-pane-tip">{rotatingTip}</p>
            )}
            {detail.showChecklist && (
              <ul className="interpret-pane-checklist">
                {checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
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
          </div>
        )}
      </div>
      {notesPanel}
    </main>
  );
};
