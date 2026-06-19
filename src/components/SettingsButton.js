import React from 'react';

/** Gear button — opens Settings panel (same as top-right gear). */
export const SettingsButton = () => (
  <button
    type="button"
    className="settings-scoreboard-btn"
    onClick={() => {
      try {
        window.dispatchEvent(new CustomEvent('cat_show_settings'));
      } catch (_) {}
    }}
    title="Settings"
    aria-label="Open settings"
  >
    ⚙
  </button>
);
