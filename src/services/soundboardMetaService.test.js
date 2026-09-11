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

  test('retired open_client dupe drops out; relabel keeps custom labels', () => {
    localStorage.setItem(
      SOUNDBOARD_META_STORAGE_KEY,
      JSON.stringify({ items: [
        { id: 'open_client', label: 'Client Open', text: 'old opener', hotkey: '', category: 'greeting', lang: 'en' },
        { id: 'greeting_en', label: 'Greeting', text: 'stale', hotkey: '', category: 'greeting', lang: 'en' },
        { id: 'ghost', label: 'My Ghost', text: 'old text', hotkey: '', category: 'call-control', lang: 'en' },
      ] }),
    );
    expect(ensureHandbookSeed()).toBe(true);
    const items = loadSoundboardMetaLocal();
    expect(getSoundboardItem('open_client', items)).toBeNull();
    // Untouched tile relabeled to dedup name…
    expect(getSoundboardItem('greeting_en', items).label).toBe('Opener – Client');
    // …but a user-renamed tile keeps its name.
    expect(getSoundboardItem('ghost', items).label).toBe('My Ghost');
    // Merge also refuses the retired id (e.g. from cloud).
    const merged = mergeSoundboardItems([{ id: 'open_client', label: 'Client Open', text: 'x' }]);
    expect(merged.find((i) => i.id === 'open_client')).toBeUndefined();
  });

  test('merge still caps at defaults length', () => {
    const merged = mergeSoundboardItems([{ id: 'nope', text: 'x' }]);
    expect(merged.length).toBe(DEFAULT_SOUNDBOARD_ITEMS.length);
  });
});
