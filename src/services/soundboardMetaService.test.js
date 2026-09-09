import {
  DEFAULT_SOUNDBOARD_ITEMS,
  SOUNDBOARD_META_STORAGE_KEY,
  ensureHandbookSeed,
  getSoundboardItem,
  loadSoundboardMetaLocal,
  mergeSoundboardItems,
} from './soundboardMetaService';
import { ACTIONS } from '../components/GreetingsPanel';

describe('soundboardMetaService handbook seed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('every Studio action resolves to a non-empty script', () => {
    const items = loadSoundboardMetaLocal();
    ACTIONS.forEach((a) => {
      const item = getSoundboardItem(a.id, items);
      expect(item).toBeTruthy();
      expect(item.text.length).toBeGreaterThan(10);
    });
  });

  test('handbook items carry verbatim scripts', () => {
    const items = loadSoundboardMetaLocal();
    expect(getSoundboardItem('ghost', items).text).toMatch(/disengage.*\[name\]/);
    expect(getSoundboardItem('segments', items).text).toMatch(/shorter segments/);
    expect(getSoundboardItem('closing', items).text).toMatch(/anything else/);
    expect(getSoundboardItem('sign_off', items).text).toMatch(/ID ____/);
  });

  test('reseed overwrites stale stored texts once, keeps user labels, clears stale health', () => {
    localStorage.setItem(
      SOUNDBOARD_META_STORAGE_KEY,
      JSON.stringify({ items: [{ id: 'ghost', label: 'My Ghost', text: 'old text', hotkey: '', category: 'call-control', lang: 'en' }] }),
    );
    localStorage.setItem('catint_audio_health', JSON.stringify({ ghost: 0.95, intake: 0.9 }));
    expect(ensureHandbookSeed()).toBe(true);
    expect(ensureHandbookSeed()).toBe(false); // idempotent
    const items = loadSoundboardMetaLocal();
    const ghost = getSoundboardItem('ghost', items);
    expect(ghost.text).toMatch(/disengage/);
    expect(ghost.label).toBe('My Ghost');
    // New handbook items were added alongside.
    expect(getSoundboardItem('voicemail', items).text).toMatch(/333\.333\.3333/);
    // Stale health for reseeded keys is gone; untouched keys survive.
    const health = JSON.parse(localStorage.getItem('catint_audio_health'));
    expect(health.ghost).toBeUndefined();
    expect(health.intake).toBe(0.9);
  });

  test('merge still caps at defaults length', () => {
    const merged = mergeSoundboardItems([{ id: 'nope', text: 'x' }]);
    expect(merged.length).toBe(DEFAULT_SOUNDBOARD_ITEMS.length);
  });
});
