import React, { useState } from 'react';
import { NewcomerIdleGuide } from './NewcomerIdleGuide';
import { PANE_SCOREBOARD_TOP } from '../utils/workspaceLayout';
import { isNewcomerGuideDismissed } from '../utils/newcomerGuide';

/** Off-call main: 80% interpret welcome, 20% scoreboard metrics (portaled in). */
export const OffCallWorkspace = ({
  paneOrder,
  audioAttached = false,
  micTestMode = false,
  connectionState = 'disconnected',
}) => {
  const [sessionHidden, setSessionHidden] = useState(false);

  React.useEffect(() => {
    try {
      window.dispatchEvent(new Event('cat_scoreboard_metrics_ready'));
    } catch (_) {}
  }, []);

  const scoreboardTop = paneOrder === PANE_SCOREBOARD_TOP;
  const showGuide = !sessionHidden && !isNewcomerGuideDismissed();

  return (
    <main
      id="scoreboard-root"
      className={`main-content view-scoreboard off-call-workspace${scoreboardTop ? ' pane-order-scoreboard-top' : ''}`}
    >
      <div className="off-call-interpret-pane" data-guide="transcript">
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
      <div id="scoreboard-metrics-root" className="off-call-scoreboard-pane" data-guide="scoreboard" />
    </main>
  );
};
