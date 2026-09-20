/**
 * v4.140.0 — supersede presentation model for live STT text.
 *
 * Reads as the operator's symptom: Deepgram rewrites wording for the same
 * speech, and the words he was mid-read disappear. These tests pin the DOM
 * contract: superseded wording stays readable (dimmed) for a bounded hold,
 * then exits with a fade; the line is never blank; numbers never blank.
 *
 * Literal ms values are used on purpose (1500 hold / 320 retire = the shipped
 * defaults) so this file pins the documented behaviour, not a constant that
 * could be re-pointed silently. `textSupersede.test.js` asserts the constants.
 */
import React from 'react';
import { render, act } from '@testing-library/react';

jest.mock('../utils/motionPreference', () => ({
  prefersReducedMotion: jest.fn(() => false),
}));

import { StableTextMorph } from './StableTextMorph';
import { prefersReducedMotion } from '../utils/motionPreference';

const HOLD_MS = 1500;
const RETIRE_MS = 320;

const Morph = (props) => <StableTextMorph {...props} />;

const wrap = (container) => container.querySelector('.stable-text-morph');
const supersededCount = (container) => container.querySelectorAll('.stm-superseded').length;

beforeEach(() => {
  prefersReducedMotion.mockReturnValue(false);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('StableTextMorph supersede model (v4.140.0)', () => {
  test('rewrite keeps the superseded wording readable past the old 480ms cue', () => {
    const { container, rerender } = render(<Morph text="the patient has a fever" />);

    rerender(<Morph text="the patient has a headache" />);

    const line = wrap(container);
    // Both versions on screen at once — the old wording is dimmed, not deleted.
    expect(line.textContent).toContain('fever');
    expect(line.textContent).toContain('headache');
    expect(supersededCount(container)).toBe(1);

    // 1500ms hold, not 480ms: the phrase you were mid-read is still there.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(supersededCount(container)).toBe(1);
    expect(wrap(container).textContent).toContain('fever');

    // Hold expires -> bounded exit fade (derender is eased, not a pop).
    act(() => {
      jest.advanceTimersByTime(HOLD_MS - 1000);
    });
    expect(wrap(container).getAttribute('data-phase')).toBe('retiring');
    expect(supersededCount(container)).toBe(1);

    act(() => {
      jest.advanceTimersByTime(RETIRE_MS + 20);
    });
    expect(supersededCount(container)).toBe(0);
    expect(wrap(container).getAttribute('data-phase')).toBe('idle');
    // The replacing wording is what remains, readable.
    expect(wrap(container).textContent).toContain('headache');
    expect(wrap(container).textContent).not.toContain('fever');
  });

  test('the line is never blank at any point of the supersede lifecycle', () => {
    const { container, rerender } = render(<Morph text="he has pain in his chest" />);
    const neverBlank = () => expect(wrap(container).textContent.trim().length).toBeGreaterThan(0);

    neverBlank();
    rerender(<Morph text="he has pain in his back" />);
    neverBlank();
    act(() => {
      jest.advanceTimersByTime(HOLD_MS);
    });
    neverBlank();
    act(() => {
      jest.advanceTimersByTime(RETIRE_MS + 20);
    });
    neverBlank();
  });

  test('higher-confidence rewrite under scores supersedes', () => {
    const { container, rerender } = render(
      <Morph
        text="she takes losartan"
        wordConfidence={[
          { word: 'she', confidence: 0.9 },
          { word: 'takes', confidence: 0.9 },
          { word: 'losartan', confidence: 0.35 },
        ]}
      />,
    );

    rerender(
      <Morph
        text="she takes lovastatin"
        wordConfidence={[
          { word: 'she', confidence: 0.95 },
          { word: 'takes', confidence: 0.95 },
          { word: 'lovastatin', confidence: 0.97 },
        ]}
      />,
    );

    expect(supersededCount(container)).toBe(1);
    expect(wrap(container).textContent).toContain('losartan');
    expect(wrap(container).textContent).toContain('lovastatin');
  });

  test('equal or lower-confidence rewrite is a quiet adopt: no dim, no frame, no lingering', () => {
    const { container, rerender } = render(
      <Morph
        text="the patient denies smoking"
        wordConfidence={[
          { word: 'the', confidence: 0.9 },
          { word: 'patient', confidence: 0.9 },
          { word: 'denies', confidence: 0.92 },
          { word: 'smoking', confidence: 0.9 },
        ]}
      />,
    );

    rerender(
      <Morph
        text="the patient denies chills"
        wordConfidence={[
          { word: 'the', confidence: 0.9 },
          { word: 'patient', confidence: 0.9 },
          { word: 'denies', confidence: 0.9 },
          { word: 'chills', confidence: 0.55 },
        ]}
      />,
    );

    const line = wrap(container);
    // New wording is adopted in place; the old wording does NOT linger.
    expect(line.textContent).toContain('chills');
    expect(line.textContent).not.toContain('smoking');
    expect(supersededCount(container)).toBe(0);
    expect(line.textContent.trim().length).toBeGreaterThan(0);
  });

  test('pure continuation/extension does not supersede', () => {
    const { container, rerender } = render(<Morph text="the pain started" />);

    rerender(<Morph text="the pain started yesterday" />);

    const line = wrap(container);
    expect(line.textContent).toContain('the pain started');
    expect(line.textContent).toContain('yesterday');
    expect(supersededCount(container)).toBe(0);
  });

  test('rapid revisions do not accumulate duplicates', () => {
    const { container, rerender } = render(<Morph text="he has a fever" />);

    rerender(<Morph text="he has a fever and a cough" />);
    rerender(<Morph text="he has a fever and a cough today" />);

    const line = wrap(container);
    const text = line.textContent;
    // One supersede episode, one frozen base -> no duplicate old wording.
    expect(supersededCount(container)).toBeLessThanOrEqual(1);
    expect(text.split('fever').length - 1).toBeLessThanOrEqual(1);
    expect(text).toContain('cough');
  });

  test('superseded phone digits never blank', () => {
    const { container, rerender } = render(<Morph text="call me at 555-123-4567" />);

    rerender(<Morph text="call me at 555-123-4568" />);

    const line = wrap(container);
    expect(line.textContent).toContain('555-123-4567');
    expect(line.textContent).toContain('555-123-4568');

    act(() => {
      jest.advanceTimersByTime(HOLD_MS);
    });
    expect(wrap(container).getAttribute('data-phase')).toBe('retiring');
    // Even mid-exit the old number is still on screen and marked protected.
    expect(container.querySelector('.stm-superseded--protected')).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(RETIRE_MS + 20);
    });
    expect(wrap(container).textContent).toContain('555-123-4568');
  });

  test('superseded wording is not copy-chipped (no stale number handed back)', () => {
    const { container, rerender } = render(<Morph text="call me at 555-123-4567" />);
    rerender(<Morph text="call me at 555-123-4568" />);

    const superseded = container.querySelector('.stm-superseded');
    expect(superseded).not.toBeNull();
    // Readable, but no click-to-copy affordance on wording that is no longer true.
    expect(superseded.querySelector('.highlight-number')).toBeNull();
    // The replacing (true) wording keeps its copy chip.
    const arriving = container.querySelector('.stm-arriving');
    expect(arriving.querySelector('.highlight-number')).not.toBeNull();
  });

  test('continuity key change resets the episode (no stale dimmed wording)', () => {
    const { container, rerender } = render(
      <Morph text="blood pressure is high" continuityKey="cont:1:g0" />,
    );

    rerender(<Morph text="blood pressure is low" continuityKey="cont:2:g0" />);

    const line = wrap(container);
    expect(line.textContent).toContain('low');
    expect(line.textContent).not.toContain('high');
    expect(supersededCount(container)).toBe(0);
  });
});

describe('StableTextMorph reduced motion (v4.140.0)', () => {
  test('reduced motion shortens the hold and drops non-protected superseded words fast', () => {
    prefersReducedMotion.mockReturnValue(true);
    const { container, rerender } = render(<Morph text="the dose is one pill" />);

    rerender(<Morph text="the dose is two pills" />);

    act(() => {
      jest.advanceTimersByTime(200);
    });
    // Non-protected old wording is gone quickly, replacement still readable.
    expect(wrap(container).textContent.trim().length).toBeGreaterThan(0);
    expect(supersededCount(container)).toBe(0);
  });

  test('reduced motion still never blanks protected digits', () => {
    prefersReducedMotion.mockReturnValue(true);
    const { container, rerender } = render(<Morph text="the dose is 500 mg" />);

    rerender(<Morph text="the dose is 250 mg" />);

    const line = wrap(container);
    expect(line.textContent).toContain('250');
    // v4.116.0 rule survives: numbers held on screen, never a blank frame.
    expect(line.textContent.trim().length).toBeGreaterThan(0);
  });
});
