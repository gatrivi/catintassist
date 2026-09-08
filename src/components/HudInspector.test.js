import { resolveHudName, buildUniqueSelector } from './HudInspector';

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
});
