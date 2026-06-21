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
}) => {
  const [sessionHidden, setSessionHidden] = useState(false);
  useComponentVisibilityRefresh();
  const showOffCallGuide = isComponentVisible('off_call_guide', { isActive: false, isZombieCall: false });
  const showGuide = showOffCallGuide && !sessionHidden && !isNewcomerGuideDismissed();

  return (
    <main id="interpret-root" className="main-content view-interpret interpret-workspace">
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
          <div style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.45, fontSize: '0.75rem' }}>
            Ready — connect tab to begin.
          </div>
        )}
      </div>
    </main>
  );
};
