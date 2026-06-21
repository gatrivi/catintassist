import {
  STORAGE_KEY,
  VISIBILITY_MODES,
  DEFAULT_COMPONENT_VISIBILITY,
  loadComponentVisibility,
  saveComponentVisibility,
  resolveVisibility,
  shouldShowProgressStack,
  shouldShowScoreboardConnect,
} from './componentVisibility';

describe('componentVisibility', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('exports four visibility modes', () => {
    expect(VISIBILITY_MODES).toEqual(['always', 'on_call', 'off_call', 'hidden']);
  });

  it('loads defaults when storage empty', () => {
    expect(loadComponentVisibility()).toEqual(DEFAULT_COMPONENT_VISIBILITY);
  });

  it('resolveVisibility respects each mode', () => {
    const off = { isActive: false, isZombieCall: false };
    const on = { isActive: true, isZombieCall: false };
    const zombie = { isActive: false, isZombieCall: true };

    saveComponentVisibility({ ...DEFAULT_COMPONENT_VISIBILITY, progress_bars: 'always' });
    expect(resolveVisibility('progress_bars', off)).toBe(true);
    expect(resolveVisibility('progress_bars', on)).toBe(true);

    saveComponentVisibility({ ...DEFAULT_COMPONENT_VISIBILITY, progress_bars: 'hidden' });
    expect(resolveVisibility('progress_bars', off)).toBe(false);

    saveComponentVisibility({ ...DEFAULT_COMPONENT_VISIBILITY, progress_bars: 'on_call' });
    expect(resolveVisibility('progress_bars', off)).toBe(false);
    expect(resolveVisibility('progress_bars', on)).toBe(true);
    expect(resolveVisibility('progress_bars', zombie)).toBe(true);

    saveComponentVisibility({ ...DEFAULT_COMPONENT_VISIBILITY, progress_bars: 'off_call' });
    expect(resolveVisibility('progress_bars', off)).toBe(true);
    expect(resolveVisibility('progress_bars', on)).toBe(false);
  });

  it('shouldShowProgressStack honors always mode and full preset', () => {
    const off = { isActive: false, isZombieCall: false };
    saveComponentVisibility({ ...DEFAULT_COMPONENT_VISIBILITY, progress_bars: 'always' });
    expect(shouldShowProgressStack('minimal', off)).toBe(true);

    saveComponentVisibility({ ...DEFAULT_COMPONENT_VISIBILITY, progress_bars: 'off_call' });
    expect(shouldShowProgressStack('minimal', off)).toBe(false);
    expect(shouldShowProgressStack('full', off)).toBe(true);
  });

  it('shouldShowScoreboardConnect hides duplicate when connectInHeader', () => {
    const off = { isActive: false, isZombieCall: false };
    expect(shouldShowScoreboardConnect(true, off)).toBe(false);
    expect(shouldShowScoreboardConnect(false, off)).toBe(false);

    saveComponentVisibility({
      ...DEFAULT_COMPONENT_VISIBILITY,
      connect_button_scoreboard: 'always',
    });
    expect(shouldShowScoreboardConnect(true, off)).toBe(true);
  });
});
