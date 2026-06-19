import React, { useEffect } from 'react';
import { NewcomerIdleGuide } from './NewcomerIdleGuide';
import { PANE_SCOREBOARD_TOP } from '../utils/workspaceLayout';

/** Off-call main: 80% interpret welcome, 20% scoreboard metrics (portaled in). */
export const OffCallWorkspace = ({
  paneOrder,
  audioAttached = false,
  micTestMode = false,
  connectionState = 'disconnected',
}) => {
  useEffect(() => {
    try {
      window.dispatchEvent(new Event('cat_scoreboard_metrics_ready'));
    } catch (_) {}
  }, []);

  const scoreboardTop = paneOrder === PANE_SCOREBOARD_TOP;

  return (
    <main
      id="scoreboard-root"
      className={`main-content view-scoreboard off-call-workspace${scoreboardTop ? ' pane-order-scoreboard-top' : ''}`}
    >
      <div className="off-call-interpret-pane" data-guide="transcript">
        <NewcomerIdleGuide
          audioAttached={audioAttached}
          micTestMode={micTestMode}
          connectionState={connectionState}
          isActive={false}
        />
      </div>
      <div id="scoreboard-metrics-root" className="off-call-scoreboard-pane" data-guide="scoreboard" />
    </main>
  );
};
