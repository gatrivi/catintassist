/** Per-component show/hide modes — persisted in localStorage. v4.61.0 */
import { useEffect, useState } from 'react';

export const STORAGE_KEY = 'catint_component_visibility_v1';

export const VISIBILITY_MODES = ['always', 'on_call', 'off_call', 'hidden'];

export const COMPONENT_IDS = {
  progress_bars: 'progress_bars',
  scoreboard_emoji_rows: 'scoreboard_emoji_rows',
  scoreboard_numeric_grid: 'scoreboard_numeric_grid',
  scoreboard_momentum_bar: 'scoreboard_momentum_bar',
  directional_cue_tips: 'directional_cue_tips',
  connect_button_scoreboard: 'connect_button_scoreboard',
  expanded_income_cards: 'expanded_income_cards',
  mic_meter_strip: 'mic_meter_strip',
  off_call_guide: 'off_call_guide',
  wellbeing_dock: 'wellbeing_dock',
};

/** Human labels for Settings → Display */
export const COMPONENT_LABELS = {
  [COMPONENT_IDS.progress_bars]: 'Progress bars (monthly + daily timelines)',
  [COMPONENT_IDS.scoreboard_emoji_rows]: 'Scoreboard emoji rows (💰 mins ☕)',
  [COMPONENT_IDS.scoreboard_numeric_grid]: 'Scoreboard 12-cell number grid',
  [COMPONENT_IDS.scoreboard_momentum_bar]: 'Momentum bar (game view)',
  [COMPONENT_IDS.directional_cue_tips]: 'Idle tips under scoreboard',
  [COMPONENT_IDS.connect_button_scoreboard]: 'Connect button in scoreboard (duplicate)',
  [COMPONENT_IDS.expanded_income_cards]: 'Expanded bounty / income cards',
  [COMPONENT_IDS.mic_meter_strip]: 'Mic level meter strip',
  [COMPONENT_IDS.off_call_guide]: 'Off-call welcome guide (interpret pane)',
  [COMPONENT_IDS.wellbeing_dock]: 'Wellbeing dock (bottom widgets)',
};

export const DEFAULT_COMPONENT_VISIBILITY = {
  [COMPONENT_IDS.progress_bars]: 'always',
  [COMPONENT_IDS.scoreboard_emoji_rows]: 'off_call',
  [COMPONENT_IDS.scoreboard_numeric_grid]: 'off_call',
  [COMPONENT_IDS.scoreboard_momentum_bar]: 'off_call',
  [COMPONENT_IDS.directional_cue_tips]: 'off_call',
  [COMPONENT_IDS.connect_button_scoreboard]: 'hidden',
  [COMPONENT_IDS.expanded_income_cards]: 'off_call',
  [COMPONENT_IDS.mic_meter_strip]: 'always',
  [COMPONENT_IDS.off_call_guide]: 'off_call',
  [COMPONENT_IDS.wellbeing_dock]: 'off_call',
};

const dispatchChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent('cat_component_visibility_changed'));
  } catch {
    /* ignore */
  }
};

export const loadComponentVisibility = () => {
  const merged = { ...DEFAULT_COMPONENT_VISIBILITY };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return merged;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      Object.keys(DEFAULT_COMPONENT_VISIBILITY).forEach((id) => {
        if (VISIBILITY_MODES.includes(parsed[id])) merged[id] = parsed[id];
      });
    }
  } catch {
    /* ignore */
  }
  return merged;
};

export const saveComponentVisibility = (config) => {
  const merged = { ...DEFAULT_COMPONENT_VISIBILITY };
  Object.keys(DEFAULT_COMPONENT_VISIBILITY).forEach((id) => {
    if (VISIBILITY_MODES.includes(config?.[id])) merged[id] = config[id];
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  dispatchChanged();
  return merged;
};

export const getComponentMode = (componentId) => {
  const cfg = loadComponentVisibility();
  return cfg[componentId] ?? DEFAULT_COMPONENT_VISIBILITY[componentId] ?? 'hidden';
};

/** @param {{ isActive?: boolean, isZombieCall?: boolean }} ctx */
export const resolveVisibility = (componentId, ctx = {}) => {
  const mode = getComponentMode(componentId);
  const onCall = !!(ctx.isActive || ctx.isZombieCall);
  switch (mode) {
    case 'always':
      return true;
    case 'hidden':
      return false;
    case 'on_call':
      return onCall;
    case 'off_call':
      return !onCall;
    default:
      return false;
  }
};

export const isComponentVisible = (componentId, ctx) => resolveVisibility(componentId, ctx);

/** Connect duplicate: hidden by default when connect lives in sticky header. */
export const shouldShowScoreboardConnect = (connectInHeader, ctx) => {
  const mode = getComponentMode(COMPONENT_IDS.connect_button_scoreboard);
  if (mode === 'always') return resolveVisibility(COMPONENT_IDS.connect_button_scoreboard, ctx);
  if (connectInHeader) return false;
  return resolveVisibility(COMPONENT_IDS.connect_button_scoreboard, ctx);
};

/** Progress stack — visibility + preset gate (scoreboard lives in header off-call). */
export const shouldShowProgressStack = (scoreboardPreset, ctx) => {
  if (!resolveVisibility(COMPONENT_IDS.progress_bars, ctx)) return false;
  if (scoreboardPreset === 'full') return true;
  return getComponentMode(COMPONENT_IDS.progress_bars) === 'always';
};

export const useComponentVisibilityRefresh = () => {
  const [, tick] = useState(0);
  useEffect(() => {
    const onChange = () => tick((n) => n + 1);
    window.addEventListener('cat_component_visibility_changed', onChange);
    return () => window.removeEventListener('cat_component_visibility_changed', onChange);
  }, []);
};
