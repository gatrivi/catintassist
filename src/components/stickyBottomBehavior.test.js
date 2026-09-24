/**
 * v4.145.0 — sticky bottom BEHAVIOUR (not just wiring).
 *
 * Reported by the operator: "the sticky scroll that ensures new transcriptions
 * are always visible — if new transcriptions are not visible the interpreter
 * cannot work." jsdom has no layout, so this test hands `#transcript-pane` the
 * numbers a real overflow would produce and asserts what the board does with
 * them: it follows the newest line, and only a real gesture (wheel/drag) may
 * pause that.
 */
import React from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react';
import { TranscriptionBoard } from './TranscriptionBoard';

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => ({
    isActive: true,
    isZombieCall: false,
    lastCallSummary: null,
    setLastCallSummary: () => {},
    updateCaptions: () => {},
    lastCallArchive: null,
    clearLastCallArchive: () => {},
  }),
  safeSet: () => {},
}));
jest.mock('../hooks/useTTS', () => ({
  useTTS: () => ({ playTTS: () => {}, stopTTS: () => {}, isPlaying: false, playingUrl: null, prefetchTTS: () => {} }),
}));
jest.mock('../hooks/useTranslate', () => ({
  useTranslate: () => ({ translation: '', audioUrl: null, engineStatus: 'idle', translationMeta: {}, targetLang: 'es', isStale: false }),
}));
jest.mock('../contexts/AudioSettingsContext', () => ({
  useAudioSettings: () => ({ inputDevices: [], outputDevices: [], selectedMicId: '', selectedSinkId: '' }),
}));
jest.mock('../utils/componentVisibility', () => ({
  useComponentVisibilityRefresh: () => {},
  isComponentVisible: () => false,
  COMPONENT_IDS: { study_cue_cards: 'study_cue_cards' },
}));

const cap = (id, text) => ({ id, text, lang: 'en', isFinal: true, turnId: `t-${id}` });
const board = (captions) => <TranscriptionBoard captions={captions} />;

/**
 * jsdom has no layout: hand the pane the numbers a real 3-screen-long
 * transcript would have. Testing Library has no API for layout stubs, so the
 * pane is taken straight from the document by its id.
 */
function stubPane({ scrollHeight = 1000, clientHeight = 300, scrollTop = 700 } = {}) {
  // eslint-disable-next-line testing-library/no-node-access
  const pane = document.getElementById('transcript-pane');
  let top = scrollTop;
  Object.defineProperty(pane, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v) => { top = v; },
  });
  Object.defineProperty(pane, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(pane, 'clientHeight', { configurable: true, get: () => clientHeight });
  return { pane, top: () => top, jumpTo: (v) => { top = v; } };
}

/** Let the 120/400 ms settle passes run inside act. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 750)); });

describe('sticky bottom behaviour (v4.145.0)', () => {
  test('a new caption snaps the pane to the newest line', () => {
    const { rerender } = render(board([cap('a', 'one')]));
    const pane = stubPane();
    rerender(board([cap('a', 'one'), cap('b', 'two')]));
    expect(pane.top()).toBe(1000);
  });

  test('the browser moving the pane (scroll-anchoring) never pauses the follow', async () => {
    const { rerender } = render(board([cap('a', 'one')]));
    const pane = stubPane();
    rerender(board([cap('a', 'one'), cap('b', 'two')]));
    await settle(); // leave the "we scrolled it ourselves" grace window

    pane.jumpTo(300); // anchoring/late layout pushed the newest line out of view…
    fireEvent.scroll(pane.pane); // …with nobody touching the pane

    expect(pane.top()).toBe(1000); // single rule: newest line visible again
  });

  test('wheel up is respected — new lines wait, and the toggle counts them', () => {
    const { rerender } = render(board([cap('a', 'one')]));
    const pane = stubPane();
    pane.jumpTo(200);
    fireEvent.wheel(pane.pane, { deltaY: -120 });

    rerender(board([cap('a', 'one'), cap('b', 'two')]));

    expect(pane.top()).toBe(200); // not yanked away from what is being read
    expect(screen.getByRole('button', { name: /1 new/ })).toBeInTheDocument();
  });

  test('clicking "N new" jumps to the newest line instead of switching follow off', () => {
    const { rerender } = render(board([cap('a', 'one')]));
    const pane = stubPane();
    pane.jumpTo(200);
    fireEvent.wheel(pane.pane, { deltaY: -120 });
    rerender(board([cap('a', 'one'), cap('b', 'two')]));

    fireEvent.click(screen.getByRole('button', { name: /1 new/ }));

    expect(pane.top()).toBe(1000);
    expect(screen.getByRole('button', { name: /sticky/ })).toBeInTheDocument();
  });

  test('dragging back to the bottom resumes following', () => {
    const { rerender } = render(board([cap('a', 'one')]));
    const pane = stubPane();
    pane.jumpTo(200);
    fireEvent.wheel(pane.pane, { deltaY: -120 });
    rerender(board([cap('a', 'one'), cap('b', 'two')]));

    pane.jumpTo(700); // operator scrolled back down (scrollbar drag)…
    fireEvent.pointerDown(pane.pane);
    fireEvent.scroll(pane.pane);

    rerender(board([cap('a', 'one'), cap('b', 'two'), cap('c', 'three')]));
    expect(pane.top()).toBe(1000);
  });
});
