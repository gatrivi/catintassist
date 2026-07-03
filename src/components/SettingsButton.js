import React from 'react';
import { SettingsIcon } from './HeaderIcons';
import { ElementHintTarget } from './ElementHint';

/** Gear button — opens Settings panel (same as top-right gear). */
export const SettingsButton = () => (
  <ElementHintTarget
    elementId="header-settings-btn"
    guideKey="settings"
    heading="Settings"
    body="Deepgram key, language pair, display options, component visibility."
    color="#94a3b8"
  >
  <button
    type="button"
    id="header-settings-btn"
    className="settings-scoreboard-btn"
    data-guide="settings"
    onClick={() => {
      try {
        window.dispatchEvent(new CustomEvent('cat_show_settings'));
      } catch (_) {}
    }}
    title="Settings — Deepgram key, Language pair, Display"
    aria-label="Open settings"
  >
    <SettingsIcon size={14} />
  </button>
  </ElementHintTarget>
);
