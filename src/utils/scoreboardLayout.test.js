import {
  PRESET_CONFIGS,
  loadPreset,
  loadVisibleMetrics,
  getPresetConfig,
  METRIC_IDS,
} from './scoreboardLayout';

describe('scoreboardLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to standard preset', () => {
    expect(loadPreset()).toBe('standard');
  });

  it('minimal preset favors game view and key metrics', () => {
    const cfg = PRESET_CONFIGS.minimal;
    expect(cfg.scoreView).toBe('game');
    expect(cfg.visibleCards.today).toBe(true);
    expect(cfg.visibleCards.break).toBe(true);
    expect(cfg.visibleMetrics.m1).toBe(true);
  });

  it('full preset shows all 12 metrics', () => {
    const cfg = PRESET_CONFIGS.full;
    expect(cfg.scoreView).toBe('numbers');
    METRIC_IDS.forEach((id) => expect(cfg.visibleMetrics[id]).toBe(true));
  });

  it('loadVisibleMetrics falls back to standard', () => {
    const m = loadVisibleMetrics();
    expect(m.m1).toBe(true);
    expect(getPresetConfig('unknown').scoreView).toBe('game');
  });
});
