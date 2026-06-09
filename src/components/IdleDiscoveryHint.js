import React from 'react';
import { useSession } from '../contexts/SessionContext';

export const IdleDiscoveryHint = ({ isActive, isBreakActive }) => {
  const { hideScoreboardLabels } = useSession();

  if (isActive || isBreakActive) return null;

  return (
    <div className="idle-discovery-hint" role="status">
      {hideScoreboardLabels
        ? 'Hold or hover any control for details · Re-enable labels in ⚙️ settings'
        : 'Hold or hover controls for extra detail'}
    </div>
  );
};
