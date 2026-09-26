/**
 * Settings panel registry (v4.161.0).
 *
 * The drawer used to hardcode its tab list and derive every label from a
 * nested ternary that fell through to `else 'Display'`. You could not search
 * for a setting, could not reorder, and the tab you wanted was somewhere in a
 * wrapped strip of ten.
 *
 * This file is the single source of truth: the order of the tabs, their
 * labels, the words search looks for, and which group each one sits in. The
 * panel id IS the old `section` id, so every existing section body keeps
 * working untouched.
 */

export const SETTINGS_GROUPS = [
  { id: 'today', label: 'Today' },
  { id: 'speech', label: 'Speech' },
  { id: 'output', label: 'Output' },
  { id: 'app', label: 'App' },
];

/** Order here is the order shown, within each group. */
export const SETTINGS_PANELS = [
  {
    id: 'goals',
    group: 'today',
    label: 'Goals',
    hint: 'Set how much you need per day / week / month',
    keywords: 'goal goals target how much do i need per day week month pace weekly monthly money daily commitment bank ladder pro hours worked',
    // Navigates out of the drawer to the goal wheel instead of rendering a body.
    action: 'goals-view',
    notSection: true,
  },
  {
    id: 'today',
    group: 'today',
    // NOT "Today": the group heading is already "Today", and a pinned panel is
    // listed once — two identical labels on one screen is how you get lost.
    label: 'Call log',
    hint: 'Correct the day from the company call log',
    keywords: 'call log calls minutes paste company correct today day scoreboard undo overcounted stop',
  },
  {
    id: 'data',
    group: 'today',
    label: 'Backup',
    hint: 'App backup + taught corrections (JSON)',
    keywords: 'backup export import json restore taught corrections glossary stt words',
  },
  {
    id: 'deepgram',
    group: 'speech',
    label: 'Deepgram',
    hint: 'STT model, latency, clinical guards, keyterms',
    keywords: 'stt transcription deepgram model nova latency speed term repair negation guard keyterm bias medical',
  },
  {
    id: 'dg-key',
    group: 'speech',
    label: 'API key',
    hint: 'Paste / unlock the Deepgram key',
    keywords: 'key api secret vault paste unlock decrypt',
  },
  {
    id: 'language',
    group: 'speech',
    label: 'Language',
    hint: 'Which pair you interpret',
    keywords: 'language pair english spanish en es lane left right protection',
  },
  {
    id: 'translation',
    group: 'output',
    label: 'Translation',
    hint: 'Engines, keys, mood, status',
    keywords: 'translation engine mood keys status glossary target',
  },
  {
    id: 'audio',
    group: 'output',
    label: 'Audio',
    hint: 'Mic, speakers, tab share, devices',
    keywords: 'audio mic speaker sink tab share device input output route soundboard greeting volume',
  },
  {
    id: 'behavior',
    group: 'app',
    label: 'Behavior',
    hint: 'Autopilot, auto-connect, notes',
    keywords: 'behavior autopilot auto connect speech hold notes break mood',
  },
  {
    id: 'display',
    group: 'app',
    label: 'Display',
    hint: 'Theme, colours, what is visible',
    keywords: 'display theme palette colour color background visibility hide show ui inspector reset',
  },
  {
    id: 'layout',
    group: 'app',
    label: 'Layout',
    hint: 'How the off-call screen is arranged',
    keywords: 'layout off call dashboard header interpret pane arrangement',
  },
  {
    id: 'account',
    group: 'app',
    label: 'Account',
    hint: 'Sign in (the app never needs it)',
    keywords: 'account sign in login user auth email firebase',
  },
];

const PANEL_IDS = SETTINGS_PANELS.map((p) => p.id);

/**
 * Panels that render a body inside the drawer. A panel with an `action` (the
 * goal wheel) navigates away instead, so it must never be treated as a section
 * or it would leave the drawer blank.
 */
export const SECTION_PANELS = SETTINGS_PANELS.filter((p) => !p.notSection);

export const isSettingsPanel = (id) => SECTION_PANELS.some((p) => p.id === id);

export const getSettingsPanel = (id) => PANEL_IDS.includes(id)
  ? SETTINGS_PANELS.find((p) => p.id === id)
  : null;

/** Panels in registry order, bucketed by group (groups with no panel drop out). */
export const groupSettingsPanels = (panels = SETTINGS_PANELS) =>
  SETTINGS_GROUPS
    .map((g) => ({ ...g, panels: panels.filter((p) => p.group === g.id) }))
    .filter((g) => g.panels.length > 0);

const norm = (s) => String(s || '').toLowerCase().trim();

/**
 * Search across label + hint + keywords. Every whitespace-separated term must
 * match somewhere, so "call minutes" finds the call-log panel and "theme
 * colour" finds Display. Rank: label prefix > label > hint > keyword.
 */
export const searchSettingsPanels = (query, panels = SETTINGS_PANELS) => {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return panels;
  const scored = panels
    .map((p) => {
      const label = norm(p.label);
      // The id is searchable too: "dg-key" is what the deep link uses, and an
      // operator reading a bug report will type exactly that.
      const hay = `${label} ${norm(p.hint)} ${norm(p.keywords)} ${norm(p.id)}`;
      if (!terms.every((t) => hay.includes(t))) return null;
      const joined = terms.join(' ');
      let score = 0;
      if (label.startsWith(joined)) score += 100;
      else if (label.includes(joined)) score += 60;
      if (terms.every((t) => label.includes(t))) score += 40;
      if (norm(p.hint).includes(joined)) score += 15;
      return { p, score };
    })
    .filter(Boolean);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.p);
};

const PINS_KEY = 'catint_settings_pins_v1';
const LAST_SECTION_KEY = 'catint_settings_last_section_v1';

/** The control that gets used every day is pinned out of the box. */
export const DEFAULT_PINS = ['today'];

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const val = JSON.parse(raw);
    return val ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private mode: preferences simply do not persist */ }
};

export const loadSettingsPins = () => {
  const stored = readJson(PINS_KEY, null);
  const list = Array.isArray(stored) ? stored : DEFAULT_PINS;
  // Drop ids that no longer exist so a rename cannot leave a dead button.
  return list.filter((id) => PANEL_IDS.includes(id));
};

export const saveSettingsPins = (pins) => {
  const clean = [...new Set((Array.isArray(pins) ? pins : []).filter((id) => PANEL_IDS.includes(id)))];
  writeJson(PINS_KEY, clean);
  return clean;
};

export const toggleSettingsPin = (id) => {
  if (!PANEL_IDS.includes(id)) return loadSettingsPins();
  const pins = loadSettingsPins();
  return saveSettingsPins(pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id]);
};

/** Re-opening the gear with no explicit target returns you where you left off. */
export const loadLastSettingsSection = () => {
  const stored = readJson(LAST_SECTION_KEY, null);
  return isSettingsPanel(stored) ? stored : null;
};

export const saveLastSettingsSection = (id) => {
  if (isSettingsPanel(id)) writeJson(LAST_SECTION_KEY, id);
};
