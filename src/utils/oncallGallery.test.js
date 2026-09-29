/**
 * v4.171.0 — the on-call gallery pick list. Pure localStorage logic: what you
 * picked survives a reload, junk never reaches the tiles, the row stays 8 wide.
 */
import {
  GALLERY_PICKS_KEY,
  MAX_GALLERY,
  DEFAULT_GALLERY_IDS,
  normalizeGalleryPicks,
  readGalleryPicks,
  writeGalleryPicks,
  toggleGalleryPick,
} from './oncallGallery';

const KNOWN = [
  'greeting_en', 'greeting_es', 'hold_exc_en', 'hold_exc_es', 'sign_off', 'closer_louder',
  'intake', 'hold_policy', 'voicemail', 'operator_12241',
];
const isKnown = (id) => KNOWN.includes(id);

beforeEach(() => localStorage.clear());

describe('normalizeGalleryPicks', () => {
  test('drops junk, unknown ids and duplicates while keeping your order', () => {
    expect(
      normalizeGalleryPicks(['hold_policy', 42, null, 'nope', 'hold_policy', 'sign_off'], isKnown)
    ).toEqual(['hold_policy', 'sign_off']);
  });

  test('never exceeds the ceiling — a long list truncates, not grows', () => {
    const many = Array.from({ length: 20 }, (_, i) => `k${i}`);
    expect(normalizeGalleryPicks(many)).toHaveLength(MAX_GALLERY);
  });

  test('an empty list is a legitimate answer, not a fall-back trigger', () => {
    expect(normalizeGalleryPicks([])).toEqual([]);
    expect(normalizeGalleryPicks(undefined)).toEqual([]);
  });
});

describe('readGalleryPicks', () => {
  test('first run hands you the old hardcoded seven', () => {
    expect(readGalleryPicks(isKnown)).toEqual(DEFAULT_GALLERY_IDS);
  });

  test('a saved pick survives a reload', () => {
    writeGalleryPicks(['hold_policy', 'voicemail']);
    expect(readGalleryPicks(isKnown)).toEqual(['hold_policy', 'voicemail']);
  });

  test('a stored id that no longer exists is dropped, not rendered blank', () => {
    localStorage.setItem(GALLERY_PICKS_KEY, JSON.stringify(['hold_policy', 'retired_greeting']));
    expect(readGalleryPicks(isKnown)).toEqual(['hold_policy']);
  });

  test('corrupt storage falls back to the defaults instead of throwing', () => {
    localStorage.setItem(GALLERY_PICKS_KEY, '{not json');
    expect(readGalleryPicks(isKnown)).toEqual(DEFAULT_GALLERY_IDS);
  });

  test('a deliberately emptied row stays empty', () => {
    writeGalleryPicks([]);
    expect(readGalleryPicks(isKnown)).toEqual([]);
  });
});

describe('writeGalleryPicks', () => {
  test('normalizes on the way in, so storage can never hold junk', () => {
    expect(writeGalleryPicks(['hold_policy', 'hold_policy', 'x', null], isKnown)).toEqual(['hold_policy']);
    expect(JSON.parse(localStorage.getItem(GALLERY_PICKS_KEY))).toEqual(['hold_policy']);
  });
});

describe('toggleGalleryPick', () => {
  test('adds when there is room, drops when already on the row', () => {
    expect(toggleGalleryPick(['sign_off'], 'hold_policy', isKnown)).toEqual({
      picks: ['sign_off', 'hold_policy'],
      added: true,
      full: false,
    });
    expect(toggleGalleryPick(['sign_off', 'hold_policy'], 'sign_off', isKnown)).toEqual({
      picks: ['hold_policy'],
      added: false,
      full: false,
    });
  });

  test('an unknown id is never added, even if the caller asks', () => {
    expect(toggleGalleryPick(['sign_off'], 'made_up', isKnown)).toEqual({
      picks: ['sign_off'],
      added: false,
      full: false,
    });
  });

  test('reports full instead of silently ignoring the ninth tap', () => {
    const full = Array.from({ length: MAX_GALLERY }, (_, i) => `k${i}`);
    const result = toggleGalleryPick(full, 'one_more');
    expect(result.full).toBe(true);
    expect(result.added).toBe(false);
    expect(result.picks).toEqual(full);
  });
});
