import React from 'react';
import { render, screen } from '@testing-library/react';
import { TranslatedBubble } from './TranscriptionBoard';

// v4.169.0. A warning that does not render is worth nothing, so these cases
// render the real bubble and assert the flags actually appear in the rail.
//
// Both are REPORT-ONLY, like the negation guard: they never rewrite text. The
// detectors themselves are unit-tested in translationSurplus.test.js and
// socketHealth.test.js; what is untestable there is whether the operator ever
// SEES them, which is what this file is for.

let mockTranslate = {
  translation: '',
  audioUrl: null,
  engineStatus: 'ready',
  translationMeta: { engineId: 'test', quality: 'ok', failures: [], tried: [] },
  targetLang: 'es',
  isStale: false,
};

jest.mock('../hooks/useTranslate', () => ({
  useTranslate: () => {
    // Provenance marker: if this never fires, the mock is not reaching the
    // component and every assertion below is passing for the wrong reason.
    global.__TRANSLATE_HOOK_CALLED = (global.__TRANSLATE_HOOK_CALLED || 0) + 1;
    return mockTranslate;
  },
}));
jest.mock('../contexts/SessionContext', () => ({
  useSession: () => ({ translationMood: 'auto' }),
  safeSet: () => {},
}));
jest.mock('../hooks/useTTS', () => ({ useTTS: () => ({ playTTS: jest.fn(), stopTTS: jest.fn(), playingUrl: null }) }));

// The real overrun from a CSA call: 8 words of English carrying 24 words of
// Spanish, two clauses of which nobody said.
const SHORT_EN = 'I went to face my husband and my';
const OVERLONG_ES = 'Yo fui a enfrentar a mi esposo y a mi familia, y les dije que no estaba bien lo que estábamos haciendo. Tanto como';

const renderBubble = (props = {}, { translation = '' } = {}) => {
  mockTranslate = {
    translation,
    audioUrl: null,
    engineStatus: 'ready',
    translationMeta: { engineId: 'test', quality: 'ok', failures: [], tried: [] },
    targetLang: 'es',
    isStale: false,
  };
  return render(
    <TranslatedBubble
      id="cap-1"
      turnId="turn-1"
      text={SHORT_EN}
      lang="en"
      showTurnWordCount={false}
      onEditSource={jest.fn()}
      {...props}
    />,
  );
};

describe('TranslatedBubble — translation-surplus warning (v4.169.0)', () => {
  test('the mocked translate hook is actually the one in use', () => {
    // Guard against the silent-mock trap: a test that passes because the hook
    // was never stubbed proves nothing about the warning.
    global.__TRANSLATE_HOOK_CALLED = 0;
    renderBubble();
    expect(global.__TRANSLATE_HOOK_CALLED).toBeGreaterThan(0);
  });

  test('flags the real overrun', () => {
    const { container } = renderBubble({}, { translation: OVERLONG_ES });
    const flag = container.querySelector('.bubble-rail-surplus');
    expect(flag).not.toBeNull();
    expect(flag.getAttribute('title')).toMatch(/may not match this line/i);
  });

  test('a faithful translation of a COMPLETE source shows no flag', () => {
    const { container } = renderBubble(
      { text: 'I went to face my husband and my family and told them it was wrong.' },
      { translation: 'Fui a enfrentar a mi esposo y a mi familia y les dije que estaba mal.' },
    );
    expect(container.querySelector('.bubble-rail-surplus')).toBeNull();
  });

  // Documented trade-off, and the reason the detector fires on real overruns: a
  // TRUNCATED source with a completed translation is a genuine surplus — the
  // Spanish really does contain words the English does not show. That is the
  // same shape as the incident, so flagging it is the point, not a false alarm.
  test('a truncated source + a completed translation IS flagged (by design)', () => {
    const { container } = renderBubble(
      {},
      { translation: 'Fui a enfrentar a mi esposo y a mi familia y les dije que estaba mal.' },
    );
    const flag = container.querySelector('.bubble-rail-surplus');
    expect(flag).not.toBeNull();
    expect(flag.getAttribute('title')).toMatch(/extra clauses/);
  });

  test('no translation, no flag — nothing to distrust yet', () => {
    const { container } = renderBubble({}, { translation: '' });
    expect(container.querySelector('.bubble-rail-surplus')).toBeNull();
  });

  test('the flag lives on the shared word-count line, costing no height', () => {
    // The 80% rule is a guideline, but this one is free: it reuses .bubble-rail-meta,
    // the same line the negation flag uses, so no new row is introduced.
    const { container } = renderBubble(
      { showTurnWordCount: true, turnWordCount: 8 },
      { translation: OVERLONG_ES },
    );
    const meta = container.querySelector('.bubble-rail-meta');
    expect(meta).not.toBeNull();
    expect(meta.querySelector('.bubble-rail-surplus')).not.toBeNull();
    expect(meta.querySelector('.bubble-rail-wc')).not.toBeNull();
  });

  test('it reports; it never rewrites. The Spanish is untouched.', () => {
    const { container } = renderBubble({}, { translation: OVERLONG_ES });
    expect(container.textContent).toContain('fui a enfrentar');
    // No invented "corrected" Spanish, no truncation of the long one.
    expect(container.textContent).toMatch(/haciendo/);
  });
});
