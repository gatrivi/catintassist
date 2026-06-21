/** Scoreboard preset + visible-metric persistence (v4.60.0). */

export const SCOREBOARD_PRESET_KEY = 'catint_scoreboard_preset_v1';
export const VISIBLE_METRICS_KEY = 'catint_visible_metrics_v1';

/** Grid cell ids 1–12 (numeric flip-back view). */
export const METRIC_IDS = [
  'm1', 'm2', 'm3', 'm4', 'm5', 'm6',
  'm7', 'm8', 'm9', 'm10', 'm11', 'm12',
];

const ALL_METRICS = Object.fromEntries(METRIC_IDS.map((id) => [id, true]));
const NONE_EXTRA = Object.fromEntries(METRIC_IDS.map((id) => [id, false]));

/** Expanded income-card keys in SessionContext. */
export const CARD_KEYS = ['month', 'moneyMonth', 'today', 'moneyToday', 'call', 'break', 'avail', 'goal'];

export const PRESET_CONFIGS = {
  /** 900×600: bounty, mins today, break left, connect (game view). */
  minimal: {
    scoreView: 'game',
    visibleCards: {
      month: false,
      moneyMonth: false,
      today: true,
      moneyToday: false,
      call: false,
      break: true,
      avail: false,
      goal: false,
    },
    visibleMetrics: { ...NONE_EXTRA, m1: true, m2: true },
  },
  /** Condensed game view — default daily driver. */
  standard: {
    scoreView: 'game',
    visibleCards: {
      month: true,
      moneyMonth: false,
      today: true,
      moneyToday: false,
      call: true,
      break: true,
      avail: false,
      goal: true,
    },
    visibleMetrics: { ...ALL_METRICS },
  },
  /** Full 12-grid + expanded cards. */
  full: {
    scoreView: 'numbers',
    visibleCards: {
      month: true,
      moneyMonth: true,
      today: true,
      moneyToday: true,
      call: true,
      break: true,
      avail: true,
      goal: true,
    },
    visibleMetrics: { ...ALL_METRICS },
  },
};

export const PRESET_LABELS = {
  minimal: 'Minimal',
  standard: 'Standard',
  full: 'Full',
};

export function loadPreset() {
  try {
    const saved = localStorage.getItem(SCOREBOARD_PRESET_KEY);
    if (saved && PRESET_CONFIGS[saved]) return saved;
  } catch (_) {}
  return 'standard';
}

export function savePreset(presetId) {
  try {
    localStorage.setItem(SCOREBOARD_PRESET_KEY, presetId);
  } catch (_) {}
}

export function loadVisibleMetrics() {
  try {
    const saved = localStorage.getItem(VISIBLE_METRICS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...ALL_METRICS, ...parsed };
    }
  } catch (_) {}
  return { ...PRESET_CONFIGS.standard.visibleMetrics };
}

export function saveVisibleMetrics(metrics) {
  try {
    localStorage.setItem(VISIBLE_METRICS_KEY, JSON.stringify(metrics));
  } catch (_) {}
}

export function getPresetConfig(presetId) {
  return PRESET_CONFIGS[presetId] || PRESET_CONFIGS.standard;
}
