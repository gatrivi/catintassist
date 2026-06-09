import React, { useState, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useClickOutside } from '../hooks/useClickOutside';

export const SettingsMenu = () => {
  const { hideScoreboardLabels, setHideScoreboardLabels } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div className="settings-menu-wrap" ref={ref}>
      <button
        type="button"
        className="btn-icon tiny-btn settings-menu-btn"
        onClick={() => setOpen((o) => !o)}
        title="Settings"
        aria-label="Settings"
        aria-expanded={open}
      >
        ⚙️
      </button>
      {open && (
        <div className="settings-menu-panel glass-panel">
          <div className="settings-menu-title">Settings</div>
          <label className="settings-menu-row">
            <input
              type="checkbox"
              checked={!hideScoreboardLabels}
              onChange={(e) => setHideScoreboardLabels(!e.target.checked)}
            />
            <span>Show text labels on scoreboard</span>
          </label>
          <p className="settings-menu-note">When off, hold or hover controls for tooltips.</p>
        </div>
      )}
    </div>
  );
};
