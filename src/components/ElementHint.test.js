import { buildElementSelector, buildHintPayload } from './ElementHint';

describe('ElementHint selectors', () => {
  it('prefers #id over data-guide', () => {
    expect(buildElementSelector({ elementId: 'header-mic-test-btn', guideKey: 'mic-test' }))
      .toBe('#header-mic-test-btn');
  });

  it('falls back to data-guide', () => {
    expect(buildElementSelector({ guideKey: 'scoreboard' }))
      .toBe('[data-guide="scoreboard"]');
  });

  it('buildHintPayload includes selector', () => {
    const p = buildHintPayload({
      elementId: 'metric-m1',
      heading: 'MINS TODAY',
      body: 'test',
      x: 10,
      y: 20,
    });
    expect(p.selector).toBe('#metric-m1');
    expect(p.heading).toBe('MINS TODAY');
  });
});
