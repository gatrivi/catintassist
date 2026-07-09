import { getReleaseNoteForVersion, getCopyForLang, RELEASE_NOTES_CATALOG } from '../content/releaseNotes';
import { APP_VERSION } from '../constants/version';

describe('releaseNotes content', () => {
  test('catalog has entry for current APP_VERSION', () => {
    expect(getReleaseNoteForVersion(APP_VERSION)).toBeTruthy();
  });

  test('each catalog entry has bilingual copy and highlights', () => {
    RELEASE_NOTES_CATALOG.forEach((entry) => {
      expect(entry.version).toBeTruthy();
      expect(entry.id).toBeTruthy();
      expect(entry.highlightElementIds?.length).toBeGreaterThan(0);
      expect(entry.es?.title).toBeTruthy();
      expect(entry.en?.title).toBeTruthy();
      expect(entry.es.sections.length).toBeGreaterThan(0);
      expect(entry.en.sections.length).toBeGreaterThan(0);
    });
  });

  test('getCopyForLang returns es by default', () => {
    const note = RELEASE_NOTES_CATALOG[0];
    const es = getCopyForLang(note, 'es');
    const en = getCopyForLang(note, 'en');
    expect(es.title).not.toBe(en.title);
  });
});
