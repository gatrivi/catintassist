import {
  buildPinEntry,
  pinMatchesCaption,
  migratePinnedCaptions,
  isCaptionPinned,
  togglePinEntry,
} from './pinnedCaptions';

describe('pinnedCaptions', () => {
  test('buildPinEntry marks live bubbles', () => {
    const pin = buildPinEntry({ id: 'a', text: 'hello', isFinal: false, turnId: 't1' });
    expect(pin.pinLive).toBe(true);
    expect(pin.turnId).toBe('t1');
  });

  test('pinMatchesCaption: same id', () => {
    const pin = { id: 'x', text: 'hi' };
    expect(pinMatchesCaption(pin, { id: 'x', text: 'bye' })).toBe(true);
  });

  test('pinMatchesCaption: same turn + exact text after id migration', () => {
    const pin = { id: 'old-i', turnId: 'turn-1', text: 'Hello world.' };
    const cap = { id: 'old-f-s0-1', turnId: 'turn-1', text: 'Hello world.' };
    expect(pinMatchesCaption(pin, cap)).toBe(true);
  });

  test('pinMatchesCaption: live pin hides seal-split chunks', () => {
    const pin = {
      id: 'dg-es-1-i',
      turnId: 'turn-9',
      text: 'Frase uno. Frase dos. Okay',
      pinLive: true,
    };
    expect(pinMatchesCaption(pin, { id: 'dg-es-1-f-s0-1', turnId: 'turn-9', text: 'Frase uno.' })).toBe(true);
    expect(pinMatchesCaption(pin, { id: 'dg-es-1-f-s1-2', turnId: 'turn-9', text: 'Frase dos.' })).toBe(true);
    expect(pinMatchesCaption(pin, { id: 'dg-es-1-i', turnId: 'turn-9', text: 'Okay' })).toBe(true);
    expect(pinMatchesCaption(pin, { id: 'other', turnId: 'turn-10', text: 'Frase uno.' })).toBe(false);
  });

  test('migratePinnedCaptions updates id when text+turn match', () => {
    const pins = [{ id: 'live-i', turnId: 't1', text: 'Done.' }];
    const captions = [{ id: 'sealed-f', turnId: 't1', text: 'Done.' }];
    const next = migratePinnedCaptions(pins, captions);
    expect(next[0].id).toBe('sealed-f');
  });

  test('togglePinEntry adds then removes', () => {
    const cap = { id: 'a', text: 'one', turnId: 't1', isFinal: true, lang: 'en' };
    const pinned = togglePinEntry([], cap);
    expect(isCaptionPinned(pinned, cap)).toBe(true);
    const unpinned = togglePinEntry(pinned, cap);
    expect(unpinned).toHaveLength(0);
  });
});
