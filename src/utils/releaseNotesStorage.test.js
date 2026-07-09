import {
  SEEN_VERSION_KEY,
  DISMISS_FOREVER_ID_KEY,
  SNOOZE_UNTIL_KEY,
  shouldShowReleaseNotes,
  markReleaseNotesSeen,
  snoozeReleaseNotes,
  dismissReleaseNotesForever,
  readReleaseNotesLangPref,
  writeReleaseNotesLangPref,
  RELEASE_NOTES_SNOOZE_MS,
} from './releaseNotesStorage';

const note = { version: '4.84.20', id: 'vb-cable-route-ux-v1' };

describe('releaseNotesStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('shows when version unseen', () => {
    expect(shouldShowReleaseNotes(note)).toBe(true);
  });

  test('hides after mark seen', () => {
    markReleaseNotesSeen(note.version);
    expect(shouldShowReleaseNotes(note)).toBe(false);
  });

  test('hides while snoozed', () => {
    const now = 1_000_000;
    snoozeReleaseNotes(localStorage, RELEASE_NOTES_SNOOZE_MS);
    const until = Number(localStorage.getItem(SNOOZE_UNTIL_KEY));
    expect(shouldShowReleaseNotes(note, { now: until - 1000 })).toBe(false);
    expect(shouldShowReleaseNotes(note, { now: until + 1 })).toBe(true);
  });

  test('dismiss forever hides regardless of version bump within same note id', () => {
    dismissReleaseNotesForever(note.id);
    expect(shouldShowReleaseNotes(note)).toBe(false);
    expect(localStorage.getItem(DISMISS_FOREVER_ID_KEY)).toBe(note.id);
  });

  test('new version shows again after seen old version', () => {
    markReleaseNotesSeen('4.84.19');
    expect(shouldShowReleaseNotes(note)).toBe(true);
    expect(localStorage.getItem(SEEN_VERSION_KEY)).toBe('4.84.19');
  });

  test('lang pref defaults to es', () => {
    expect(readReleaseNotesLangPref()).toBe('es');
    writeReleaseNotesLangPref('en');
    expect(readReleaseNotesLangPref()).toBe('en');
    writeReleaseNotesLangPref('bogus');
    expect(readReleaseNotesLangPref()).toBe('es');
  });
});
