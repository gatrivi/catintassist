import {
  applyReleaseHighlights,
  clearReleaseHighlights,
  RELEASE_HIGHLIGHT_CLASS,
} from './releaseHighlight';

describe('releaseHighlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="audio-route-cable-mode-btn">VB</button>';
  });

  test('applies and clears shine class', () => {
    applyReleaseHighlights(['audio-route-cable-mode-btn'], 50_000);
    const el = document.getElementById('audio-route-cable-mode-btn');
    expect(el.classList.contains(RELEASE_HIGHLIGHT_CLASS)).toBe(true);
    clearReleaseHighlights(['audio-route-cable-mode-btn']);
    expect(el.classList.contains(RELEASE_HIGHLIGHT_CLASS)).toBe(false);
  });

  test('cleanup function removes highlights', () => {
    const cleanup = applyReleaseHighlights(['audio-route-cable-mode-btn'], 50_000);
    cleanup();
    expect(
      document.getElementById('audio-route-cable-mode-btn').classList.contains(RELEASE_HIGHLIGHT_CLASS),
    ).toBe(false);
  });
});
