import {
  SETTINGS_GROUPS,
  SETTINGS_PANELS,
  DEFAULT_PINS,
  isSettingsPanel,
  groupSettingsPanels,
  searchSettingsPanels,
  loadSettingsPins,
  saveSettingsPins,
  toggleSettingsPin,
  loadLastSettingsSection,
  saveLastSettingsSection,
} from './settingsRegistry';

// v4.161.0. The complaint was never "the settings are wrong" — it was "I cannot
// find the thing I want". These cases pin the two things that fix that: search
// that understands the words an operator would actually type, and a drawer that
// reopens where they left off.
describe('settingsRegistry (v4.161.0)', () => {
  afterEach(() => localStorage.clear());

  test('every panel belongs to a real group and ids are unique', () => {
    const groupIds = SETTINGS_GROUPS.map((g) => g.id);
    const ids = SETTINGS_PANELS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    SETTINGS_PANELS.forEach((p) => expect(groupIds).toContain(p.group));
    expect(isSettingsPanel('today')).toBe(true);
    expect(isSettingsPanel('nope')).toBe(false);
  });

  test('grouping keeps registry order and never returns an empty group', () => {
    const groups = groupSettingsPanels();
    expect(groups.map((g) => g.id)).toEqual(['today', 'speech', 'output', 'app']);
    groups.forEach((g) => expect(g.panels.length).toBeGreaterThan(0));
    // The two controls the operator reaches for daily lead the first group.
    expect(groups[0].panels.map((p) => p.id)).toEqual(['goals', 'today', 'data']);
  });

  test('a navigating panel is never treated as a drawer section', () => {
    // "goals" leaves the drawer for the goal wheel. If it counted as a section,
    // the remembered-section restore would reopen onto a blank panel.
    expect(isSettingsPanel('goals')).toBe(false);
    expect(isSettingsPanel('today')).toBe(true);
    const goals = SETTINGS_PANELS.find((p) => p.id === 'goals');
    expect(goals.action).toBe('goals-view');
    saveLastSettingsSection('goals');
    expect(loadLastSettingsSection()).toBeNull(); // nothing to remember
  });

  test('search finds panels by the words an operator would type', () => {
    const ids = (q) => searchSettingsPanels(q).map((p) => p.id);
    expect(ids('call log')[0]).toBe('today');
    expect(ids('minutes')[0]).toBe('today');
    expect(ids('undo')[0]).toBe('today');
    expect(ids('key')[0]).toBe('dg-key');
    expect(ids('theme')).toContain('display');
    expect(ids('colour')).toContain('display'); // es spelling
    expect(ids('language')).toContain('language');
    expect(ids('soundboard')).toContain('audio');
    expect(ids('corrections')).toContain('data');
    expect(ids('zzz')).toEqual([]);
    expect(searchSettingsPanels('')).toHaveLength(SETTINGS_PANELS.length);
  });

  test('the goal wheel is findable by every way an operator describes it', () => {
    ['goal', 'goals', 'target', 'how much do i need', 'money', 'pace', 'monthly target']
      .forEach((q) => expect(searchSettingsPanels(q).map((p) => p.id)).toContain('goals'));
  });

  test('search is AND across terms and ranks a label prefix first', () => {
    const ids = (q) => searchSettingsPanels(q).map((p) => p.id);
    expect(ids('call minutes')).toContain('today');
    expect(ids('call zzz')).toEqual([]); // both terms must match
    expect(ids('key')[0]).toBe('dg-key');
    expect(ids('dg-key')[0]).toBe('dg-key');
  });

  test('the daily tool is pinned out of the box, and pins survive a reload', () => {
    expect(loadSettingsPins()).toEqual(DEFAULT_PINS);
    expect(loadSettingsPins()).toContain('today');

    toggleSettingsPin('audio');
    expect(loadSettingsPins()).toEqual(expect.arrayContaining(['today', 'audio']));
    // simulate a page reload: state comes back from localStorage alone
    expect(loadSettingsPins()).toContain('audio');

    toggleSettingsPin('today');
    expect(loadSettingsPins()).not.toContain('today');
    expect(loadSettingsPins()).toContain('audio');
  });

  test('pins never keep a panel that no longer exists', () => {
    saveSettingsPins(['today', 'ghost-panel', 'audio', 'audio']);
    expect(loadSettingsPins()).toEqual(['today', 'audio']);
    expect(toggleSettingsPin('ghost-panel')).toEqual(['today', 'audio']);
  });

  test('corrupt storage falls back to defaults instead of breaking the drawer', () => {
    localStorage.setItem('catint_settings_pins_v1', '{not json');
    expect(loadSettingsPins()).toEqual(DEFAULT_PINS);
    localStorage.setItem('catint_settings_last_section_v1', ']]]');
    expect(loadLastSettingsSection()).toBeNull();
  });

  test('the last panel used is remembered, and junk is refused', () => {
    expect(loadLastSettingsSection()).toBeNull();
    saveLastSettingsSection('data');
    expect(loadLastSettingsSection()).toBe('data');
    saveLastSettingsSection('not-a-panel');
    expect(loadLastSettingsSection()).toBe('data'); // unchanged
  });
});
