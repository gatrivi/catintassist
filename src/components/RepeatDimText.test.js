/**
 * v4.142.0 — repeat-dim readability net, DOM contract.
 *
 * Three things are pinned here, in this order of importance:
 *  1. NOTHING IS LOST. The rendered textContent is byte-identical to the text the
 *     pane showed before the net existed — this is a display-only style, not an
 *     edit. Digits/doses/phones included.
 *  2. ONLY THE LATER COPY is dimmed, and it carries the `.repeat-dim` class.
 *  3. THE FLOOR IS 70%. The opacity is read from `src/index.css` itself (not from
 *     a constant), so a future edit cannot silently dim readable text below it:
 *     the same floor now also covers the v4.140.0 superseded wording.
 *
 * The reported symptom (screenshot) is reproduced literally: one bubble holding
 * the same ~22-word sentence twice.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react';

import { InteractiveText } from './TranscriptionBoard';
import { RepeatDimText } from './RepeatDimText';
import { StableTextMorph } from './StableTextMorph';
import { REPEAT_DIM_MIN_OPACITY } from '../utils/repeatedWordRuns';

/** The sentence from the reported screenshot. */
const SENTENCE =
  'You said you did a unemployment claim, but they wanted to follow-up with you. Or you want to speak with Social Security';
const DOUBLED = `${SENTENCE}. ${SENTENCE}.`;

const CSS_PATH = path.join(__dirname, '..', 'index.css');
const CSS = fs.readFileSync(CSS_PATH, 'utf8');

/** Declarations of the first rule with `selector` (single-class rules only). */
const ruleBody = (selector) => {
  const match = CSS.match(new RegExp(`(^|\\})\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm'));
  if (!match) throw new Error(`CSS rule not found: ${selector}`);
  return match[2];
};
const opacityOf = (selector) => {
  const body = ruleBody(selector);
  const decl = body.match(/opacity\s*:\s*([0-9.]+)/);
  if (!decl) throw new Error(`No opacity declaration in ${selector}`);
  return Number(decl[1]);
};

describe('repeat-dim floor is read from the stylesheet (v4.142.0)', () => {
  test('.repeat-dim never dims readable text below 70%', () => {
    const opacity = opacityOf('.repeat-dim');
    expect(opacity).toBeGreaterThanOrEqual(REPEAT_DIM_MIN_OPACITY);
    expect(opacity).toBeGreaterThanOrEqual(0.7);
    expect(opacity).toBeLessThan(1); // still a cue, not a no-op
  });

  test('.repeat-dim changes opacity only — no strike-through, no blur, no color override', () => {
    const body = ruleBody('.repeat-dim');
    expect(body).not.toMatch(/line-through/);
    expect(body).not.toMatch(/blur/);
    expect(body).not.toMatch(/(^|[\s;])color\s*:/);
    expect(body).not.toMatch(/font-(size|weight)\s*:/);
    expect(body).not.toMatch(/display\s*:\s*none/);
    expect(body).not.toMatch(/visibility\s*:\s*hidden/);
  });

  test('superseded wording (v4.140.0 path) is also held at/above the same floor', () => {
    const superseded = opacityOf('.stm-superseded');
    expect(superseded).toBeGreaterThanOrEqual(0.7);
    // Parsed the right rule: it is the animated, strike-through-free one.
    expect(ruleBody('.stm-superseded')).toMatch(/animation\s*:\s*stm-old-word/);
    expect(ruleBody('.stm-superseded')).not.toMatch(/line-through/);
    expect(opacityOf('.stm-superseded--protected')).toBeGreaterThanOrEqual(0.7);
    // The settle animation must not dip below the floor either (fill: both).
    const settle = CSS.match(/@keyframes stm-old-word\s*\{([^}]*\{[^}]*\}[^}]*\{[^}]*\})/);
    expect(settle).toBeTruthy();
    expect(Number(settle[1].match(/to\s*\{\s*opacity\s*:\s*([0-9.]+)/)[1])).toBeGreaterThanOrEqual(0.7);
    settle[1].match(/opacity\s*:\s*([0-9.]+)/g).forEach((decl) => {
      expect(Number(decl.split(':')[1])).toBeGreaterThanOrEqual(0.7);
    });
  });
});

describe('RepeatDimText — display-only contract (v4.142.0)', () => {
  const plain = (chunk) => <span>{chunk}</span>;

  test('textContent is byte-identical to the input, repeat included', () => {
    const { container } = render(<RepeatDimText text={DOUBLED} renderChunk={plain} />);
    expect(container.textContent).toBe(DOUBLED);
    expect(container.textContent.match(/unemployment claim/g)).toHaveLength(2);
  });

  test('exactly the later copy is wrapped, the first copy is not', () => {
    const { container } = render(<RepeatDimText text={DOUBLED} renderChunk={plain} />);
    const dims = container.querySelectorAll('.repeat-dim');
    expect(dims).toHaveLength(1);
    expect(dims[0].textContent.trim()).toBe(`${SENTENCE}.`);
    // The first copy is outside every dimmed span.
    expect(container.textContent.startsWith(`${SENTENCE}. `)).toBe(true);
    expect(container.querySelector('.repeat-dim').contains(document.createTextNode(SENTENCE))).toBe(false);
  });

  test('a phrase that appears once is left completely alone', () => {
    const { container } = render(<RepeatDimText text={`${SENTENCE}.`} renderChunk={plain} />);
    expect(container.textContent).toBe(`${SENTENCE}.`);
    expect(container.querySelectorAll('.repeat-dim')).toHaveLength(0);
  });

  test('protected values stay present and dimmed only in the repeat copy', () => {
    const text = 'take 5 mg daily take 5 mg daily';
    const { container } = render(<RepeatDimText text={text} renderChunk={plain} />);
    expect(container.textContent).toBe(text);
    expect(container.textContent.match(/5 mg/g)).toHaveLength(2);
    expect(container.querySelectorAll('.repeat-dim')).toHaveLength(1);
    expect(container.querySelector('.repeat-dim').textContent).toBe('take 5 mg daily');
  });

  test('no repeat → not a single extra wrapper', () => {
    const { container } = render(<RepeatDimText text="hello there" renderChunk={plain} />);
    expect(container.textContent).toBe('hello there');
    expect(container.querySelectorAll('.repeat-dim')).toHaveLength(0);
  });

  test('empty text renders nothing', () => {
    const { container } = render(<RepeatDimText text="" renderChunk={plain} />);
    expect(container.textContent).toBe('');
  });
});

describe('StableTextMorph (live line) — repeats dimmed, text unchanged (v4.142.0)', () => {
  test('the live line keeps every word and dims only the later repeat', () => {
    const { container } = render(<StableTextMorph text={DOUBLED} />);
    const wrap = container.querySelector('.stable-text-morph');
    // applyDisplayProtections may reformat (never drop) characters: compare the
    // word sequence, which is the readability contract.
    expect(wrap.textContent.replace(/\s+/g, ' ').trim()).toBe(DOUBLED.replace(/\s+/g, ' ').trim());
    const dims = wrap.querySelectorAll('.repeat-dim');
    expect(dims).toHaveLength(1);
    expect(dims[0].textContent.replace(/\s+/g, ' ').trim()).toBe(`${SENTENCE}.`);
  });
});

describe('InteractiveText (sealed bubble + translation line) (v4.142.0)', () => {
  test('sealed source bubble: textContent unchanged, later copy dimmed', () => {
    const { container } = render(<InteractiveText text={DOUBLED} scramble={false} />);
    expect(container.textContent.replace(/\s+/g, ' ').trim()).toBe(DOUBLED.replace(/\s+/g, ' ').trim());
    const dims = container.querySelectorAll('.repeat-dim');
    expect(dims).toHaveLength(1);
    expect(dims[0].textContent.replace(/\s+/g, ' ').trim()).toBe(`${SENTENCE}.`);
    expect(dims[0].getAttribute('data-repeat-dim')).toBe('1');
  });

  test('numbers/doses survive the chunk split (nothing pruned while chunking)', () => {
    const text = 'call 555-123-4567 to confirm call 555-123-4567 to confirm';
    const { container } = render(<InteractiveText text={text} scramble={false} />);
    expect(container.textContent.replace(/\s+/g, ' ').trim()).toBe(text);
    expect(container.textContent.match(/555-123-4567/g)).toHaveLength(2);
    expect(container.querySelectorAll('.repeat-dim')).toHaveLength(1);
  });

  test('translation line: same net applies', () => {
    const text = 'dijo que quiere hablar con seguridad social dijo que quiere hablar con seguridad social';
    const { container } = render(<InteractiveText text={text} scramble={false} lang="es" />);
    expect(container.textContent.replace(/\s+/g, ' ').trim()).toBe(text);
    expect(container.querySelectorAll('.repeat-dim')).toHaveLength(1);
  });

  test('word-confidence alignment survives the chunk split (wordOffset)', () => {
    const words = ['call', 'the', 'office', 'about', 'the', 'referral', 'call', 'the', 'office', 'about', 'the', 'referral'];
    const text = words.join(' ');
    const wordConfidence = words.map((word) => ({ word, confidence: 0.9 }));
    const { container } = render(
      <InteractiveText text={text} scramble={false} wordConfidence={wordConfidence} />,
    );
    expect(container.textContent.replace(/\s+/g, ' ').trim()).toBe(text);
    expect(container.querySelectorAll('.repeat-dim')).toHaveLength(1);
    // Every word still rendered exactly once, in order.
    const rendered = container.textContent.trim().split(/\s+/);
    expect(rendered).toEqual(words);
  });
});
