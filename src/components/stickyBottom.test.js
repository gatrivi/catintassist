/**
 * v4.145.0 — sticky bottom cannot silently die again.
 *
 * Operator report: "the sticky scroll that ensures new transcriptions are
 * always visible — if new transcriptions are not visible the interpreter
 * cannot work." Root cause was in `TranscriptionBoard.js`: follow was paused
 * by scroll *geometry* (`scrollHeight - scrollTop - clientHeight > 35`), so
 * every non-human scroll — the browser's scroll-anchoring when a live bubble
 * grows, or our own programmatic scroll — looked like "the operator scrolled
 * away" and the newest line stayed below the fold.
 *
 * These contracts are read from the stylesheet and the component source
 * (same pattern as `bubbleOverlap.test.js`) so a future edit cannot quietly
 * bring the old behaviour back.
 */
import fs from 'fs';
import path from 'path';

const CSS = fs
  .readFileSync(path.join(__dirname, '..', 'index.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const BOARD = fs.readFileSync(path.join(__dirname, 'TranscriptionBoard.js'), 'utf8');

/** Declarations of the first rule whose selector line starts with `selector`. */
const ruleBody = (selector) => {
  const match = CSS.match(new RegExp(`(^|\\})\\s*\\${selector}\\s*\\{([^}]*)\\}`, 'm'));
  if (!match) throw new Error(`CSS rule not found: ${selector}`);
  return match[2];
};

describe('sticky bottom (v4.145.0)', () => {
  test('scroll-anchoring is disabled on the transcript pane', () => {
    // Otherwise the browser moves the pane itself on every live-bubble growth.
    expect(ruleBody('#transcript-pane')).toMatch(/overflow-anchor:\s*none/);
  });

  test('a paused follow with unread lines has its own loud style', () => {
    expect(ruleBody('.sticky-bottom-toggle.has-new')).toMatch(/border-color|background/);
  });

  test('the pane is scrolled directly (pane-only, instant)', () => {
    expect(BOARD).toMatch(/pane\.scrollTop\s*=\s*pane\.scrollHeight/);
  });

  test('scroll events are classified — geometry alone may not pause the follow', () => {
    expect(BOARD).toMatch(/classifyScroll\(/);
    expect(BOARD).toMatch(/from '\.\.\/utils\/stickyScroll'/);
    // The old geometry-only flag must not come back.
    expect(BOARD).not.toMatch(/isScrolledUpRef/);
    expect(BOARD).not.toMatch(/resetScrollTimer/);
  });

  test('a wheel/drag is the only thing that pauses the follow', () => {
    expect(BOARD).toMatch(/markUserGesture/);
    expect(BOARD).toMatch(/userScrolledUpRef/);
  });
});
