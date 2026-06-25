import {
  CLOUD_SYNC_KEYS,
  collectLocalSettings,
  applySettingsToLocal,
  hasLocalSettingsToImport,
  shouldOfferImport,
  markImportDoneForUser,
  isImportDoneForUser,
} from './settingsService';
import {
  DEFAULT_SOUNDBOARD_ITEMS,
  mergeSoundboardItems,
  loadSoundboardMetaLocal,
  saveSoundboardMetaLocal,
  getSoundboardItem,
} from './soundboardMetaService';

describe('settingsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('collects only whitelisted keys', () => {
    localStorage.setItem('catint_lang_pair_v1', '{"left":"en","right":"es"}');
    localStorage.setItem('catintassist_notes', 'secret notes');
    localStorage.setItem('dg_cipher', 'secret');

    const local = collectLocalSettings();
    expect(local['catint_lang_pair_v1']).toBe('{"left":"en","right":"es"}');
    expect(local['catintassist_notes']).toBeUndefined();
    expect(local['dg_cipher']).toBeUndefined();
    expect(Object.keys(local).every((k) => CLOUD_SYNC_KEYS.includes(k))).toBe(true);
  });

  it('applies cloud map back to localStorage', () => {
    applySettingsToLocal({ catint_trans_mood: 'fast' });
    expect(localStorage.getItem('catint_trans_mood')).toBe('fast');
  });

  it('offers import when local prefs exist and cloud is empty', () => {
    localStorage.setItem('catint_trans_mood', 'chill');
    expect(hasLocalSettingsToImport()).toBe(true);
    expect(shouldOfferImport('user123', null)).toBe(true);
    expect(isImportDoneForUser('user123')).toBe(false);
  });

  it('skips import prompt after user dismisses/import completes', () => {
    localStorage.setItem('catint_trans_mood', 'chill');
    markImportDoneForUser('user123');
    expect(shouldOfferImport('user123', null)).toBe(false);
  });
});

describe('soundboardMetaService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('merges defaults with remote overrides', () => {
    const merged = mergeSoundboardItems([
      { id: 'intake', label: 'Intake', text: 'Custom intake line', hotkey: '1', category: 'call-control', lang: 'en' },
    ]);
    expect(merged.find((i) => i.id === 'intake')?.text).toBe('Custom intake line');
    expect(merged.length).toBe(DEFAULT_SOUNDBOARD_ITEMS.length);
  });

  it('persists metadata locally', () => {
    const items = mergeSoundboardItems([{ id: 'sign_off', label: 'Bye', text: 'Goodbye now', hotkey: '9', category: 'call-control', lang: 'en' }]);
    saveSoundboardMetaLocal(items);
    const loaded = loadSoundboardMetaLocal();
    expect(getSoundboardItem('sign_off', loaded)?.text).toBe('Goodbye now');
  });
});
