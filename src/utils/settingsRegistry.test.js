import {
  SETTINGS_GROUPS,
  SETTINGS_PANELS,
  DEFAULT_PINS,
  isSettingsPanel,
  getSettingsPanel,
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
    // v4.167.0: a Studio group leads, holding the three off-call workspace
    // views, so Goals stays the first thing in the list while the Soundboard
    // and Greeting Editor join it.
    expect(groups.map((g) => g.id)).toEqual(['studio', 'today', 'speech', 'output', 'app']);
    groups.forEach((g) => expect(g.panels.length).toBeGreaterThan(0));
    expect(groups[0].panels.map((p) => p.id)).toEqual(['goals', 'soundboard', 'greetings']);
    expect(groups[1].panels.map((p) => p.id)).toEqual(['today', 'data']);
  });

  // v4.167.0: all three studios are reached by leaving the drawer, so all three
  // must be excluded from section handling — otherwise the remembered-section
  // restore would reopen onto a blank panel.
  test.each(['goals', 'soundboard', 'greetings'])(
    'the %s studio is a navigating panel, not a drawer section',
    (id) => {
      expect(isSettingsPanel(id)).toBe(false);
      expect(getSettingsPanel(id).action).toBeTruthy();
      saveLastSettingsSection(id);
      expect(loadLastSettingsSection()).toBeNull(); // nothing to remember
    },
  );

  test('the studios are findable by every word an operator uses for them', () => {
    const has = (q, id) => expect(searchSettingsPanels(q).map((p) => p.id)).toContain(id);
    ['soundboard', 'greeting', 'record greetings', 'health check', 'caller path']
      .forEach((q) => has(q, 'soundboard'));
    ['greeting editor', 'greetings', 'script', 'waveform', 'trim']
      .forEach((q) => has(q, 'greetings'));
    ['goal', 'target', 'how much do i need', 'money', 'pace', 'monthly target']
      .forEach((q) => has(q, 'goals'));
  });

  // The Studio group took 'soundboard' out of the Audio keywords, so search has
  // to keep finding the right panel for each everyday word.
  test('search finds panels by the words an operator would type', () => {
    const ids = (q) => searchSettingsPanels(q).map((p) => p.id);
    expect(ids('call log')[0]).toBe('today');
    expect(ids('minutes')[0]).toBe('today');
    expect(ids('undo')[0]).toBe('today');
    expect(ids('key')[0]).toBe('dg-key');
    expect(ids('theme')).toContain('display');
    expect(ids('colour')).toContain('display'); // es spelling
    expect(ids('language')).toContain('language');
    expect(ids('soundboard')).toContain('soundboard');
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
