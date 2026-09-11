import { resolveHudName, buildUniqueSelector, readInspectorEnabled, HudInspectorHost } from './HudInspector';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

const fakeEl = (attrs = {}, extra = {}) => ({
  tagName: 'DIV',
  id: '',
  className: '',
  getAttribute: (k) => attrs[k] ?? null,
  parentElement: null,
  classList: { contains: () => false },
  ...extra,
});

describe('HudInspector naming + selectors', () => {
  it('names via data-guide / aria-label before class', () => {
    expect(resolveHudName(fakeEl({ 'data-guide': 'scoreboard' }))).toBe('scoreboard');
    expect(resolveHudName(fakeEl({ 'aria-label': 'Mic test' }))).toBe('Mic test');
    expect(resolveHudName({ ...fakeEl(), className: 'header-metrics-strip foo' })).toBe('.header-metrics-strip');
    expect(resolveHudName({ ...fakeEl(), tagName: 'DIV' })).toBe('<div>');
  });

  it('builds unique selector preferring #id then [data-guide]', () => {
    expect(buildUniqueSelector(fakeEl({}, { id: 'header-mic-test-btn', tagName: 'BUTTON' })))
      .toBe('#header-mic-test-btn');
    expect(buildUniqueSelector(fakeEl({ 'data-guide': 'scoreboard' }))).toBe('[data-guide="scoreboard"]');
  });

  it('falls back to tag path for plain container divs', () => {
    const parent = fakeEl({}, { tagName: 'SECTION', className: 'dashboard-header-fill' });
    const child = fakeEl({}, { tagName: 'DIV', className: 'call-micro-bar-center', parentElement: parent });
    const sel = buildUniqueSelector(child);
    expect(sel).toContain('div.call-micro-bar-center');
  });

  it('inspector defaults OFF (no stored pref), respects stored on', () => {
    localStorage.clear();
    expect(readInspectorEnabled()).toBe(false);
    localStorage.setItem('hud-inspector-on-v2', '0');
    expect(readInspectorEnabled()).toBe(false);
    localStorage.setItem('hud-inspector-on-v2', '1');
    expect(readInspectorEnabled()).toBe(true);
  });
});

describe('HudInspector select mode (v4.102.0): click element = copy, tooltip freezes', () => {
  let writeText;
  let container;
  let elA;

  const nextFrame = () => act(async () => { await new Promise((r) => requestAnimationFrame(r)); });

  const mountAppElement = () => {
    container = document.createElement('div');
    container.className = 'app-container';
    document.body.appendChild(container);
    elA = document.createElement('button');
    elA.id = 'hud-test-btn';
    elA.setAttribute('data-hud-name', 'Test Button');
    elA.getBoundingClientRect = () => ({ left: 100, top: 200, right: 150, bottom: 220, width: 50, height: 20, x: 100, y: 200, toJSON: () => ({}) });
    container.appendChild(elA);
    return elA;
  };

  beforeEach(() => {
    localStorage.clear();
    writeText = jest.fn().mockResolvedValue(true);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('clicking an app element copies "name :: #id" and swallows the click; Esc exits', async () => {
    const el = mountAppElement();
    render(<HudInspectorHost />);
    fireEvent.click(screen.getByTitle(/HUD inspector/)); // turn ON via ⌖ toggle

    // Hover the element → tooltip shows name + selector.
    await nextFrame();
    fireEvent.mouseMove(el);
    await nextFrame();
    const tip = document.querySelector('.hud-inspector-tip');
    expect(tip).not.toBeNull();
    expect(tip.textContent).toContain('Test Button');
    expect(tip.textContent).toContain('#hud-test-btn');

    // Click the element itself → selector copied, click never reaches the app.
    const bubbled = jest.fn();
    document.addEventListener('click', bubbled);
    await act(async () => {
      fireEvent.click(el);
      await Promise.resolve(); // flush clipboard promise
    });
    expect(writeText).toHaveBeenCalledWith('Test Button :: #hud-test-btn');
    expect(bubbled).not.toHaveBeenCalled();
    document.removeEventListener('click', bubbled);
    expect(document.querySelector('.hud-inspector-tip').textContent).toContain('✓ copied');

    // Esc exits select mode.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.hud-inspector-tip')).toBeNull();
    expect(screen.getByTitle(/HUD inspector/).getAttribute('aria-pressed')).toBe('false');
  });

  it('mousemove over the tooltip keeps it frozen (no retarget, no vanish)', async () => {
    const el = mountAppElement();
    render(<HudInspectorHost />);
    fireEvent.click(screen.getByTitle(/HUD inspector/));

    await nextFrame();
    fireEvent.mouseMove(el);
    await nextFrame();
    const tip = document.querySelector('.hud-inspector-tip');
    const before = tip.textContent;

    // Pointer arrives on the tooltip itself → handler must early-return.
    fireEvent.mouseMove(tip);
    await nextFrame();
    expect(document.querySelector('.hud-inspector-tip').textContent).toBe(before);
  });
});
