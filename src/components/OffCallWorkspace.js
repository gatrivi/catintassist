import React, { useState } from 'react';
import { NewcomerIdleGuide } from './NewcomerIdleGuide';
import { isNewcomerGuideDismissed } from '../utils/newcomerGuide';
import {
  isComponentVisible,
  useComponentVisibilityRefresh,
} from '../utils/componentVisibility';

/** Off-call main (~80%): interpret workspace below dashboard-header. */
export const OffCallWorkspace = ({
  audioAttached = false,
  micTestMode = false,
  connectionState = 'disconnected',
  notesPanel = null,
  notesOpen = false,
}) => {
  const [sessionHidden, setSessionHidden] = useState(false);
  useComponentVisibilityRefresh();
  const showOffCallGuide = isComponentVisible('off_call_guide', { isActive: false, isZombieCall: false });
  const showGuide = showOffCallGuide && !sessionHidden && !isNewcomerGuideDismissed();

  return (
    <main id="interpret-root" className={`main-content view-interpret interpret-workspace${notesOpen ? ' notes-open' : ''}`}>
      <div className="interpret-pane" data-guide="transcript">
        {showGuide ? (
          <NewcomerIdleGuide
            audioAttached={audioAttached}
            micTestMode={micTestMode}
            connectionState={connectionState}
            isActive={false}
            onHideSession={() => setSessionHidden(true)}
          />
        ) : (
          <div style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.75, fontSize: '0.78rem', lineHeight: 1.35 }}>
            {connectionState === 'error' ? (
              <>
                Deepgram isn't working right now (engine for interpretation).
                <div style={{ opacity: 0.95, marginTop: '0.5rem' }}>
                  Do this now: Zap → check API key/auth → allow Deepgram WebSocket + tab audio → try again.
                </div>
              </>
            ) : (
              <>
                Press the green button to connect the {micTestMode ? 'microphone' : 'browser tab'}.
                <div style={{ opacity: 0.95, marginTop: '0.5rem' }}>
                  Then press it again to start interpreting.
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {notesPanel}
    </main>
  );
};
