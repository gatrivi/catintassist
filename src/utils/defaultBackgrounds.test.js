import {
  DEFAULT_BG_FILES,
  DEFAULT_BG_INDEX_KEY,
  getNextDefaultBackgroundUrl,
  peekDefaultBackgroundUrl,
  publicBgUrl,
  readDefaultBgIndex,
} from './defaultBackgrounds';

describe('defaultBackgrounds', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('publicBgUrl encodes spaces', () => {
    expect(publicBgUrl('Screenshot 2026-01-22 142428.png')).toBe(
      '/bg/Screenshot%202026-01-22%20142428.png',
    );
  });

  test('rotation advances through list', () => {
    expect(readDefaultBgIndex()).toBe(0);
    const first = getNextDefaultBackgroundUrl();
    expect(first).toBe(publicBgUrl(DEFAULT_BG_FILES[0]));
    expect(readDefaultBgIndex()).toBe(1);
    const second = getNextDefaultBackgroundUrl();
    expect(second).toBe(publicBgUrl(DEFAULT_BG_FILES[1]));
  });

  test('peek does not advance', () => {
    writeIndex(3);
    const url = peekDefaultBackgroundUrl();
    expect(url).toBe(publicBgUrl(DEFAULT_BG_FILES[3 % DEFAULT_BG_FILES.length]));
    expect(readDefaultBgIndex()).toBe(3);
  });

  test('wraps at end of list', () => {
    localStorage.setItem(DEFAULT_BG_INDEX_KEY, String(DEFAULT_BG_FILES.length - 1));
    const url = getNextDefaultBackgroundUrl();
    expect(url).toBe(publicBgUrl(DEFAULT_BG_FILES[DEFAULT_BG_FILES.length - 1]));
    expect(readDefaultBgIndex()).toBe(DEFAULT_BG_FILES.length);
    expect(getNextDefaultBackgroundUrl()).toBe(publicBgUrl(DEFAULT_BG_FILES[0]));
  });
});

function writeIndex(n) {
  localStorage.setItem(DEFAULT_BG_INDEX_KEY, String(n));
}
