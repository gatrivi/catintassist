/**
 * v4.144.0 — bubble overlap root cause, stylesheet contract.
 *
 * Symptom (screenshot): `.bubble-line > span` of bubble N painted over the
 * first line of bubble N+1. Root cause: the pane is a flex COLUMN SCROLLER
 * (`#transcript-pane` inline style: display:flex; flexDirection:column;
 * overflowY:auto) and `.transcript-bubble` had the default `flex-shrink: 1`,
 * so an overflowing pane squashed bubble boxes below their content height.
 *
 * Pinned here from `src/index.css` itself (same pattern as
 * RepeatDimText.test.js), so a future edit cannot silently re-enable the
 * squash: bubbles must never shrink below their content.
 */
import fs from 'fs';
import path from 'path';

// Strip /* ... */ first: comments legitimately mention `flex-shrink: 1` when
// documenting the bug and must not trip the contract.
const CSS = fs
  .readFileSync(path.join(__dirname, '..', 'index.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Declarations of the FIRST rule for a single-class selector. */
const ruleBody = (selector) => {
  const match = CSS.match(new RegExp(`(^|\\})\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm'));
  if (!match) throw new Error(`CSS rule not found: ${selector}`);
  return match[2];
};

describe('bubble overlap (v4.144.0) — flex scroller must not squash bubbles', () => {
  test('.transcript-bubble opts out of flex-shrink', () => {
    expect(ruleBody('.transcript-bubble')).toMatch(/flex-shrink:\s*0/);
  });

  test('no .transcript-bubble rule re-enables shrinking', () => {
    // Every rule whose selector list mentions .transcript-bubble must either
    // omit flex-shrink or set it to 0 (a `1` here reintroduces the overlap).
    const rules = CSS.match(/[^{}]*\.transcript-bubble[^{}]*\{[^}]*\}/g) || [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      const shrink = rule.match(/flex-shrink:\s*([0-9.]+)/);
      if (shrink) expect(shrink[1]).toBe('0');
    }
  });

  test('the pane is still the flex column scroller the fix assumes', () => {
    const board = fs.readFileSync(path.join(__dirname, 'TranscriptionBoard.js'), 'utf8');
    expect(board).toMatch(/flexDirection:\s*'column'/);
    expect(board).toMatch(/overflowY:\s*'auto'/);
  });
});
